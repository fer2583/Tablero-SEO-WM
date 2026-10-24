import { auditStore } from "@/db/audit-store";
import { advanceRun, runView } from "@/lib/crawler/service";
import { auditHttp, AuditInputError, json, readInput, runId } from "@/lib/crawler/http";
import { executeEnrichment, reserveEnrichment } from "@/lib/crawler/performance";
import { after } from "next/server";
import { getDb } from "@/db/client";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string; operation: string }> };

export async function POST(request: Request, context: Context) {
  return auditHttp(async () => {
    const { id: value, operation } = await context.params;
    const id = runId(value);
    const input = await readInput(request);
    const run = await auditStore().get(id);
    if (!run) return json({ error: "Corrida no encontrada." }, 404);
    if (operation === "process") {
      const completed = await advanceRun(id);
      if (completed.status === "completed" && completed.state.scope !== "selective" && completed.state.pages.some((page) => page.url === SITE_URL && page.outcome === "html")) {
        const job = await reserveEnrichment(id);
        after(async () => { try { await executeEnrichment(job); } catch { console.error("Automatic performance enrichment failed for audit", id); } });
      }
      return json(await runView((await auditStore().get(id))!));
    }
    if (operation === "actions") {
      if (!["pause", "resume", "cancel"].includes(String(input.action))) throw new AuditInputError("Acción inválida.");
      return json(await runView(await auditStore().action(id, input.action as "pause" | "resume" | "cancel")));
    }
    if (operation === "enrich") {
      if (input.force != null && typeof input.force !== "boolean") throw new AuditInputError("force debe ser booleano.");
      const job = await reserveEnrichment(id, typeof input.url === "string" ? input.url : undefined, input.force === true);
      after(async () => { try { await executeEnrichment(job); } catch { console.error("Performance enrichment failed for audit", id); } });
      return json(await runView((await auditStore().get(id))!), 202);
    }
    return json({ error: "Operación no encontrada." }, 404);
  });
}
export async function GET(request: Request, context: Context) {
  return auditHttp(async () => {
    const { id, operation } = await context.params;
    if (operation === "evidence") {
      const params = new URL(request.url).searchParams;
      const reportId = params.get("report") || "", name = params.get("name") || "";
      if (!/^[0-9a-f-]{36}$/i.test(reportId) || !/^[a-z0-9_-]+\.png$/i.test(name)) throw new AuditInputError("Referencia de evidencia inválida.");
      const result = await getDb().query<{ content: Buffer }>(`SELECT a.content FROM audit_browser_artifacts a JOIN audit_browser_reports r ON r.id=a.report_id JOIN audit_runs c ON c.id=r.audit_run_id WHERE r.audit_run_id=$1 AND r.id=$2::uuid AND a.name=$3 AND c.site_url=$4`, [runId(id), reportId, name, SITE_URL]);
      if (!result.rows[0]) return json({ error: "Captura no disponible; consultar los artefactos del runner." }, 404);
      return new Response(new Uint8Array(result.rows[0].content), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
    }
    const run = await auditStore().get(runId(id));
    if (!run) return json({ error: "Corrida no encontrada." }, 404);
    const view = await runView(run);
    const params = new URL(request.url).searchParams;
    const offset = Math.max(0, Number(params.get("offset")) || 0);
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 25));
    const rows = operation === "pages" ? run.state.pages : operation === "issues" ? view.snapshot.crawler.issues : operation === "links" ? run.state.pages.flatMap((page) => page.links.map((link) => ({ source: page.url, ...link }))) : null;
    if (!rows) return json({ error: "Operación no encontrada." }, 404);
    const search = (params.get("q") || "").toLowerCase();
    const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search));
    return json({ rows: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit });
  });
}
