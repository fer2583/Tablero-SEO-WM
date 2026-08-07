import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type AuditStatus = "live" | "unavailable" | "demo";
export type AuditDevice = "mobile" | "desktop";
export type AuditIssue = { id: string; category: string; issue: string; severity: "Alta" | "Media" | "Baja"; evidence: string; recommendation: string; status: "open" | "unavailable" };
export type AuditData = {
  targetUrl: string;
  device: AuditDevice;
  generatedAt: string;
  sources: { psi: AuditStatus; crux: AuditStatus; crawler: AuditStatus };
  psi: { performance: number | null; seo: number | null; accessibility: number | null; bestPractices: number | null; lcp: number | null; cls: number | null; inp: number | null; tbt: number | null; opportunities: Array<{ title: string; displayValue: string; score: number | null }> };
  crux: { formFactor: string; origin: string; available: boolean; lcp: number | null; inp: number | null; cls: number | null; fcp: number | null; ttfb: number | null; message?: string };
  crawler: { httpStatus: number | null; title: string | null; metaDescription: string | null; headings: { h1: string[]; h2: string[]; h3: string[] }; canonical: string | null; robotsMeta: string | null; openGraph: Array<{ property: string; content: string }>; jsonLd: number; internalLinks: number; imagesWithoutAlt: number; redirects: string[]; sitemap: string; robots: string; issues: AuditIssue[]; evidence: string[] };
  sitemapUrls: string[];
};

const defaultSite = "https://www.whalemate.com/";
const maxBody = 2_000_000;
const timeoutMs = 8_000;

function siteUrl() { return process.env.SITE_URL || defaultSite; }
function host() { return new URL(siteUrl()).hostname.toLowerCase(); }
function asUrl(value: string) {
  const parsed = new URL(value);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) throw new Error("La URL debe ser HTTP(S) y no puede contener credenciales.");
  if (parsed.hostname.toLowerCase() !== host()) throw new Error("La URL debe pertenecer al hostname configurado en SITE_URL.");
  return parsed;
}
async function safeHost(value: string) {
  const addresses = await lookup(new URL(value).hostname, { all: true });
  if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("El destino resuelve a una red privada y fue bloqueado.");
}
function isPrivateAddress(address: string) {
  if (isIP(address) === 4) { const [a, b] = address.split(".").map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168); }
  const normalized = address.toLowerCase(); return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}
