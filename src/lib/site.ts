import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const SITE_URL = "https://www.whalemate.com/";
const timeoutMs = 10_000;
const maxBody = 2_000_000;

function siteHost() { return new URL(SITE_URL).hostname; }
export function siteUrl(value: string) {
  const parsed = new URL(value);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.port || parsed.hostname.toLowerCase() !== siteHost()) throw new Error("Destino externo bloqueado.");
  parsed.hash = "";
  return parsed;
}
function privateAddress(address: string) {
  if (isIP(address) === 4) { const [a, b] = address.split(".").map(Number); return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168); }
  const value = address.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}
async function safe(url: URL) { const addresses = await lookup(url.hostname, { all: true }); if (addresses.some(({ address }) => privateAddress(address))) throw new Error("Destino privado bloqueado."); }
export async function readBoundedBody(response: Response, limit = maxBody) {
  if (!response.body) return { body: "", bodyTruncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  let bodyTruncated = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const available = Math.max(0, limit - bytes);
      body += decoder.decode(value.subarray(0, available), { stream: true });
      bytes += value.byteLength;
      if (bytes > limit) { bodyTruncated = true; await reader.cancel(); break; }
    }
    body += decoder.decode();
  } finally { reader.releaseLock(); }
  return { body, bodyTruncated };
}

export async function fetchSite(url: URL, accept = "text/html", allowRedirect?: (url: string) => boolean, conditional?: { etag?: string; lastModified?: string }) {
  let current = siteUrl(url.toString());
  const redirects: string[] = [];
  const seen = new Set<string>();
  const started = Date.now();
  const signal = AbortSignal.timeout(timeoutMs);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (seen.has(current.toString())) throw new Error("Bucle de redirecciones.");
    if (redirects.length && allowRedirect && !allowRedirect(current.toString())) throw new Error("Destino de redirección bloqueado por robots.txt.");
    seen.add(current.toString());
    await safe(current);
    const headers: Record<string, string> = { accept, "user-agent": "WhaleMate-SEO-Audit/4.0" };
    if (attempt === 0 && conditional?.etag) headers["If-None-Match"] = conditional.etag;
    if (attempt === 0 && conditional?.lastModified) headers["If-Modified-Since"] = conditional.lastModified;
    const response = await fetch(current, { redirect: "manual", headers, signal, cache: "no-store" });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get("location")) {
      await response.body?.cancel();
      current = siteUrl(new URL(response.headers.get("location")!, current).toString());
      redirects.push(current.toString());
      continue;
    }
    const contentType = response.headers.get("content-type") || "";
    const isDocument = !contentType || /html|xml|text\/plain/i.test(contentType);
    const body = isDocument ? await readBoundedBody(response) : { body: "", bodyTruncated: false };
    if (!isDocument) await response.body?.cancel();
    return { response, ...body, redirects, finalUrl: current.toString(), durationMs: Date.now() - started };
  }
  throw new Error("Límite de redirecciones alcanzado.");
}

export type SitemapData = { status: "live" | "partial" | "unavailable" | "error"; urls: string[]; sitemaps: string[]; message?: string; fetchedAt: string };
const xmlEntities = (value: string) => value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");

export async function loadSitemap(extraSitemaps: string[] = []): Promise<SitemapData> {
  const { load } = await import("cheerio");
  const deadline = Date.now() + 45_000;
  let incomplete = false;
  const seen = new Set<string>(); const urls = new Set<string>(); const sitemaps: string[] = [];
  const visit = async (value: string, depth: number): Promise<void> => {
    if (seen.has(value)) return;
    if (depth > 4 || seen.size >= 50 || Date.now() >= deadline) { incomplete = true; return; }
    seen.add(value);
    try {
      const result = await fetchSite(siteUrl(value), "application/xml,text/xml");
      if (!result.response.ok || result.bodyTruncated) { incomplete = true; return; }
      sitemaps.push(value);
      const $ = load(result.body, { xml: true });
      const locations = $("sitemapindex > sitemap > loc, urlset > url > loc").toArray().map((node) => xmlEntities($(node).text().trim()));
      if ($("sitemapindex").length) for (const location of locations) { try { await visit(siteUrl(location).toString(), depth + 1); } catch { incomplete = true; } }
      else locations.forEach((location) => { try { urls.add(siteUrl(location).toString()); } catch { /* Ignore entries outside the fixed site. */ } });
    } catch { incomplete = true; }
  };
  for (const value of extraSitemaps) { try { await visit(siteUrl(value).toString(), 0); } catch { incomplete = true; } }
  await visit(new URL("/sitemap-index.xml", SITE_URL).toString(), 0);
  if (!sitemaps.length) await visit(new URL("/sitemap.xml", SITE_URL).toString(), 0);
  return { status: sitemaps.length ? incomplete ? "partial" : "live" : "unavailable", urls: [...urls], sitemaps, message: sitemaps.length ? incomplete ? "Hay sitemaps no descargados, truncados o fuera del límite de profundidad/documentos." : undefined : "No se pudo descargar sitemap-index.xml ni sitemap.xml.", fetchedAt: new Date().toISOString() };
}
