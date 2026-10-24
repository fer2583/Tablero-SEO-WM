import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { buildAuditSnapshot } from "../src/lib/audit";
import { emptyPage, parsePage } from "../src/lib/crawler/engine";
import { RULES_VERSION, type CrawlState, type RunStatus } from "../src/lib/crawler/types";
import { SITE_URL } from "../src/lib/site";

test("dashboard starts, pauses, resumes, displays findings and URL detail on desktop/mobile", { timeout: 90_000 }, async () => {
  const state: CrawlState = { version: RULES_VERSION, config: { maxUrls: 100, batchSize: 1, concurrency: 1, maxDepth: 10, maxQueryUrls: 10 }, robots: { status: "live", text: "", fetchedAt: new Date().toISOString() }, sitemap: { status: "live", urls: [SITE_URL, `${SITE_URL}broken`], sitemaps: [], fetchedAt: new Date().toISOString() }, queue: [{ url: SITE_URL, sources: ["home", "sitemap"], attempts: 0 }, { url: `${SITE_URL}broken`, sources: ["sitemap"], attempts: 0 }], pages: [], known: [SITE_URL, `${SITE_URL}broken`], excluded: [], limitReached: false, traffic: {}, previousIssues: [] };
  let status: RunStatus = "queued";
  let batches = 0;
  let performance: "pending" | "running" | "completed" = "pending";
  let forced = false;
  const view = () => {
    const snapshot = buildAuditSnapshot(state);
    if (performance !== "pending") snapshot.performanceTask = { status: performance, url: SITE_URL, startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 180_000).toISOString() };
    if (performance === "completed") {
      for (const device of ["mobile", "desktop"] as const) {
        snapshot.devices[device].psi = { status: "live", url: SITE_URL, fetchedAt: new Date().toISOString(), scores: { performance: device === "mobile" ? 55 : 68, accessibility: 96, seo: 100, bestPractices: 92 }, metrics: { lcp: 18000, cls: 0.02, tbt: 369, fcp: 3000 }, opportunities: [] };
        snapshot.devices[device].crux = { ...snapshot.devices[device].crux, diagnostic: { code: "no_data", retryable: false, httpStatus: 404 }, message: "Google no tiene datos suficientes.", fetchedAt: new Date().toISOString() };
      }
    }
    return { id: 1, status, startedAt: new Date().toISOString(), completedAt: status === "completed" ? new Date().toISOString() : null, progress: { processed: state.pages.length, pending: state.queue.length, html: state.pages.filter((page) => page.outcome === "html").length, failed: 0, blocked: 0, excluded: 0, limitReached: false }, config: state.config, rulesVersion: RULES_VERSION, snapshot, browserReports: [] };
  };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/audit") return route.fulfill({ json: { snapshot: null, activeRun: null, latestRunId: null, history: [] } });
    if (pathname === "/api/audit/runs") return route.fulfill({ json: view() });
    if (pathname.endsWith("/process")) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      batches++;
      const next = state.queue.shift()!;
      if (batches === 1) {
        const html = parsePage(`<html lang="es"><head><title>Home</title><meta name="description" content="Home description"></head><body><main><h1>Home</h1><a href="/broken">Enlace roto</a></main></body></html>`, SITE_URL);
        state.pages.push({ ...html, httpStatus: 200, sources: next.sources });
      } else state.pages.push({ ...emptyPage(next.url, next.sources), outcome: "http_error", httpStatus: 404 });
      status = state.queue.length ? "running" : "completed";
      if (status === "completed") performance = "running";
      return route.fulfill({ json: view() });
    }
    if (pathname.endsWith("/actions")) {
      const action = route.request().postDataJSON().action;
      status = action === "pause" ? "paused" : action === "resume" ? "queued" : "cancelled";
      return route.fulfill({ json: view() });
    }
    if (pathname.endsWith("/enrich")) { forced = route.request().postDataJSON().force === true; performance = "running"; return route.fulfill({ status: 202, json: view() }); }
    if (pathname === "/api/audit/runs/1") { performance = "completed"; return route.fulfill({ json: view() }); }
    return route.fulfill({ json: { status: "no_data", data: null } });
  });
  try {
    await page.goto(`${process.env.AUDIT_UI_URL || "http://localhost:3001"}/auditoria-tecnica`);
    await page.getByText("Todavía no hay una auditoría", { exact: true }).waitFor();
    const started = page.waitForRequest((request) => request.url().endsWith("/process"));
    await page.getByRole("button", { name: "Auditar sitio", exact: true }).click();
    await started;
    await page.getByRole("button", { name: "Pausar al terminar el lote" }).click();
    await page.getByText("Corrida #1 · paused", { exact: true }).waitFor();
    assert.equal(batches, 1);
    await page.getByRole("button", { name: "Reanudar", exact: true }).click();
    await page.getByText("Corrida #1 · completed", { exact: true }).waitFor();
    assert.equal(batches, 2);
    await page.locator('[aria-label="Performance Mobile: 55 de 100"]').waitFor();
    await page.locator('[aria-label="Performance Desktop: 68 de 100"]').waitFor();
    await page.getByText("Google no tiene datos de campo suficientes", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Rendimiento", exact: true }).click();
    await page.getByRole("button", { name: "Repetir tests sin caché", exact: true }).click();
    await page.getByRole("button", { name: "Consultar PageSpeed y CWV", exact: true }).waitFor();
    assert.equal(forced, true);
    await page.getByLabel("Dispositivo", { exact: true }).selectOption("desktop");
    await page.locator('[aria-label="Performance Desktop: 68 de 100"]').waitFor();
    await page.getByRole("button", { name: "Issues", exact: true }).click();
    await page.getByText("Respuesta HTTP de error", { exact: false }).first().waitFor();
    await page.getByRole("button", { name: "Páginas", exact: true }).click();
    await page.getByRole("button", { name: SITE_URL, exact: true }).click();
    await page.getByText("Enlaces entrantes", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Guardar filtros", exact: true }).click();
    assert.ok(await page.evaluate(() => localStorage.getItem("audit-pages-filters-v1")));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.getByRole("button", { name: "Experiencia", exact: true }).click();
    await page.getByText("Sin escenarios ejecutados", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
