import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { auditStore, AuditConflict } from "../src/db/audit-store";
import type { getDb } from "../src/db/client";
import { buildAuditSnapshot } from "../src/lib/audit";
import { emptyPage, parsePage } from "../src/lib/crawler/engine";
import { RULES_VERSION, type CrawlState } from "../src/lib/crawler/types";
import { SITE_URL } from "../src/lib/site";

test("Postgres migration, leases, transactions, resume, published snapshots and analytics aggregation", async () => {
  const pg = new PGlite();
  const query = async (text: string, params?: unknown[]) => { const result = await pg.query(text, params); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; };
  const db = { query, connect: async () => ({ query, release() {} }) } as unknown as ReturnType<typeof getDb>;
  const store = auditStore(db);
  const schema = await readFile(new URL("../src/db/schema.sql", import.meta.url), "utf8");
  try {
    await pg.exec(schema); await pg.exec(schema);
    const data: CrawlState = { version: RULES_VERSION, config: { maxUrls: 100, batchSize: 25, concurrency: 4, maxQueryUrls: 10, maxDepth: 10 }, robots: { status: "live", text: "", fetchedAt: new Date().toISOString() }, sitemap: { status: "live", urls: [SITE_URL], sitemaps: [], fetchedAt: new Date().toISOString() }, queue: [{ url: SITE_URL, sources: ["home", "sitemap"], attempts: 0 }], pages: [], known: [SITE_URL], excluded: [], previousIssues: [], traffic: {}, limitReached: false };
    const run = (await store.create(data))!;
    assert.equal((await store.create(data))!.id, run.id);
    const first = randomUUID(), second = randomUUID();
    assert.ok(await store.claim(run.id, first)); assert.equal(await store.claim(run.id, second), null);
    await assert.rejects(() => store.action(run.id, "cancel"), AuditConflict);
    await pg.query("UPDATE audit_runs SET lock_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [run.id]);
    assert.ok(await store.claim(run.id, second));
    await assert.rejects(() => store.checkpoint(run.id, first, data, buildAuditSnapshot(data)), AuditConflict);
    assert.equal((await pg.query("SELECT * FROM audit_pages")).rows.length, 0);
    const page = { ...emptyPage(SITE_URL, ["sitemap"]), httpStatus: 404, outcome: "http_error" as const, links: [{ url: `${SITE_URL}next`, text: "next", nofollow: false }] };
    data.pages = [page]; data.queue = [];
    assert.equal(await store.checkpoint(run.id, second, data, buildAuditSnapshot(data)), "completed");
    assert.equal((await pg.query("SELECT * FROM audit_pages")).rows.length, 1);
    assert.equal((await pg.query("SELECT * FROM audit_links")).rows.length, 1);
    assert.equal((await pg.query("SELECT * FROM audit_issues")).rows.length, 1);
    assert.equal(await store.claim(run.id, randomUUID()), null);
    const later = (await store.create({ ...data, queue: [{ url: SITE_URL, sources: ["home"], attempts: 0 }], pages: [] }))!;
    assert.notEqual(run.id, later.id);
    const paused = await store.action(later.id, "pause"); assert.equal(paused.status, "paused");
    assert.equal(await store.claim(later.id, randomUUID()), null);
    assert.equal((await store.action(later.id, "resume")).status, "queued");
    assert.equal((await store.action(later.id, "cancel")).status, "cancelled");
    const selectiveState = { ...data, scope: "selective" as const };
    const selective = (await store.create(selectiveState))!;
    const selectiveToken = randomUUID();
    await store.claim(selective.id, selectiveToken);
    await store.checkpoint(selective.id, selectiveToken, selectiveState, buildAuditSnapshot(selectiveState));
    await pg.query(`INSERT INTO gsc_pages_daily (site_url,day,page_url,country,impressions,clicks) VALUES ($1,CURRENT_DATE-1,$1,'ar',20,2),($1,CURRENT_DATE-1,$1,'br',40,4)`, [SITE_URL]);
    await pg.query(`INSERT INTO ga4_landing_pages (site_url,day,landing_page,users) VALUES ($1,CURRENT_DATE-1,'/',5)`, [SITE_URL]);
    const seeds = await store.seeds();
    assert.equal(seeds.traffic[SITE_URL].impressions, 60); assert.equal(seeds.traffic[SITE_URL].clicks, 6); assert.equal(seeds.traffic[SITE_URL].users, 5);
    // Exercise the actual read-only API handlers against an isolated in-process Postgres.
    const globals = globalThis as typeof globalThis & { whaleMateDb?: ReturnType<typeof getDb> };
    const previousDb = globals.whaleMateDb; const oldUrl = process.env.DATABASE_URL;
    globals.whaleMateDb = db; process.env.DATABASE_URL = "postgres://test/isolated";
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("Read-only endpoints must not fetch external sources"); };
    try {
      const { GET: configuration } = await import("../src/app/api/configuration/route");
      assert.equal((await configuration()).status, 200);
      const { GET: latest } = await import("../src/app/api/audit/route");
      const response = await latest(new Request("http://localhost/api/audit"));
      const payload = await response.json();
      assert.equal(payload.latestRunId, run.id); assert.equal(payload.activeRun, null);
      assert.equal((await latest(new Request("http://localhost/api/audit?refresh=1"))).status, 405);
      const unfinished = (await store.create({ ...data, queue: [{ url: SITE_URL, sources: ["home"], attempts: 0 }], pages: [] }))!;
      await pg.query(`UPDATE audit_runs SET snapshot=$2::jsonb WHERE id=$1`, [unfinished.id, JSON.stringify({ crawler: { issues: [{ id: "unfinished", severity: "Alta", issue: "Unpublished", evidence: "", recommendation: "" }], audited: [] } })]);
      const { evaluateAlerts } = await import("../src/lib/alerts");
      const alerts = await evaluateAlerts();
      assert.equal(alerts.persistence, "database");
      assert.equal(alerts.alerts.some((alert) => alert.entity === "unfinished"), false);
      assert.ok(alerts.alerts.some((alert) => alert.entity === `http:${SITE_URL}`));
      await store.action(unfinished.id, "cancel");
      const reportId = randomUUID(); const image = Buffer.from("test-image");
      await pg.query(`INSERT INTO audit_browser_reports (id,audit_run_id,criteria_version,report) VALUES ($1::uuid,$2,'test','{}')`, [reportId, run.id]);
      await pg.query(`INSERT INTO audit_browser_artifacts (report_id,name,content) VALUES ($1::uuid,'fixture.png',decode($2,'base64'))`, [reportId, image.toString("base64")]);
      const { GET: evidence } = await import("../src/app/api/audit/runs/[id]/[operation]/route");
      const png = await evidence(new Request(`http://localhost/api/audit/runs/${run.id}/evidence?report=${reportId}&name=fixture.png`), { params: Promise.resolve({ id: String(run.id), operation: "evidence" }) });
      assert.equal(png.headers.get("content-type"), "image/png"); assert.equal(Buffer.from(await png.arrayBuffer()).toString(), "test-image");
      assert.equal((await evidence(new Request(`http://localhost/api/audit/runs/${selective.id}/evidence?report=${reportId}&name=fixture.png`), { params: Promise.resolve({ id: String(selective.id), operation: "evidence" }) })).status, 404);
      const html = { ...parsePage("<title>Home</title><h1>Home</h1>", SITE_URL), httpStatus: 200 };
      const performanceState = { ...data, pages: [html] };
      const performanceRun = (await store.create(performanceState))!; const performanceToken = randomUUID();
      await store.claim(performanceRun.id, performanceToken);
      await store.checkpoint(performanceRun.id, performanceToken, performanceState, buildAuditSnapshot(performanceState));
      const psiKey = process.env.PAGESPEED_API_KEY, cruxKey = process.env.CRUX_API_KEY;
      process.env.PAGESPEED_API_KEY = "test"; process.env.CRUX_API_KEY = "test";
      let externalCalls = 0;
      globalThis.fetch = async (input) => {
        externalCalls++;
        return String(input).includes("pagespeedonline") ? Response.json({ lighthouseResult: { audits: { "largest-contentful-paint": { numericValue: 1234 }, "total-blocking-time": { numericValue: 80 } }, categories: { performance: { score: 0.9 } } } }) : Response.json({ record: { collectionPeriod: { firstDate: { year: 2026, month: 9, day: 26 } }, metrics: { largest_contentful_paint: { percentiles: { p75: 1900 } }, round_trip_time: { percentiles: { p75: 50 } } } } });
      };
      try {
        const { enrichRun, reserveEnrichment, executeEnrichment } = await import("../src/lib/crawler/performance");
        await enrichRun(performanceRun.id); await enrichRun(performanceRun.id);
        assert.equal(externalCalls, 4, "second enrichment should reuse all four cached sources");
        const saved = (await store.get(performanceRun.id))!.savedSnapshot as ReturnType<typeof buildAuditSnapshot>;
        assert.equal(saved.devices.mobile.psi.metrics.tbt, 80);
        assert.equal(saved.devices.mobile.psi.metrics.inp, undefined);
        assert.equal(saved.devices.mobile.crux.scope, "origin");
        assert.equal(saved.devices.mobile.crux.metrics.ttfb, null, "RTT is not a substitute for TTFB");
        const job = await reserveEnrichment(performanceRun.id, SITE_URL, true);
        const running = (await store.get(performanceRun.id))!.savedSnapshot as ReturnType<typeof buildAuditSnapshot>;
        assert.equal(running.performanceTask?.status, "running");
        await assert.rejects(() => reserveEnrichment(performanceRun.id), AuditConflict);
        await executeEnrichment(job);
        assert.equal(externalCalls, 8, "force bypasses cached results for both sources/devices");
        const finished = (await store.get(performanceRun.id))!.savedSnapshot as ReturnType<typeof buildAuditSnapshot>;
        assert.equal(finished.performanceTask?.status, "completed"); assert.ok(finished.performanceTask?.completedAt);
      } finally {
        if (psiKey == null) delete process.env.PAGESPEED_API_KEY; else process.env.PAGESPEED_API_KEY = psiKey;
        if (cruxKey == null) delete process.env.CRUX_API_KEY; else process.env.CRUX_API_KEY = cruxKey;
      }
    } finally { globals.whaleMateDb = previousDb; globalThis.fetch = previousFetch; if (oldUrl == null) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl; }
  } finally { await pg.close(); }
});
