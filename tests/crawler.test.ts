import test from "node:test";
import assert from "node:assert/strict";
import { emptyPage, enqueue, fetchPage, normalizeUrl, noindexHeader, parsePage, processBatch, readRobots, retryDate, robotsAllows } from "../src/lib/crawler/engine";
import { evaluateCrawl } from "../src/lib/crawler/rules";
import { readBoundedBody, SITE_URL } from "../src/lib/site";
import { RULES_VERSION, type CrawlState } from "../src/lib/crawler/types";

export function state(): CrawlState {
  return { version: RULES_VERSION, config: { maxUrls: 100, batchSize: 25, concurrency: 4, maxDepth: 10, maxQueryUrls: 10 }, robots: { status: "live", text: "User-agent: *\nDisallow: /private/\nAllow: /private/public", fetchedAt: new Date().toISOString() }, sitemap: { status: "live", urls: [], sitemaps: [], fetchedAt: new Date().toISOString() }, queue: [], known: [], excluded: [], pages: [], limitReached: false, traffic: {}, previousIssues: [] };
}
test("HTML parser handles attribute order, entities, PT-BR, nested JSON-LD and decorative images", () => {
  const page = parsePage(`<html lang="pt-BR"><head><title>A &amp; B</title><meta content="Descrição" name="description"><link href="/br/" rel="canonical"><script type="application/ld+json">{"@graph":[{"@type":["Organization","Thing"],"address":{"@type":"PostalAddress"}}]}</script></head><body><header><h1>Principal</h1></header><nav>Navigation repeated</nav><main><p>Conteúdo principal</p><img alt=""><img src="x"><a href="/br/item#details">Item</a><a href="/br/item">Duplicado</a><a href="https://external.example/">Externo</a></main></body></html>`, `${SITE_URL}br/`);
  assert.equal(page.title, "A & B"); assert.equal(page.metaDescription, "Descrição");
  assert.equal(page.language, "PT-BR"); assert.deepEqual(page.h1, ["Principal"]);
  assert.equal(page.canonical, `${SITE_URL}br/`); assert.equal(page.jsonLd, 1); assert.equal(page.schemaEntities, 2);
  assert.deepEqual(page.schemaTypes.sort(), ["Organization", "PostalAddress", "Thing"]);
  assert.equal(page.imagesWithoutAlt, 1); assert.equal(page.links.length, 1);
  assert.equal(page.links[0].url, `${SITE_URL}br/item`); assert.equal(page.wordCount, 5);
});
test("normalization preserves path case and trailing slash and rejects external/private destinations", () => {
  assert.equal(normalizeUrl("/Case/#anchor"), `${SITE_URL}Case/`);
  assert.notEqual(normalizeUrl("/Case"), normalizeUrl("/case/"));
  for (const value of ["http://127.0.0.1/", "https://www.whalemate.com:444/", "https://www.whalemate.com.evil.example/", "file:///etc/passwd"]) assert.throws(() => normalizeUrl(value));
});
test("X-Robots-Tag respects user-agent scopes", () => {
  assert.equal(noindexHeader("noindex, nofollow"), true);
  assert.equal(noindexHeader("otherbot: noindex, nofollow"), false);
  assert.equal(noindexHeader("otherbot: noindex, googlebot: index"), false);
  assert.equal(noindexHeader("otherbot: index, googlebot: noindex"), true);
});
test("versioned exceptions remain visible and never count as passed evaluations", () => {
  const data = state();
  data.pages = [parsePage("<h1>Sin title</h1>", SITE_URL)];
  data.ruleConfig = { version: "test", titleWarningLength: 60, shortEditorialWords: 150, disabled: [], exceptions: [{ rule: "title", url: SITE_URL, reason: "Excepción temporal aprobada", expiresAt: "2099-01-01T00:00:00Z" }] };
  const report = evaluateCrawl(data);
  assert.equal(report.exceptions.length, 1); assert.equal(report.rules.find((rule) => rule.rule === "title")!.eligible, 0);
  assert.equal(report.issues.some((issue) => issue.rule === "title"), false);
});
test("robots rules support specific Allow and unknown policies never authorize crawling", () => {
  const policy = state().robots;
  assert.equal(robotsAllows(policy, `${SITE_URL}private/secret`), false);
  assert.equal(robotsAllows(policy, `${SITE_URL}private/public`), true);
  assert.equal(robotsAllows({ ...policy, status: "unavailable" }, SITE_URL), false);
});
test("robots 404 permits crawling; transient failures use only fresh valid cache", async () => {
  const response = (status: number) => async () => ({ response: new Response(null, { status }), body: "", bodyTruncated: false, finalUrl: `${SITE_URL}robots.txt`, redirects: [], durationMs: 1 });
  assert.equal((await readRobots(undefined, response(404))).status, "live");
  assert.equal((await readRobots(state().robots, response(503))).status, "partial");
  assert.equal((await readRobots({ ...state().robots, fetchedAt: "2000-01-01T00:00:00Z" }, response(503))).status, "unavailable");
});
test("conditional 304 reuses HTML but applies updated X-Robots-Tag", async () => {
  const page = { ...parsePage("<title>Original</title><h1>Original</h1>", SITE_URL), etag: '"v1"', httpStatus: 200 };
  let sentEtag: string | undefined;
  const updated = await fetchPage({ url: SITE_URL, sources: ["sitemap"], attempts: 0 }, state().robots, page, async (_url, _accept, _allowed, conditional) => {
    sentEtag = conditional?.etag;
    return { response: new Response(null, { status: 304, headers: { "x-robots-tag": "noindex" } }), body: "", bodyTruncated: false, redirects: [], finalUrl: SITE_URL, durationMs: 2 };
  });
  assert.equal(sentEtag, '"v1"'); assert.equal(updated.title, "Original"); assert.equal(updated.revalidated, true); assert.equal(updated.indexable, false);
});
test("bounded reader stops download and flags truncation without parsing partial JSON-LD", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("abcdef")); }, cancel() { cancelled = true; } }));
  assert.deepEqual(await readBoundedBody(response, 3), { body: "abc", bodyTruncated: true });
  assert.equal(cancelled, true);
});
test("crawl exceeds old 20/50 limit, deduplicates, resumes batches and discovers links", async () => {
  const data = state();
  for (let index = 0; index < 60; index++) enqueue(data, `${SITE_URL}page-${index}`, "sitemap");
  enqueue(data, `${SITE_URL}page-0#x`, "history");
  assert.equal(data.queue.length, 60);
  const fetcher = async (entry: typeof data.queue[number]) => ({ ...emptyPage(entry.url, entry.sources), outcome: "html" as const, status: "live" as const, attempts: 1, links: [{ url: `${SITE_URL}discovered`, text: "new", nofollow: false }] });
  await processBatch(data, fetcher); assert.equal(data.pages.length, 25); assert.equal(data.queue.length, 36);
  const restored = JSON.parse(JSON.stringify(data)) as CrawlState;
  while (restored.queue.length) await processBatch(restored, fetcher);
  assert.equal(restored.pages.length, 61); assert.equal(new Set(restored.pages.map((page) => page.url)).size, 61);
  assert.deepEqual(restored.pages[0].sources, ["sitemap", "history"]);
});
test("429 pauses and retries at Retry-After without publishing a success", async () => {
  const data = state(); enqueue(data, SITE_URL, "home");
  const retryAt = retryDate("60");
  await processBatch(data, async (entry) => ({ ...emptyPage(entry.url, entry.sources), attempts: entry.attempts + 1, httpStatus: 429, outcome: "http_error", retryAt }));
  assert.equal(data.pages.length, 0); assert.equal(data.queue[0].attempts, 1); assert.equal(data.retryAt, retryAt);
  assert.equal(evaluateCrawl(data).score, null);
});
test("limits stay visible and selective audits do not discover more URLs", async () => {
  const data = state(); data.config.maxUrls = 1;
  enqueue(data, SITE_URL, "home"); enqueue(data, `${SITE_URL}other`, "sitemap");
  assert.equal(data.excluded[0].reason, "Límite de URLs"); assert.equal(data.limitReached, true);
  data.scope = "selective";
  await processBatch(data, async (entry) => ({ ...emptyPage(entry.url), attempts: 1, outcome: "html", links: [{ url: `${SITE_URL}new`, text: "", nofollow: false }] }));
  assert.equal(data.queue.length, 0);
});
test("HTTP failures do not cascade into missing metadata, and coverage excludes failed HTML", () => {
  const data = state();
  data.pages = [{ ...emptyPage(SITE_URL, ["sitemap"]), httpStatus: 404, outcome: "http_error", error: "HTTP 404" }];
  const report = evaluateCrawl(data);
  assert.deepEqual(report.issues.map((issue) => issue.rule), ["http"]);
  assert.equal(report.coverage, 0);
});
test("possible soft 404 is a review finding rather than a claimed Google verdict", () => {
  const data = state();
  data.pages = [{ ...parsePage("<title>Página no encontrada</title><h1>404</h1>", SITE_URL), httpStatus: 200 }];
  const report = evaluateCrawl(data);
  assert.equal(report.issues.find((issue) => issue.rule === "soft-404")?.evaluation, "review");
  assert.equal(report.rules.find((rule) => rule.rule === "soft-404")?.weight, 0);
});
test("canonical consolidation, empty ALT and short service text are not treated as errors", () => {
  const data = state();
  const page = parsePage(`<html lang="es"><head><title>Servicio</title><meta name="description" content="Descripción"><link rel="canonical" href="${SITE_URL}consolidated"></head><body><h1>Servicio</h1><img alt=""><main>Breve</main></body></html>`, `${SITE_URL}servicios/test`);
  page.httpStatus = 200; data.pages = [page];
  const report = evaluateCrawl(data);
  assert.equal(report.issues.some((issue) => ["canonical-invalid", "alt", "short-content"].includes(issue.rule)), false);
});
test("comparison resolves only evaluated rules and keeps unavailable pages unevaluated", () => {
  const data = state(); const good = parsePage("<title>Bueno</title><meta name='description' content='Descripción'><h1>Bueno</h1>", SITE_URL);
  good.httpStatus = 200; data.pages = [good, { ...emptyPage(`${SITE_URL}failed`), outcome: "timeout" }];
  data.previousIssues = [SITE_URL, `${SITE_URL}failed`].map((url) => ({ id: `title:${url}`, rule: "title", url, category: "Metadatos", issue: "Title ausente", severity: "Media", evidence: "", recommendation: "", status: "open", evaluation: "automatic" }));
  const report = evaluateCrawl(data);
  assert.deepEqual(report.comparison.resolved, [`title:${SITE_URL}`]);
  assert.deepEqual(report.comparison.unevaluated, [`title:${SITE_URL}failed`]);
});
