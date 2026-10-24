import { SITE_URL } from "./site";
import { fetchPage, initializeCrawl, processBatch, readRobots } from "./crawler/engine";
import { evaluateCrawl } from "./crawler/rules";
import type { CrawlIssue, CrawlPage, CrawlReport, CrawlState } from "./crawler/types";

export { SITE_URL } from "./site";
export type AuditDevice = "mobile" | "desktop";
export type SourceStatus = "live" | "partial" | "unavailable" | "error";
export type AuditIssue = CrawlIssue;
export type PageAudit = CrawlPage;
export type SourceDiagnostic = { code: "not_configured" | "no_data" | "quota" | "forbidden" | "invalid_key" | "timeout" | "upstream" | "invalid_response"; httpStatus?: number; retryable: boolean };
export type PerformanceTask = { status: "running" | "completed" | "error"; url: string; startedAt: string; expiresAt: string; completedAt?: string; message?: string };
export type PsiResult = { status: SourceStatus; message?: string; diagnostic?: SourceDiagnostic; url?: string; fetchedAt?: string; scores: Record<string, number | null>; metrics: Record<string, number | null>; opportunities: Array<{ title: string; displayValue: string; score: number | null }> };
export type CruxResult = { status: SourceStatus; message?: string; diagnostic?: SourceDiagnostic; fetchedAt?: string; collectionPeriod?: unknown; scope?: "origin" | "url"; formFactor: string; origin: string; metrics: Record<string, number | null> };
export type AuditHistory = { id: number; snapshotKey: string; status: string; completedAt: string | null };
export type AuditData = {
  scope?: "full" | "selective";
  siteUrl: string; generatedAt: string;
  devices: Record<AuditDevice, { psi: PsiResult; crux: CruxResult }>;
  sources: { psi: SourceStatus; crux: SourceStatus; crawler: SourceStatus; gsc: SourceStatus };
  sitemap: { status: SourceStatus; urls: string[]; sitemaps: string[]; message?: string };
  crawler: { audited: PageAudit[]; issues: AuditIssue[]; robots: SourceStatus; sitemap: SourceStatus; message?: string; excluded?: CrawlState["excluded"] };
  schema: { audited: number; withJsonLd: number; withoutJsonLd: number; coverage: number | null; byType: Record<string, number>; byLanguage: Record<string, { audited: number; withJsonLd: number }>; withoutSchema: string[]; parseErrors: Array<{ url: string; error: string }>; status: SourceStatus; message?: string };
  indexing: { status: SourceStatus; sitemapUrls: number | null; inspected: number | null; indexed: number | null; notIndexed: number | null; errors: number | null; coverage: number | null; rows: Array<{ url: string; verdict: string; declaredCanonical: string | null; googleCanonical: string | null; robots: string | null; lastInspection: string | null; error?: string }>; message?: string };
  history: AuditHistory[] | "no_data";
  performancePages?: Record<string, AuditData["devices"]>;
  performanceTask?: PerformanceTask;
  report?: CrawlReport; rulesVersion?: string;
};
export function emptyPsi(message: string): PsiResult {
  return { status: "unavailable", message, scores: { performance: null, accessibility: null, bestPractices: null, seo: null }, metrics: { lcp: null, cls: null, tbt: null, fcp: null }, opportunities: [] };
}
export function emptyCrux(device: AuditDevice, message: string): CruxResult {
  return { status: "unavailable", message, formFactor: device, origin: new URL(SITE_URL).origin, scope: "origin", metrics: { lcp: null, inp: null, cls: null, fcp: null, ttfb: null } };
}
export function buildAuditSnapshot(state: CrawlState): AuditData {
  const report = evaluateCrawl(state);
  const pages = state.pages.filter((page) => page.outcome === "html");
  const withJsonLd = pages.filter((page) => page.jsonLd > 0).length;
  const byType: Record<string, number> = {};
  const byLanguage: AuditData["schema"]["byLanguage"] = {};
  pages.forEach((page) => {
    const row = byLanguage[page.language] ?? { audited: 0, withJsonLd: 0 };
    row.audited++; row.withJsonLd += page.jsonLd > 0 ? 1 : 0;
    byLanguage[page.language] = row;
    page.schemaTypes.forEach((type) => { byType[type] = (byType[type] || 0) + 1; });
  });
  const complete = !state.queue.length && !state.limitReached && state.sitemap.status === "live" && state.pages.every((page) => page.outcome === "html");
  const status = state.pages.length ? complete ? "live" : "partial" : "unavailable";
  return { siteUrl: SITE_URL, scope: state.scope || "full", generatedAt: new Date().toISOString(), rulesVersion: state.version, report,
    devices: { mobile: { psi: emptyPsi("Ejecutar enriquecimiento de rendimiento."), crux: emptyCrux("mobile", "Ejecutar enriquecimiento de rendimiento.") }, desktop: { psi: emptyPsi("Ejecutar enriquecimiento de rendimiento."), crux: emptyCrux("desktop", "Ejecutar enriquecimiento de rendimiento.") } },
    sources: { psi: "unavailable", crux: "unavailable", crawler: status, gsc: "unavailable" }, sitemap: state.sitemap,
    crawler: { audited: state.pages, issues: report.issues, robots: state.robots.status, sitemap: state.sitemap.status, excluded: state.excluded, message: state.message || `${state.pages.length} procesadas; ${state.queue.length} pendientes; ${state.excluded.length} excluidas. ${state.limitReached ? "Se alcanzó un límite de rastreo." : ""}` },
    schema: { audited: pages.length, withJsonLd, withoutJsonLd: pages.length - withJsonLd, coverage: pages.length ? Math.round(withJsonLd / pages.length * 100) : null, byType, byLanguage, withoutSchema: pages.filter((page) => !page.jsonLd).map((page) => page.url), parseErrors: pages.flatMap((page) => page.parseErrors.map((error) => ({ url: page.url, error }))), status },
    indexing: { status: "unavailable", sitemapUrls: state.sitemap.urls.length, inspected: null, indexed: null, notIndexed: null, errors: null, coverage: null, rows: [], message: "Indexabilidad HTML no equivale a indexación en Google. Consultar el snapshot de URL Inspection." }, history: "no_data" };
}
export async function crawlSiteUrls(urls: string[], limit = 10) {
  const policy = await readRobots();
  const selected = urls.slice(0, Math.min(Math.max(limit, 1), 50));
  const pages: CrawlPage[] = [];
  for (let i = 0; i < selected.length; i += 4) pages.push(...await Promise.all(selected.slice(i, i + 4).map((url) => fetchPage({ url, sources: ["inspection"], attempts: 0 }, policy))));
  return pages;
}
// CLI/dry-run only. HTTP routes use persisted, bounded batches instead.
export async function runAudit() {
  const state = await initializeCrawl();
  while (state.queue.length && state.robots.status !== "unavailable") {
    await processBatch(state);
    if (state.retryAt) break;
  }
  return buildAuditSnapshot(state);
}

