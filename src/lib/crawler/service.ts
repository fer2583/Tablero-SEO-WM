import "server-only";
import { randomUUID } from "node:crypto";
import { auditStore, AuditConflict } from "../../db/audit-store";
import { getAuditHistory, getLatestAuditSnapshot, getLatestIndexationSnapshot, getLatestSourceSnapshot, saveSourceSnapshot } from "../../db/queries";
import { buildAuditSnapshot, type AuditData } from "../audit";
import { SITE_URL } from "../site";
import { enqueue, initializeCrawl, normalizeUrl, processBatch, readRobots } from "./engine";
import { crawlConfig, type CrawlRun, type RobotsPolicy } from "./types";

export async function createRun(options: { urls?: string[]; maxUrls?: number } = {}) {
  const store = auditStore();
  const active = await store.active();
  if (active) return active;
  const previous = await getLatestAuditSnapshot(SITE_URL);
  const cached = await getLatestSourceSnapshot(SITE_URL, "audit-robots");
  const config = crawlConfig();
  if (options.maxUrls != null) {
    if (!Number.isInteger(options.maxUrls) || options.maxUrls < 1 || options.maxUrls > config.maxUrls) throw new Error(`maxUrls debe estar entre 1 y ${config.maxUrls}.`);
    config.maxUrls = options.maxUrls;
  }
  const state = await initializeCrawl(config, cached?.snapshot as RobotsPolicy | undefined);
  state.previousIssues = (previous?.snapshot as AuditData | undefined)?.crawler?.issues ?? [];
  if (config.incremental) state.previousPages = Object.fromEntries(((previous?.snapshot as AuditData | undefined)?.crawler?.audited || []).filter((page) => page.outcome === "html").map((page) => [page.url, page]));
  const seeds = await store.seeds();
  for (const [value, traffic] of Object.entries(seeds.traffic)) { try { state.traffic[normalizeUrl(value)] = traffic; } catch { /* Ignore external analytics URLs. */ } }
  if (options.urls?.length) {
    state.scope = "selective";
    if (options.urls.length > 100) throw new Error("La reauditoría selectiva admite hasta 100 URLs.");
    const urls = options.urls.map((url) => normalizeUrl(url));
    state.queue = []; state.known = []; state.excluded = []; state.limitReached = false;
    urls.forEach((url) => enqueue(state, url, state.sitemap.urls.includes(url) ? "sitemap" : "manual"));
    // A selective run must not silently turn into a full crawl.
    state.config.maxUrls = state.queue.length;
  } else {
    seeds.urls.forEach((url) => enqueue(state, url, "analytics"));
    (previous?.snapshot as AuditData | undefined)?.crawler?.audited?.forEach((page) => enqueue(state, page.url, "history"));
  }
  if (state.robots.status !== "unavailable") await saveSourceSnapshot(SITE_URL, "audit-robots", "latest", state.robots);
  const run = await store.create(state);
  if (!run) throw new Error("No se pudo crear la corrida.");
  return run;
}
export async function advanceRun(id: number) {
  const store = auditStore();
  const current = await store.get(id);
  if (!current) throw new Error("Corrida no encontrada.");
  const retryAt = current.state.retryAt || current.state.robots.retryAt;
  if (retryAt && Date.parse(retryAt) > Date.now()) throw new AuditConflict(`Reintentar después de ${retryAt}.`);
  const token = randomUUID();
  const run = await store.claim(id, token);
  if (!run) throw new AuditConflict("Corrida pausada, terminada o con un lote activo.");
  try {
    if (run.state.robots.status === "unavailable") run.state.robots = await readRobots();
    await processBatch(run.state);
    const snapshot = buildAuditSnapshot(run.state);
    run.status = await store.checkpoint(id, token, run.state, snapshot);
    return run;
  } finally { await store.release(id, token); }
}
export async function runView(run: CrawlRun) {
  const snapshot = run.status === "completed" && (run.savedSnapshot as AuditData | undefined)?.crawler ? run.savedSnapshot as AuditData : buildAuditSnapshot(run.state);
  if (snapshot.performanceTask?.status === "running" && Date.parse(snapshot.performanceTask.expiresAt) < Date.now()) snapshot.performanceTask = { ...snapshot.performanceTask, status: "error", message: "La consulta de rendimiento se interrumpió. Reintentar desde Rendimiento." };
  snapshot.history = await getAuditHistory(SITE_URL);
  const latestIndexation = await getLatestIndexationSnapshot(SITE_URL);
  const indexation = latestIndexation?.snapshot as { inspection?: { rows?: Array<{ url: string; verdict: string; userCanonical: string | null; googleCanonical: string | null; robotsTxtState: string | null; lastInspection: string | null; status: string }> } } | undefined;
  const inspected = indexation?.inspection?.rows?.filter((row) => row.status !== "not_inspected") ?? [];
  if (inspected.length) {
    snapshot.sources.gsc = "partial";
    snapshot.indexing = { status: "partial", sitemapUrls: run.state.sitemap.urls.length, inspected: inspected.length, indexed: inspected.filter((row) => row.status === "indexed").length, notIndexed: inspected.filter((row) => row.status === "not_indexed").length, errors: inspected.filter((row) => row.status === "error").length, coverage: null, rows: inspected.map((row) => ({ url: row.url, verdict: row.verdict, declaredCanonical: row.userCanonical, googleCanonical: row.googleCanonical, robots: row.robotsTxtState, lastInspection: row.lastInspection })), message: `URL Inspection persistida: ${latestIndexation?.completedAt}. No representa todo el sitio.` };
  }
  return { id: run.id, status: run.status, startedAt: run.startedAt, completedAt: run.completedAt,
    progress: { processed: run.state.pages.length, pending: run.state.queue.length, excluded: run.state.excluded.length, html: run.state.pages.filter((page) => page.outcome === "html").length, failed: run.state.pages.filter((page) => !["html", "blocked", "non_html"].includes(page.outcome)).length, blocked: run.state.pages.filter((page) => page.outcome === "blocked").length, limitReached: run.state.limitReached },
    config: run.state.config, rulesVersion: run.state.version, retryAt: run.state.retryAt || run.state.robots.retryAt, snapshot,
    browserReports: await auditStore().browserReports(run.id) };
}
export type RunView = Awaited<ReturnType<typeof runView>>;
