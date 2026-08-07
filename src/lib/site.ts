import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const SITE_URL = "https://www.whalemate.com/";
const timeoutMs = 7_000;
const maxBody = 2_000_000;

function siteHost() { return new URL(SITE_URL).hostname; }
export function siteUrl(value: string) {
  const parsed = new URL(value);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.hostname.toLowerCase() !== siteHost()) throw new Error("Destino externo bloqueado.");
  return parsed;
}
function privateAddress(address: string) {
  if (isIP(address) === 4) { const [a, b] = address.split(".").map(Number); return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168); }
  const value = address.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}
async function safe(url: URL) { const addresses = await lookup(url.hostname, { all: true }); if (addresses.some(({ address }) => privateAddress(address))) throw new Error("Destino privado bloqueado."); }
export async function fetchSite(url: URL, accept = "text/html") {
  let current = url;
  const redirects: string[] = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await safe(current);
    const response = await fetch(current, { redirect: "manual", headers: { accept, "user-agent": "WhaleMate-SEO-Audit/3.0" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if ([301, 302, 303, 307, 308].includes(response.status)) { const location = response.headers.get("location"); if (!location) return { response, body: "", redirects }; current = siteUrl(new URL(location, current).toString()); redirects.push(current.toString()); continue; }
    return { response, body: (await response.text()).slice(0, maxBody), redirects };
  }
  throw new Error("Límite de redirecciones alcanzado.");
}

export type SitemapData = { status: "live" | "unavailable" | "error"; urls: string[]; sitemaps: string[]; message?: string; fetchedAt: string };
const xmlEntities = (value: string) => value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");

export async function loadSitemap(): Promise<SitemapData> {
  const seen = new Set<string>(); const urls = new Set<string>(); const sitemaps: string[] = [];
  const visit = async (value: string, depth: number): Promise<void> => {
    if (depth > 2 || seen.has(value) || sitemaps.length >= 50) return;
    seen.add(value);
    try {
      const result = await fetchSite(siteUrl(value), "application/xml,text/xml");
      if (!result.response.ok) return;
      sitemaps.push(value);
      const locations = [...result.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => xmlEntities(match[1].trim()));
      if (/<sitemapindex\b/i.test(result.body)) for (const location of locations.slice(0, 50)) { try { await visit(siteUrl(location).toString(), depth + 1); } catch { /* Ignore entries outside the fixed site. */ } }
      else locations.forEach((location) => { try { urls.add(siteUrl(location).toString()); } catch { /* Ignore entries outside the fixed site. */ } });
    } catch { /* The final status below reports the unavailable source. */ }
  };
  await visit(new URL("/sitemap-index.xml", SITE_URL).toString(), 0);
  if (!sitemaps.length) await visit(new URL("/sitemap.xml", SITE_URL).toString(), 0);
  return { status: sitemaps.length ? "live" : "unavailable", urls: [...urls].slice(0, 1_000), sitemaps, message: sitemaps.length ? undefined : "No se pudo descargar sitemap-index.xml ni sitemap.xml.", fetchedAt: new Date().toISOString() };
}
