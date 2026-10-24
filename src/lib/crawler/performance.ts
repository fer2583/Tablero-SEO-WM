import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "../../db/client";
import { auditStore, AuditConflict } from "../../db/audit-store";
import { getLatestSourceSnapshot, saveSourceSnapshot } from "../../db/queries";
import { fetchCrux, fetchPsi, type AuditData, type PerformanceTask, type SourceStatus } from "../audit";
import { SITE_URL } from "../site";
import { normalizeUrl } from "./engine";
import { AuditInputError } from "./http";

async function cached<T extends { status: SourceStatus }>(source: string, fetcher: () => Promise<T>, force: boolean): Promise<T> {
  const previous = force ? null : await getLatestSourceSnapshot(SITE_URL, source);
  const value = previous?.snapshot as T | undefined;
  const ttl = value?.status === "live" ? 86_400_000 : 300_000;
  if (value && Date.now() - new Date(previous!.completedAt).getTime() < ttl) return value;
  const result = await fetcher();
  await saveSourceSnapshot(SITE_URL, source, "latest", result);
  return result;
}
function sourceStatus(statuses: SourceStatus[]): SourceStatus {
  return statuses.every((status) => status === "live") ? "live" : statuses.some((status) => status === "live") ? "partial" : statuses.some((status) => status === "error") ? "error" : "unavailable";
}
export async function reserveEnrichment(id: number, target = SITE_URL, force = false) {
  let url: string;
  try { url = normalizeUrl(target); } catch { throw new AuditInputError("URL de rendimiento fuera del sitio permitido."); }
  const run = await auditStore().get(id);
  if (!run || run.status !== "completed") throw new AuditConflict("Completa el crawl antes de ejecutar el enriquecimiento.");
  if (!run.state.pages.some((page) => page.url === url && page.outcome === "html")) throw new AuditInputError("Selecciona una página HTML incluida en esta corrida.");
  const token = randomUUID();
  const task: PerformanceTask = { status: "running", url, startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 180_000).toISOString(), message: "Consultando PageSpeed y Core Web Vitals para mobile y desktop." };
  const lock = await getDb().query(`UPDATE audit_runs SET lock_token=$2::uuid,lock_expires_at=NOW()+INTERVAL '180 seconds',snapshot=jsonb_set(snapshot,'{performanceTask}',$3::jsonb)
    WHERE id=$1 AND status='completed' AND (lock_expires_at IS NULL OR lock_expires_at<NOW()) RETURNING id`, [id, token, JSON.stringify(task)]);
  if (!lock.rowCount) throw new AuditConflict("Hay otra operación de rendimiento en curso.");
  return { id, token, url, force, task, snapshot: run.savedSnapshot as AuditData };
}
export async function executeEnrichment(job: Awaited<ReturnType<typeof reserveEnrichment>>) {
  const { id, token, url, force, task, snapshot } = job;
  const db = getDb();
  try {
    const hash = createHash("sha256").update(url).digest("hex").slice(0, 20);
    const [mobilePsi, desktopPsi, mobileCrux, desktopCrux] = await Promise.all([
      cached(`audit:psi:mobile:${hash}`, () => fetchPsi("mobile", url), force), cached(`audit:psi:desktop:${hash}`, () => fetchPsi("desktop", url), force),
      cached("audit:crux:mobile", () => fetchCrux("mobile"), force), cached("audit:crux:desktop", () => fetchCrux("desktop"), force),
    ]);
    const devices = { mobile: { psi: mobilePsi, crux: mobileCrux }, desktop: { psi: desktopPsi, crux: desktopCrux } };
    snapshot.performancePages = { ...snapshot.performancePages, [url]: devices };
    if (url === SITE_URL) snapshot.devices = devices;
    snapshot.performanceTask = { ...task, status: "completed", completedAt: new Date().toISOString(), message: "Consultas terminadas. Cada fuente informa su disponibilidad por separado." };
    snapshot.sources.psi = sourceStatus(Object.values(snapshot.performancePages).flatMap((page) => [page.mobile.psi.status, page.desktop.psi.status]));
    snapshot.sources.crux = sourceStatus([mobileCrux.status, desktopCrux.status]);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const owned = await client.query(`SELECT id FROM audit_runs WHERE id=$1 AND lock_token=$2::uuid AND lock_expires_at>NOW() FOR UPDATE`, [id, token]);
      if (!owned.rowCount) throw new AuditConflict("La operación perdió su bloqueo.");
      if (url === SITE_URL) for (const [device, result] of Object.entries(devices)) {
        await client.query(`INSERT INTO pagespeed_results (audit_run_id,site_url,device,status,scores,metrics,opportunities) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb) ON CONFLICT (audit_run_id,device) DO UPDATE SET status=EXCLUDED.status,scores=EXCLUDED.scores,metrics=EXCLUDED.metrics,opportunities=EXCLUDED.opportunities`, [id, SITE_URL, device, result.psi.status, JSON.stringify(result.psi.scores), JSON.stringify(result.psi.metrics), JSON.stringify(result.psi.opportunities)]);
        await client.query(`INSERT INTO crux_results (audit_run_id,site_url,form_factor,origin,status,metrics) VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (audit_run_id,form_factor) DO UPDATE SET status=EXCLUDED.status,metrics=EXCLUDED.metrics`, [id, SITE_URL, device, result.crux.origin, result.crux.status, JSON.stringify(result.crux.metrics)]);
      }
      await client.query(`UPDATE audit_runs SET snapshot=$3::jsonb,lock_token=NULL,lock_expires_at=NULL WHERE id=$1 AND lock_token=$2::uuid`, [id, token, JSON.stringify(snapshot)]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) {
    await db.query(`UPDATE audit_runs SET snapshot=jsonb_set(snapshot,'{performanceTask}',$3::jsonb) WHERE id=$1 AND lock_token=$2::uuid`, [id, token, JSON.stringify({ ...task, status: "error", completedAt: new Date().toISOString(), message: "La consulta de rendimiento se interrumpió. Reintentar desde Rendimiento." })]);
    throw error;
  } finally { await auditStore().release(id, token); }
}
// Synchronous entry point for CLI/tests; HTTP uses after() with a persisted task.
export async function enrichRun(id: number, target = SITE_URL, force = false) {
  return executeEnrichment(await reserveEnrichment(id, target, force));
}