async function request(url: URL, accept = "text/html") {
  let current = url;
  const redirects: string[] = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await safeHost(current.toString());
    const response = await fetch(current, { headers: { accept, "user-agent": "WhaleMate-SEO-Audit/1.0" }, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return { response, body: "", redirects };
      current = asUrl(new URL(location, current).toString()); redirects.push(current.toString()); continue;
    }
    const body = (await response.text()).slice(0, maxBody);
    return { response, body, redirects };
  }
  throw new Error("Se alcanzó el límite de redirecciones.");
}
function text(value: string) { return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); }
function matches(body: string, tag: string) { return [...body.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => text(match[1])).filter(Boolean); }
function attr(body: string, tag: string, name: string) { const match = body.match(new RegExp(`<${tag}\\b[^>]*\\b${name}=["']([^"']*)["'][^>]*>`, "i")); return match?.[1]?.trim() || null; }
function meta(body: string, name: string) { const match = body.match(new RegExp(`<meta\\b[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i")) || body.match(new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`, "i")); return match?.[1]?.trim() || null; }
function unavailableIssue(category: string, issue: string, evidence: string, recommendation: string): AuditIssue { return { id: `${category}-${issue}`, category, issue, severity: "Baja", evidence, recommendation, status: "unavailable" }; }
function crawlerIssues(data: Omit<AuditData["crawler"], "issues">): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (data.httpStatus !== 200) issues.push({ id: "http-status", category: "Salud técnica", issue: "La URL no responde con 200", severity: "Alta", evidence: `HTTP ${data.httpStatus ?? "sin respuesta"}`, recommendation: "Revisa el servidor, el hosting y las redirecciones.", status: "open" });
  if (!data.title) issues.push({ id: "title", category: "On-page", issue: "Falta el title", severity: "Alta", evidence: "No se encontró <title>", recommendation: "Añade un title descriptivo y único.", status: "open" });
  if (!data.metaDescription) issues.push({ id: "meta-description", category: "On-page", issue: "Falta la meta description", severity: "Media", evidence: "No se encontró meta name=description", recommendation: "Añade una descripción relevante para el snippet.", status: "open" });
  if (data.headings.h1.length === 0) issues.push({ id: "h1", category: "On-page", issue: "No hay H1", severity: "Media", evidence: "0 elementos H1 detectados", recommendation: "Incluye un H1 que describa el contenido principal.", status: "open" });
  if (data.imagesWithoutAlt > 0) issues.push({ id: "image-alt", category: "Accesibilidad", issue: "Imágenes sin ALT", severity: "Media", evidence: `${data.imagesWithoutAlt} imagen(es) sin atributo alt`, recommendation: "Añade alt útil; usa alt vacío solo en imágenes decorativas.", status: "open" });
  if (data.canonical === null) issues.push({ id: "canonical", category: "Indexación", issue: "Falta canonical", severity: "Media", evidence: "No se encontró link rel=canonical", recommendation: "Define la URL canónica de la página.", status: "open" });
  if (data.redirects.length) issues.push({ id: "redirects", category: "Salud técnica", issue: "La URL redirige", severity: "Baja", evidence: data.redirects.join(" -> "), recommendation: "Usa la URL final en enlaces internos y sitemap.", status: "open" });
  if (data.sitemap === "unavailable") issues.push(unavailableIssue("Enlaces", "Sitemap no disponible", "No se pudo consultar sitemap.xml o sitemap-index.xml", "Publica un sitemap accesible y configúralo en robots.txt o Search Console."));
  if (data.robots === "unavailable") issues.push(unavailableIssue("Indexación", "Robots.txt no disponible", "No se pudo consultar robots.txt", "Publica robots.txt en la raíz del hostname."));
  issues.push(unavailableIssue("Enlaces", "Páginas huérfanas y profundidad", "unavailable / not collected: no se ejecutó un crawl completo", "Ejecuta un crawl completo en una fase posterior antes de tomar decisiones."));
  return issues;
}
async function robotsAllowed(url: URL) {
  try { const result = await request(new URL("/robots.txt", url), "text/plain"); const lines = result.body.split(/\r?\n/); let applies = false; for (const line of lines) { const [key, ...rest] = line.split(":"); const value = rest.join(":").trim(); if (key?.trim().toLowerCase() === "user-agent") applies = value === "*"; if (applies && key?.trim().toLowerCase() === "disallow" && value && url.pathname.startsWith(value)) return false; } return true; } catch { return true; }
}
async function sitemapUrls() {
  const visited = new Set<string>(); const pages = new Set<string>();
  const visit = async (value: string, depth: number): Promise<void> => { if (depth > 2 || visited.has(value)) return; visited.add(value); try { const result = await request(new URL(value), "application/xml,text/xml"); if (!result.response.ok) return; const locations = [...result.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim()); if (/<sitemapindex\b/i.test(result.body)) { for (const location of locations) await visit(location, depth + 1); } else { for (const location of locations) { try { if (new URL(location).hostname === host()) pages.add(new URL(location).toString()); } catch { /* Ignore malformed sitemap entries. */ } } } } catch { /* An unavailable sitemap should not block the audit. */ } };
  await visit(new URL("/sitemap.xml", siteUrl()).toString(), 0); if (!visited.size) await visit(new URL("/sitemap-index.xml", siteUrl()).toString(), 0); return [...pages].slice(0, 500);
}
async function ownAudit(target: URL): Promise<AuditData["crawler"]> {
  const robots = await (async () => { try { const result = await request(new URL("/robots.txt", target), "text/plain"); return result.response.ok ? "available" : "unavailable"; } catch { return "unavailable"; } })();
  const sitemap = await (async () => { for (const path of ["/sitemap.xml", "/sitemap-index.xml"]) { try { const result = await request(new URL(path, target), "application/xml,text/xml"); if (result.response.ok) return "available"; } catch { /* Try the alternate sitemap path. */ } } return "unavailable"; })();
  if (!(await robotsAllowed(target))) return { httpStatus: null, title: null, metaDescription: null, headings: { h1: [], h2: [], h3: [] }, canonical: null, robotsMeta: null, openGraph: [], jsonLd: 0, internalLinks: 0, imagesWithoutAlt: 0, redirects: [], sitemap, robots, issues: [unavailableIssue("Salud técnica", "Auditoría bloqueada por robots.txt", "robots.txt disallows this URL for User-agent *", "Permite este recurso si quieres auditarlo.")], evidence: ["No se descargó la página por respeto a robots.txt"] };
  try { const result = await request(target); const internalLinks = [...result.body.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)].filter((match) => { try { return new URL(match[1], target).hostname === host(); } catch { return false; } }).length; const crawler = { httpStatus: result.response.status, title: matches(result.body, "title")[0] || null, metaDescription: meta(result.body, "description"), headings: { h1: matches(result.body, "h1"), h2: matches(result.body, "h2"), h3: matches(result.body, "h3") }, canonical: attr(result.body, "link", "href"), robotsMeta: meta(result.body, "robots"), openGraph: [...result.body.matchAll(/<meta\b[^>]*(?:property|name)=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi)].map((match) => ({ property: match[1], content: match[2] })), jsonLd: [...result.body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/gi)].length, internalLinks, imagesWithoutAlt: [...result.body.matchAll(/<img\b[^>]*>/gi)].filter((match) => !/\balt=["'][^"']*["']/i.test(match[0])).length, redirects: result.redirects, sitemap, robots, evidence: [`HTTP ${result.response.status}`, `${internalLinks} enlaces internos`, `${result.redirects.length} redirecciones`] }; return { ...crawler, issues: crawlerIssues(crawler) }; } catch (error) { return { httpStatus: null, title: null, metaDescription: null, headings: { h1: [], h2: [], h3: [] }, canonical: null, robotsMeta: null, openGraph: [], jsonLd: 0, internalLinks: 0, imagesWithoutAlt: 0, redirects: [], sitemap, robots, issues: [unavailableIssue("Salud técnica", "No se pudo auditar la URL", error instanceof Error ? error.message : "Timeout o respuesta inválida", "Comprueba que la URL sea pública y accesible.")], evidence: ["Auditor propio unavailable"] }; }
}
async function fetchPsi(target: URL, device: AuditDevice): Promise<AuditData["psi"] | null> {
  if (!process.env.PAGESPEED_API_KEY) return null; const query = new URLSearchParams({ url: target.toString(), key: process.env.PAGESPEED_API_KEY, strategy: device, category: "performance" }); for (const category of ["seo", "accessibility", "best-practices"]) query.append("category", category); const response = await fetch(`https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${query}`, { signal: AbortSignal.timeout(20_000), cache: "no-store" }); if (!response.ok) throw new Error(`PageSpeed respondió HTTP ${response.status}`); const json = await response.json(); type PsiAudit = { details?: { type?: string }; title?: string; displayValue?: string; score?: number | null; numericValue?: number }; const audits = (json.lighthouseResult?.audits ?? {}) as Record<string, PsiAudit>; const score = (category: string) => json.lighthouseResult?.categories?.[category]?.score == null ? null : Math.round(json.lighthouseResult.categories[category].score * 100); const numeric = (id: string) => Number.isFinite(audits[id]?.numericValue) ? audits[id].numericValue ?? null : null; return { performance: score("performance"), seo: score("seo"), accessibility: score("accessibility"), bestPractices: score("best-practices"), lcp: numeric("largest-contentful-paint"), cls: numeric("cumulative-layout-shift"), inp: numeric("interaction-to-next-paint"), tbt: numeric("total-blocking-time"), opportunities: Object.values(audits).filter((audit) => audit.details?.type === "opportunity" || audit.details?.type === "diagnostic").slice(0, 12).map((audit) => ({ title: audit.title || "Auditoría Lighthouse", displayValue: audit.displayValue || "", score: typeof audit.score === "number" ? Math.round(audit.score * 100) : null })) }; }