export async function fetchPsi(device: AuditDevice, url = SITE_URL): Promise<PsiResult> {
  const failed = (diagnostic: SourceDiagnostic, message: string): PsiResult => ({ ...emptyPsi(message), url, fetchedAt: new Date().toISOString(), status: diagnostic.code === "not_configured" ? "unavailable" : "error", diagnostic });
  if (!process.env.PAGESPEED_API_KEY) return failed({ code: "not_configured", retryable: false }, "PAGESPEED_API_KEY no está configurada.");
  try {
    const query = new URLSearchParams({ url, key: process.env.PAGESPEED_API_KEY, strategy: device });
    ["performance", "accessibility", "best-practices", "seo"].forEach((category) => query.append("category", category));
    const response = await fetch(`https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${query}`, { signal: AbortSignal.timeout(90_000), cache: "no-store" });
    if (!response.ok) {
      const diagnostic = await googleDiagnostic(response);
      return failed(diagnostic, diagnosticMessage("PageSpeed", diagnostic));
    }
    const json = await response.json();
    if (json.lighthouseResult?.runtimeError || typeof json.lighthouseResult?.categories?.performance?.score !== "number") return failed({ code: "invalid_response", retryable: true }, "Lighthouse no pudo completar la prueba de esta URL. Reintentar el test.");
    const audits = json.lighthouseResult?.audits ?? {};
    const metric = (id: string): number | null => Number.isFinite(audits[id]?.numericValue) ? audits[id].numericValue : null;
    const score = (id: string): number | null => typeof json.lighthouseResult?.categories?.[id]?.score === "number" ? Math.round(json.lighthouseResult.categories[id].score * 100) : null;
    type PsiAudit = { details?: { type?: string }; title?: string; displayValue?: string; score?: number | null };
    return { status: "live", url, fetchedAt: new Date().toISOString(), scores: { performance: score("performance"), accessibility: score("accessibility"), bestPractices: score("best-practices"), seo: score("seo") },
      metrics: { lcp: metric("largest-contentful-paint"), cls: metric("cumulative-layout-shift"), tbt: metric("total-blocking-time"), fcp: metric("first-contentful-paint") },
      opportunities: (Object.values(audits) as PsiAudit[]).filter((audit) => ["opportunity", "diagnostic"].includes(audit.details?.type || "")).slice(0, 15).map((audit) => ({ title: audit.title || "Lighthouse", displayValue: audit.displayValue || "", score: typeof audit.score === "number" ? Math.round(audit.score * 100) : null })) };
  } catch (error) { const timeout = error instanceof Error && /timeout|abort/i.test(error.name + error.message); return failed({ code: timeout ? "timeout" : "upstream", retryable: true }, timeout ? "PageSpeed superó el tiempo de espera de 90 segundos. Reintentar el test." : "No se pudo conectar con PageSpeed Insights. Reintentar el test."); }
}
export async function fetchCrux(device: AuditDevice): Promise<CruxResult> {
  const failed = (diagnostic: SourceDiagnostic, message: string): CruxResult => ({ ...emptyCrux(device, message), fetchedAt: new Date().toISOString(), status: ["no_data", "not_configured"].includes(diagnostic.code) ? "unavailable" : "error", diagnostic });
  if (!process.env.CRUX_API_KEY) return failed({ code: "not_configured", retryable: false }, "CRUX_API_KEY no está configurada.");
  try {
    const response = await fetch(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(process.env.CRUX_API_KEY)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin: new URL(SITE_URL).origin, formFactor: device === "mobile" ? "PHONE" : "DESKTOP" }), signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!response.ok) {
      if (response.status === 404) return failed({ code: "no_data", httpStatus: 404, retryable: false }, `Google CrUX no tiene datos suficientes para https://www.whalemate.com en ${device === "mobile" ? "mobile" : "desktop"}. No es un error del test de PageSpeed.`);
      const diagnostic = await googleDiagnostic(response);
      return failed(diagnostic, diagnosticMessage("CrUX", diagnostic));
    }
    const json = await response.json();
    const metric = (name: string): number | null => { const value = json.record?.metrics?.[name]?.percentiles?.p75; return value == null || !Number.isFinite(Number(value)) ? null : Number(value); };
    if (!json.record?.metrics || !["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"].some((name) => Number.isFinite(metric(name)))) return failed({ code: "invalid_response", retryable: true }, "CrUX respondió sin métricas Core Web Vitals válidas.");
    return { status: "live", scope: "origin", origin: new URL(SITE_URL).origin, formFactor: device, collectionPeriod: json.record?.collectionPeriod, fetchedAt: new Date().toISOString(), metrics: { lcp: metric("largest_contentful_paint"), inp: metric("interaction_to_next_paint"), cls: metric("cumulative_layout_shift"), fcp: metric("first_contentful_paint"), ttfb: metric("experimental_time_to_first_byte") } };
  } catch (error) { const timeout = error instanceof Error && /timeout|abort/i.test(error.name + error.message); return failed({ code: timeout ? "timeout" : "upstream", retryable: true }, timeout ? "CrUX superó el tiempo de espera. Reintentar la consulta." : "No se pudo conectar con Google CrUX."); }
}

async function googleDiagnostic(response: Response): Promise<SourceDiagnostic> {
  // Use only an allowlisted classification, never expose Google's raw body or credentials.
  const body = await response.json().catch(() => null);
  const reasons = JSON.stringify(body?.error?.details || body?.error?.errors || "");
  const code = response.status === 429 || /QUOTA|RATE_LIMIT|rateLimit|dailyLimit/i.test(reasons) ? "quota" : /API_KEY_INVALID|keyInvalid/i.test(reasons) ? "invalid_key" : response.status === 403 ? "forbidden" : "upstream";
  return { code, httpStatus: response.status, retryable: code === "quota" || response.status >= 500 };
}
function diagnosticMessage(source: string, diagnostic: SourceDiagnostic) {
  const detail = diagnostic.code === "quota" ? "La cuota de Google está agotada o temporalmente limitada. Reintentar más tarde." : diagnostic.code === "invalid_key" ? "La clave de Google no es válida; revisar la configuración del servidor." : diagnostic.code === "forbidden" ? "Google rechazó el acceso; revisar la API habilitada y las restricciones de la clave." : "Google no pudo completar la consulta. Reintentar más tarde.";
  return `${source}: ${detail} (HTTP ${diagnostic.httpStatus})`;
}
