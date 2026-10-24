import { createHash } from "node:crypto";
import { load } from "cheerio";
import robotsParser from "robots-parser";
import { fetchSite, loadSitemap, SITE_URL, siteUrl } from "../site";
import { crawlConfig, RULES_VERSION, type CrawlConfig, type CrawlPage, type CrawlState, type QueueEntry, type RobotsPolicy } from "./types";
import ruleConfig from "../../../audit.rules.config";

const USER_AGENT = "WhaleMate-SEO-Audit";
export const normalizeUrl = (value: string, base = SITE_URL) => siteUrl(new URL(value, base).toString()).toString();
export function pageLanguage(url: string) { return /^\/(br|pt)(\/|$)/i.test(new URL(url).pathname) ? "PT-BR" : /^\/en(\/|$)/i.test(new URL(url).pathname) ? "EN" : "ES"; }
export function pageTemplate(url: string) {
  const path = new URL(url).pathname.replace(/^\/(en|br|pt)(?=\/|$)/, "") || "/";
  return path === "/" ? "Home" : /blog|insights|news/i.test(path) ? "Blog" : /glossary|glosario|glossario/i.test(path) ? "Glosario" : /jobs|careers|vacan/i.test(path) ? "Jobs" : /servic|soluc/i.test(path) ? "Servicio" : "Page";
}
export function retryDate(value: string | null, now = Date.now()) {
  const seconds = Number(value);
  const parsed = value && !Number.isFinite(seconds) ? Date.parse(value) : now + (value ? Math.max(1, seconds) : 30) * 1000;
  return new Date(Number.isFinite(parsed) ? Math.max(now + 1000, parsed) : now + 30_000).toISOString();
}
export async function readRobots(cached?: RobotsPolicy, transport = fetchSite): Promise<RobotsPolicy> {
  const fetchedAt = new Date().toISOString();
  try {
    const result = await transport(new URL("/robots.txt", SITE_URL), "text/plain");
    if ([404, 410].includes(result.response.status)) return { status: "live", text: "", fetchedAt, message: "Robots inexistente: no hay restricciones declaradas." };
    if (result.response.ok && !result.bodyTruncated) return { status: "live", text: result.body, fetchedAt };
    if (result.response.status >= 400 && result.response.status < 500 && result.response.status !== 429) return { status: "unavailable", text: "", fetchedAt, message: `Robots HTTP ${result.response.status}; requiere revisión antes de rastrear.` };
    if (cached && cached.status !== "unavailable" && Date.now() - Date.parse(cached.fetchedAt) < 86_400_000) return { ...cached, status: "partial", message: "Robots temporalmente inaccesible; se usa la última política válida (<24 h)." };
    return { status: "unavailable", text: "", fetchedAt, retryAt: retryDate(result.response.headers.get("retry-after")), message: `Robots HTTP ${result.response.status}. Auditoría pausada.` };
  } catch {
    if (cached && cached.status !== "unavailable" && Date.now() - Date.parse(cached.fetchedAt) < 86_400_000) return { ...cached, status: "partial", message: "Error de red en robots; política válida en caché (<24 h)." };
    return { status: "unavailable", text: "", fetchedAt, retryAt: retryDate(null), message: "No se pudo leer robots.txt. Auditoría pausada." };
  }
}
export function robotsAllows(policy: RobotsPolicy, url: string) {
  return policy.status !== "unavailable" && robotsParser(new URL("/robots.txt", SITE_URL).toString(), policy.text).isAllowed(url, USER_AGENT) !== false;
}
export function emptyPage(url: string, sources: string[] = []): CrawlPage {
  return { url, language: pageLanguage(url), template: pageTemplate(url), httpStatus: null, title: null, metaDescription: null, h1: [], h2: [], h3: [], canonical: null, canonicals: [], robotsMeta: null, xRobotsTag: null, openGraph: null, jsonLd: 0, schemaEntities: 0, schemaTypes: [], parseErrors: [], internalLinks: null, imagesWithoutAlt: null, redirects: [], status: "unavailable", outcome: "network_error", finalUrl: url, durationMs: 0, bodyTruncated: false, links: [], hreflang: [], wordCount: 0, contentHash: null, depth: null, sources, indexable: null, attempts: 1 };
}
export function noindexHeader(value: string | null) {
  let scope = "*";
  return (value || "").split(",").some((part) => {
    const match = part.trim().match(/^([a-z0-9*_-]+):\s*(.*)$/i);
    if (match) scope = match[1].toLowerCase();
    return ["*", "googlebot"].includes(scope) && /\b(noindex|none)\b/i.test(match ? match[2] : part);
  });
}
export function parsePage(html: string, url: string): CrawlPage {
  const page = emptyPage(url);
  const $ = load(html);
  const texts = (selector: string) => $(selector).toArray().map((node) => $(node).text().replace(/\s+/g, " ").trim()).filter(Boolean);
  let base = url;
  try { if ($("base[href]").first().attr("href")) base = new URL($("base[href]").first().attr("href")!, url).toString(); } catch { /* Invalid base ignored. */ }
  const absolute = (value: string) => { try { const target = new URL(value, base); if (!/^https?:$/.test(target.protocol)) return ""; target.hash = ""; return target.toString(); } catch { return ""; } };
  const links = new Map<string, CrawlPage["links"][number]>();
  $("a[href]").each((_, node) => {
    const value = $(node).attr("href") || "";
    if (!value || value.startsWith("#")) return;
    try { const target = normalizeUrl(value, base); if (!links.has(target)) links.set(target, { url: target, text: $(node).text().replace(/\s+/g, " ").trim().slice(0, 250), nofollow: /\bnofollow\b/i.test($(node).attr("rel") || "") }); } catch { /* External links are outside this crawler's scope. */ }
  });
  const types = new Set<string>();
  let entities = 0;
  const parseErrors: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const object = node as Record<string, unknown>;
    if (object["@type"]) { entities++; for (const value of [object["@type"]].flat()) if (typeof value === "string") types.add(value); }
    Object.values(object).forEach((value) => { if (typeof value === "object") walk(value); });
  };
  const scripts = $("script").filter((_, node) => ($(node).attr("type") || "").toLowerCase().split(";")[0].trim() === "application/ld+json");
  scripts.each((index, node) => { try { walk(JSON.parse($(node).text())); } catch { parseErrors.push(`Bloque JSON-LD ${index + 1}: JSON inválido.`); } });
  const canonicals = $("link[rel]").filter((_, node) => /\bcanonical\b/i.test($(node).attr("rel") || "")).toArray().map((node) => absolute($(node).attr("href") || "")).filter(Boolean);
  const robots = $("meta[name]").filter((_, node) => /^(robots|googlebot)$/i.test($(node).attr("name") || "")).toArray().map((node) => $(node).attr("content") || "").join(", ") || null;
  const hreflang = $("link[hreflang][href]").toArray().map((node) => ({ language: $(node).attr("hreflang") || "", url: absolute($(node).attr("href") || "") })).filter((item) => item.url);
  const declaredLanguage = $("html").attr("lang");
  const h1 = texts("h1"), h2 = texts("h2"), h3 = texts("h3");
  const imagesWithoutAlt = $("img:not([alt])").length;
  $("script, style, nav, header, footer, aside, noscript, template").remove();
  const main = $("main, [role='main'], article").first();
  const contentRoot = main.length ? main : $("body");
  const content = contentRoot.find("*").addBack().contents().toArray().filter((node) => node.type === "text").map((node) => "data" in node ? node.data : "").join(" ").replace(/\s+/g, " ").trim();
  const errorPageHint = [texts("title")[0] || "", ...h1].find((value) => /^(?:404(?:\b|\s)|page not found|p[aá]gina (?:no encontrada|n[aã]o encontrada|n[aã]o existe)|not found\b)/i.test(value));
  return { ...page, language: declaredLanguage ? declaredLanguage.toLowerCase().startsWith("pt") ? "PT-BR" : declaredLanguage.toLowerCase().startsWith("en") ? "EN" : declaredLanguage.toLowerCase().startsWith("es") ? "ES" : declaredLanguage : page.language,
    title: texts("title")[0] || null, metaDescription: $("meta[name]").filter((_, node) => ($(node).attr("name") || "").toLowerCase() === "description").first().attr("content")?.trim() || null,
    h1, h2, h3, canonical: canonicals[0] || null, canonicals, robotsMeta: robots,
    openGraph: $("meta[property^='og:'], meta[name^='og:']").length, jsonLd: scripts.length, schemaEntities: entities, schemaTypes: [...types], parseErrors,
    internalLinks: links.size, imagesWithoutAlt, links: [...links.values()], hreflang,
    wordCount: content ? content.split(/\s+/).length : 0, contentHash: content ? createHash("sha256").update(content).digest("hex") : null, errorPageHint,
    status: "live", outcome: "html", indexable: !/\b(noindex|none)\b/i.test(robots || "") };
}
export async function fetchPage(entry: QueueEntry, policy: RobotsPolicy, previous?: CrawlPage, transport = fetchSite): Promise<CrawlPage> {
  const base = { ...emptyPage(entry.url, entry.sources), attempts: entry.attempts + 1 };
  if (policy.status === "unavailable") return { ...base, outcome: "robots_unavailable", error: policy.message };
  if (!robotsAllows(policy, entry.url)) return { ...base, outcome: "blocked", status: "partial", error: "Excluida por robots.txt." };
  const started = Date.now();
  try {
    const reusable = previous?.outcome === "html" && !previous.redirects.length ? previous : undefined;
    const result = await transport(siteUrl(entry.url), "text/html", (target) => robotsAllows(policy, target), reusable);
    if (result.response.status === 304 && reusable) {
      const xRobotsTag = result.response.headers.get("x-robots-tag") ?? reusable.xRobotsTag;
      return { ...reusable, xRobotsTag, indexable: !/\b(noindex|none)\b/i.test(reusable.robotsMeta || "") && !noindexHeader(xRobotsTag), sources: entry.sources, attempts: base.attempts, durationMs: result.durationMs, revalidated: true };
    }
    const mime = result.response.headers.get("content-type") || "";
    const common = { httpStatus: result.response.status, redirects: result.redirects, durationMs: result.durationMs, finalUrl: result.finalUrl, bodyTruncated: result.bodyTruncated };
    if (!result.response.ok) return { ...base, ...common, status: "error", outcome: "http_error", error: `HTTP ${result.response.status}`, retryAt: [429, 503].includes(result.response.status) ? retryDate(result.response.headers.get("retry-after")) : undefined };
    if (!/\b(text\/html|application\/xhtml\+xml)\b/i.test(mime)) return { ...base, ...common, status: "partial", outcome: "non_html", error: `Contenido no HTML: ${mime || "sin Content-Type"}` };
    if (result.bodyTruncated) return { ...base, ...common, status: "partial", outcome: "truncated", error: "HTML supera el límite de 2 MB; no se evalúan metadatos incompletos." };
    const page = parsePage(result.body, result.finalUrl);
    const xRobotsTag = result.response.headers.get("x-robots-tag");
    return { ...page, ...common, url: entry.url, sources: entry.sources, attempts: base.attempts, xRobotsTag, etag: result.response.headers.get("etag") || undefined, lastModified: result.response.headers.get("last-modified") || undefined, indexable: page.indexable && !noindexHeader(xRobotsTag) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de red";
    const timeout = /timeout|abort/i.test(message);
    return { ...base, outcome: timeout ? "timeout" : "network_error", error: message, durationMs: Date.now() - started };
  }
}
export function enqueue(state: CrawlState, value: string, source: string) {
  let url: string;
  try { url = normalizeUrl(value); } catch { return; }
  const pending = state.queue.find((item) => item.url === url);
  const page = state.pages.find((item) => item.url === url);
  if (pending || page) { const sources = (pending || page)!.sources; if (!sources.includes(source)) sources.push(source); return; }
  if (state.known.includes(url)) return;
  state.known.push(url);
  const parsed = new URL(url);
  const reason = /\.(pdf|jpg|jpeg|png|webp|gif|svg|zip|mp4|css|js|woff2?)$/i.test(parsed.pathname) ? "Recurso no HTML" : state.queue.length + state.pages.length >= state.config.maxUrls ? "Límite de URLs" : parsed.search && state.known.filter((value) => new URL(value).search).length > state.config.maxQueryUrls ? "Límite de URLs con parámetros" : null;
  if (reason) { if (reason.startsWith("Límite")) state.limitReached = true; state.excluded.push({ url, reason }); return; }
  state.queue.push({ url, sources: [source], attempts: 0 });
}
export async function initializeCrawl(config: CrawlConfig = crawlConfig(), cachedRobots?: RobotsPolicy): Promise<CrawlState> {
  const robots = await readRobots(cachedRobots);
  const sitemaps = robotsParser(new URL("/robots.txt", SITE_URL).toString(), robots.text).getSitemaps();
  const sitemap = await loadSitemap(sitemaps);
  const state: CrawlState = { version: RULES_VERSION, ruleConfig: structuredClone(ruleConfig), config, robots, sitemap, queue: [], pages: [], known: [], excluded: [], limitReached: false, previousIssues: [], traffic: {} };
  enqueue(state, SITE_URL, "home");
  sitemap.urls.forEach((url) => enqueue(state, url, "sitemap"));
  return state;
}
export async function processBatch(state: CrawlState, fetcher = fetchPage) {
  if (state.robots.status === "unavailable") { state.message = state.robots.message; state.retryAt = state.robots.retryAt; return state; }
  state.retryAt = undefined;
  state.message = undefined;
  let processed = 0;
  const deadline = Date.now() + 50_000;
  while (state.queue.length && processed < state.config.batchSize && Date.now() < deadline) {
    const selected = state.queue.splice(0, Math.min(state.config.concurrency, state.config.batchSize - processed));
    const pages = await Promise.all(selected.map((entry) => fetcher(entry, state.robots, state.config.incremental ? state.previousPages?.[entry.url] : undefined)));
    pages.forEach((page, index) => {
      processed++;
      if ((page.retryAt || ["timeout", "network_error"].includes(page.outcome)) && page.attempts < 3) {
        state.queue.push({ ...selected[index], attempts: page.attempts });
        const retryAt = page.retryAt || retryDate("5");
        state.retryAt = !state.retryAt || retryAt > state.retryAt ? retryAt : state.retryAt;
        state.message = "Error transitorio: espera antes de reanudar el próximo lote.";
        return;
      }
      page.traffic = state.traffic[page.url];
      const parents = state.pages.filter((parent) => parent.depth != null && parent.links.some((link) => link.url === page.url));
      page.depth = parents.length ? Math.min(...parents.map((parent) => parent.depth! + 1)) : null;
      state.pages.push(page);
      if (page.url === SITE_URL) page.depth = 0;
      if (page.outcome === "html" && state.scope !== "selective") for (const link of page.links) {
        if (page.depth != null && page.depth >= state.config.maxDepth) {
          if (!state.known.includes(link.url)) { state.limitReached = true; state.excluded.push({ url: link.url, reason: "Límite de profundidad" }); state.known.push(link.url); }
        } else enqueue(state, link.url, "link");
      }
    });
    const throttledUntil = pages.map((page) => page.retryAt).filter((value): value is string => !!value).sort().at(-1);
    if (throttledUntil && state.queue.length) {
      state.retryAt = [state.retryAt || "", throttledUntil].sort().at(-1);
      state.message = "El servidor solicitó reducir el ritmo. Reanudar después de Retry-After.";
    }
    if (state.retryAt) break;
  }
  return state;
}
