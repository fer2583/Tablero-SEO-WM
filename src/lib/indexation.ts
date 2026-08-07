import { google } from "googleapis";
import { crawlSiteUrls, type PageAudit } from "@/lib/audit";
import { loadSitemap, SITE_URL } from "@/lib/site";

export type IndexationRow = { url: string; status: "indexed" | "not_indexed" | "error" | "not_inspected"; verdict: string | null; lastCrawl: string | null; userCanonical: string | null; googleCanonical: string | null; robotsTxtState: string | null; coverageState: string | null; indexingState: string | null; sitemap: string | null; mobileUsability: string | null; richResults: string | null; lastInspection: string | null; crawler: PageAudit | null; error?: string };
export type SitemapRow = { path: string; isPending: boolean | null; isSitemapsIndex: boolean | null; lastSubmitted: string | null; lastDownloaded: string | null; warnings: string[]; errors: string[] };
export type IndexationData = { siteUrl: string; gscSiteUrl: string; generatedAt: string; sitemap: { status: string; urls: string[]; sitemaps: string[]; fetchedAt: string; message?: string }; sitemaps: { status: "live" | "unavailable"; rows: SitemapRow[]; message?: string }; inspection: { status: "live" | "no_data" | "unavailable" | "error"; rows: IndexationRow[]; inspected: number; indexed: number | null; notIndexed: number | null; errors: number | null; checkedAt: string | null; message?: string }; crawler: { status: "live" | "no_data"; rows: PageAudit[]; limit: number }; strategy: { limit: number; priority: string; persistence: string } };

const maxInspectionLimit = 20;
const inspectionLimit = Math.min(Math.max(Number(process.env.INDEXATION_INSPECTION_LIMIT || 10), 1), maxInspectionLimit);
const gscSiteUrl = process.env.GSC_SITE_URL || "sc-domain:whalemate.com";

function auth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw && !process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no está configurada.");
  return new google.auth.GoogleAuth({ credentials: raw ? JSON.parse(raw) : undefined, scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
}
function unavailableRows(urls: string[], crawler: PageAudit[]) { return urls.map((url) => ({ url, status: "not_inspected" as const, verdict: null, lastCrawl: null, userCanonical: null, googleCanonical: null, robotsTxtState: null, coverageState: null, indexingState: null, sitemap: null, mobileUsability: null, richResults: null, lastInspection: null, crawler: crawler.find((page) => page.url === url) ?? null })); }
function sitemapRows(data: Array<Record<string, unknown>>) { return data.map((item) => ({ path: String(item.path || ""), isPending: typeof item.isPending === "boolean" ? item.isPending : null, isSitemapsIndex: typeof item.isSitemapsIndex === "boolean" ? item.isSitemapsIndex : null, lastSubmitted: typeof item.lastSubmitted === "string" ? item.lastSubmitted : null, lastDownloaded: typeof item.lastDownloaded === "string" ? item.lastDownloaded : null, warnings: Array.isArray(item.warnings) ? item.warnings.map(String) : [], errors: Array.isArray(item.errors) ? item.errors.map(String) : [] })); }

async function gscSitemaps() {
  try { const client = google.searchconsole({ version: "v1", auth: auth() }); const response = await client.sitemaps.list({ siteUrl: gscSiteUrl }); const data = (response.data.sitemap ?? []) as unknown as Array<Record<string, unknown>>; return { status: "live" as const, rows: sitemapRows(data) }; }
  catch (error) { return { status: "unavailable" as const, rows: [], message: error instanceof Error && /permission|forbidden|unauthorized|credential|JSON/i.test(error.message) ? `Search Console no disponible: ${error.message}` : "Search Console Sitemaps no está disponible." }; }
}

async function inspect(urls: string[], crawler: PageAudit[]) {
  const base = unavailableRows(urls, crawler);
  if (!urls.length) return { status: "no_data" as const, rows: base, inspected: 0, indexed: null, notIndexed: null, errors: null, checkedAt: null, message: "El sitemap no contiene URLs para inspeccionar." };
  try {
    const client = google.searchconsole({ version: "v1", auth: auth() });
    const rows: IndexationRow[] = [];
    for (const url of urls.slice(0, inspectionLimit)) {
      try {
        const response = await client.urlInspection.index.inspect({ requestBody: { inspectionUrl: url, siteUrl: gscSiteUrl } });
        const result = response.data.inspectionResult;
        const index = result?.indexStatusResult;
        const verdict = index?.verdict || null;
        rows.push({ url, status: verdict === "PASS" ? "indexed" : verdict ? "not_indexed" : "error", verdict, lastCrawl: index?.lastCrawlTime || null, userCanonical: index?.userCanonical || null, googleCanonical: index?.googleCanonical || null, robotsTxtState: index?.robotsTxtState || null, coverageState: index?.coverageState || null, indexingState: index?.indexingState || null, sitemap: index?.sitemap?.[0] || null, mobileUsability: result?.mobileUsabilityResult?.verdict || null, richResults: result?.richResultsResult?.verdict || null, lastInspection: new Date().toISOString(), crawler: crawler.find((page) => page.url === url) ?? null });
      } catch (error) { rows.push({ ...base.find((row) => row.url === url)!, status: "error", lastInspection: new Date().toISOString(), crawler: crawler.find((page) => page.url === url) ?? null, error: error instanceof Error ? error.message : "Error de URL Inspection" }); }
    }
    const indexed = rows.filter((row) => row.status === "indexed").length;
    const errors = rows.filter((row) => row.status === "error").length;
    const inspected = [...rows, ...base.filter((row) => !rows.some((item) => item.url === row.url))];
    return { status: "live" as const, rows: inspected, inspected: rows.length, indexed, notIndexed: rows.length - indexed - errors, errors, checkedAt: new Date().toISOString(), message: urls.length > inspectionLimit ? `Solo se inspeccionan ${inspectionLimit} URLs prioritarias por acción para respetar la cuota de URL Inspection.` : undefined };
  } catch (error) { return { status: "unavailable" as const, rows: base, inspected: 0, indexed: null, notIndexed: null, errors: null, checkedAt: null, message: error instanceof Error ? `URL Inspection no disponible: ${error.message}` : "URL Inspection no disponible." }; }
}

export async function loadIndexation(shouldInspect = false): Promise<IndexationData> {
  const sitemap = await loadSitemap();
  const priorityUrls = sitemap.urls.slice(0, inspectionLimit);
  const crawler = await crawlSiteUrls(priorityUrls, inspectionLimit);
  const [sitemaps, inspection] = await Promise.all([gscSitemaps(), shouldInspect ? inspect(priorityUrls, crawler) : Promise.resolve({ status: "no_data" as const, rows: unavailableRows(sitemap.urls, crawler), inspected: 0, indexed: null, notIndexed: null, errors: null, checkedAt: null, message: "URL Inspection es URL por URL. Pulsa Inspeccionar prioritarias para consultar una muestra segura." })]);
  return { siteUrl: SITE_URL, gscSiteUrl, generatedAt: new Date().toISOString(), sitemap, sitemaps, inspection, crawler: { status: crawler.length ? "live" : "no_data", rows: crawler, limit: inspectionLimit }, strategy: { limit: inspectionLimit, priority: "Primeras URLs reales del sitemap; no se inspeccionan todas automáticamente.", persistence: "Sin base de datos: las URLs no consultadas permanecen como not_inspected / No data." } };
}
