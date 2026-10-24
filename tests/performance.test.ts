import test from "node:test";
import assert from "node:assert/strict";
import { fetchCrux, fetchPsi } from "../src/lib/audit";
import { coreWebVitalsAssessment, formatCollectionPeriod, formatPerformanceMetric, webVitalRating } from "../src/lib/performance-display";

async function google(response: () => Response, action: () => Promise<void>) {
  const previousFetch = globalThis.fetch;
  const psiKey = process.env.PAGESPEED_API_KEY, cruxKey = process.env.CRUX_API_KEY;
  process.env.PAGESPEED_API_KEY = "private-test-psi"; process.env.CRUX_API_KEY = "private-test-crux";
  globalThis.fetch = async () => response();
  try { await action(); }
  finally {
    globalThis.fetch = previousFetch;
    if (psiKey == null) delete process.env.PAGESPEED_API_KEY; else process.env.PAGESPEED_API_KEY = psiKey;
    if (cruxKey == null) delete process.env.CRUX_API_KEY; else process.env.CRUX_API_KEY = cruxKey;
  }
}
test("PageSpeed distinguishes quota failures and never returns raw credential-bearing Google errors", async () => {
  await google(() => Response.json({ error: { message: "private-test-psi", details: [{ reason: "RATE_LIMIT_EXCEEDED" }] } }, { status: 429 }), async () => {
    const result = await fetchPsi("mobile");
    assert.equal(result.status, "error"); assert.equal(result.diagnostic?.code, "quota");
    assert.equal(JSON.stringify(result).includes("private-test-psi"), false); assert.ok(result.fetchedAt);
  });
});
test("a Lighthouse runtime error or empty HTTP 200 response is not a successful test", async () => {
  await google(() => Response.json({ lighthouseResult: { runtimeError: { code: "ERRORED_DOCUMENT_REQUEST" } } }), async () => assert.equal((await fetchPsi("desktop")).status, "error"));
  await google(() => Response.json({}), async () => assert.equal((await fetchPsi("desktop")).diagnostic?.code, "invalid_response"));
});
test("PageSpeed preserves zero scores and laboratory metrics without inventing INP", async () => {
  await google(() => Response.json({ lighthouseResult: { categories: { performance: { score: 0 }, seo: { score: 1 } }, audits: { "cumulative-layout-shift": { numericValue: 0 }, "total-blocking-time": { numericValue: 100 } } } }), async () => {
    const result = await fetchPsi("mobile");
    assert.equal(result.status, "live"); assert.equal(result.scores.performance, 0); assert.equal(result.scores.seo, 100);
    assert.equal(result.metrics.cls, 0); assert.equal(result.metrics.inp, undefined);
  });
});
test("CrUX missing field data and an unauthorized API are different states", async () => {
  await google(() => Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 }), async () => {
    const result = await fetchCrux("mobile");
    assert.equal(result.status, "unavailable"); assert.equal(result.diagnostic?.code, "no_data"); assert.equal(result.diagnostic.retryable, false);
    assert.equal(result.metrics.inp, null); assert.ok(result.fetchedAt);
  });
  await google(() => Response.json({ error: { details: [{ reason: "API_KEY_SERVICE_BLOCKED" }] } }, { status: 403 }), async () => {
    const result = await fetchCrux("desktop");
    assert.equal(result.status, "error"); assert.equal(result.diagnostic?.code, "forbidden");
  });
});
test("CrUX normalizes numeric strings and preserves the actual collection period", async () => {
  const collectionPeriod = { firstDate: { year: 2026, month: 9, day: 27 }, lastDate: { year: 2026, month: 10, day: 24 } };
  await google(() => Response.json({ record: { collectionPeriod, metrics: { largest_contentful_paint: { percentiles: { p75: 2200 } }, cumulative_layout_shift: { percentiles: { p75: "0.03" } } } } }), async () => {
    const result = await fetchCrux("mobile");
    assert.equal(result.status, "live"); assert.equal(result.metrics.cls, 0.03); assert.deepEqual(result.collectionPeriod, collectionPeriod);
  });
});
test("metric formatting and CWV assessment keep missing measurements distinct from zero", () => {
  assert.equal(formatPerformanceMetric("lcp", 18236), "18,24 s");
  assert.equal(formatPerformanceMetric("tbt", 369), "369 ms");
  assert.equal(formatPerformanceMetric("cls", 0), "0,000");
  assert.equal(formatPerformanceMetric("inp", null), "Sin datos");
  assert.equal(webVitalRating("lcp", 2500), "good"); assert.equal(webVitalRating("lcp", 4000), "needs-improvement");
  assert.equal(webVitalRating("inp", 501), "poor"); assert.equal(webVitalRating("cls", null), "unavailable");
  assert.equal(coreWebVitalsAssessment({ lcp: 1000, cls: 0.01, inp: null }), "incomplete");
  assert.equal(coreWebVitalsAssessment({ lcp: 1000, cls: 0.01, inp: 100 }), "passed");
  assert.equal(coreWebVitalsAssessment({ lcp: 5000, cls: 0.01, inp: 100 }), "needs-attention");
  assert.equal(formatCollectionPeriod({ firstDate: { year: 2026, month: 9, day: 27 }, lastDate: { year: 2026, month: 10, day: 24 } }), "27/9/2026 – 24/10/2026");
});