async function fetchCrux(target: URL, device: AuditDevice): Promise<AuditData["crux"] | null> {
  if (!process.env.CRUX_API_KEY) return null; const response = await fetch(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(process.env.CRUX_API_KEY)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ [target.pathname === "/" ? "origin" : "url"]: target.pathname === "/" ? target.origin : target.toString(), formFactor: device === "mobile" ? "PHONE" : "DESKTOP" }), signal: AbortSignal.timeout(12_000), cache: "no-store" }); if (!response.ok) { if (response.status === 404) return { formFactor: device, origin: target.origin, available: false, lcp: null, inp: null, cls: null, fcp: null, ttfb: null, message: "CrUX no tiene suficientes datos para esta URL/dispositivo." }; throw new Error(`CrUX respondió HTTP ${response.status}`); } const json = await response.json(); const metric = (name: string) => json.record?.metrics?.[name]?.percentiles?.p75 ?? null; return { formFactor: device, origin: target.origin, available: true, lcp: metric("largest_contentful_paint"), inp: metric("interaction_to_next_paint"), cls: metric("cumulative_layout_shift"), fcp: metric("first_contentful_paint"), ttfb: metric("experimental_time_to_first_byte") ?? metric("round_trip_time"), message: undefined }; }

export async function runAudit(targetValue: string, device: AuditDevice): Promise<AuditData> {
  const target = asUrl(targetValue || siteUrl()); const urls = await sitemapUrls(); const [crawlerResult, psiResult, cruxResult] = await Promise.allSettled([ownAudit(target), fetchPsi(target, device), fetchCrux(target, device)]); const crawler = crawlerResult.status === "fulfilled" ? crawlerResult.value : { httpStatus: null, title: null, metaDescription: null, headings: { h1: [], h2: [], h3: [] }, canonical: null, robotsMeta: null, openGraph: [], jsonLd: 0, internalLinks: 0, imagesWithoutAlt: 0, redirects: [], sitemap: "unavailable", robots: "unavailable", issues: [unavailableIssue("Salud técnica", "Auditor no disponible", "Timeout o error aislado", "Reintenta la auditoría.")], evidence: [] }; const psi = psiResult.status === "fulfilled" ? psiResult.value : null; const crux = cruxResult.status === "fulfilled" ? cruxResult.value : null; return { targetUrl: target.toString(), device, generatedAt: new Date().toISOString(), sources: { psi: psi ? "live" : "unavailable", crux: crux?.available ? "live" : "unavailable", crawler: crawler.httpStatus !== null || crawler.issues.some((issue) => issue.status === "open") ? "live" : "unavailable" }, psi: psi || { performance: null, seo: null, accessibility: null, bestPractices: null, lcp: null, cls: null, inp: null, tbt: null, opportunities: [] }, crux: crux || { formFactor: device, origin: target.origin, available: false, lcp: null, inp: null, cls: null, fcp: null, ttfb: null, message: process.env.CRUX_API_KEY ? "CrUX no devolvió datos." : "Configura CRUX_API_KEY para habilitar CrUX." }, crawler, sitemapUrls: urls };
}
