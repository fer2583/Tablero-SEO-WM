import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";
import { PNG } from "pngjs";
import { compareScreenshots, runBrowserAudit, selectScenarios } from "../src/lib/browser-audit/runner";
import { emptyPage } from "../src/lib/crawler/engine";
import { CRITERIA_VERSION, type BrowserCriteria } from "../src/lib/browser-audit/types";

test("visual comparison distinguishes pixel and dimension changes", async () => {
  const image = new PNG({ width: 2, height: 2 }); image.data.fill(255);
  const actual = PNG.sync.write(image);
  assert.equal((await compareScreenshots(actual, actual)).difference, 0);
  const other = new PNG({ width: 3, height: 2 });
  assert.equal((await compareScreenshots(actual, PNG.sync.write(other))).dimensionsChanged, true);
});
test("browser scenarios cover template/language/device with deterministic sampling", () => {
  const pages = ["https://www.whalemate.com/", "https://www.whalemate.com/en/", "https://www.whalemate.com/br/"].map((url) => ({ ...emptyPage(url), outcome: "html" as const }));
  assert.equal(selectScenarios(pages).length, 6); assert.equal(new Set(selectScenarios(pages).map((scenario) => scenario.id)).size, 6);
  assert.equal(selectScenarios(pages, 2).length, 2);
});
test("Playwright detects rendered noindex, overflow, inaccessible fields and executes a safe journey", { timeout: 90_000 }, async () => {
  let submissions = 0;
  const server = createServer((request, response) => {
    if (request.method === "POST") submissions++;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html lang="es"><head><title>Fixture</title><style>body{font-size:16px} .wide{width:2400px} a:focus{outline:3px solid blue}</style></head><body><main><h1>Fixture</h1><div class="wide">Wide</div><a id="cta" href="/next">Contactar</a><form method="post"><input id="unlabelled"><button>Enviar</button></form><script>const meta=document.createElement('meta');meta.name='robots';meta.content='noindex';document.head.appendChild(meta);</script></main></body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/`;
  const criteria: BrowserCriteria = { version: CRITERIA_VERSION, ctaSelector: "#cta", ctaRequiredTemplates: ["Home"], journeys: [{ id: "contact", description: "Contactar", templates: ["Home"], steps: [{ action: "click", selector: "#cta", expectedUrl: "/next$", expectVisible: "h1" }] }], masks: [], minBodyFontPx: 16, maxScenarios: 1, visualDifferenceThreshold: 0.01 };
  try {
    const report = await runBrowserAudit([{ id: "fixture-mobile", url, language: "ES", template: "Home", viewport: "mobile" }], criteria, path.join(process.cwd(), ".audit-artifacts", "tests", "browser"));
    assert.equal(report.scenarios[0].status, "completed", report.scenarios[0].error);
    assert.ok(report.findings.some((finding) => finding.criterion === "rendered-noindex" && finding.evaluation === "automatic"));
    assert.ok(report.findings.some((finding) => finding.criterion === "responsive-overflow" && finding.evaluation === "review"));
    assert.ok(report.findings.some((finding) => finding.criterion === "axe:label"));
    assert.equal(report.summary.journeys.passed, 1); assert.equal(submissions, 0);
    assert.ok(report.scenarios[0].screenshot); assert.ok(report.scenarios[0].trace);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
