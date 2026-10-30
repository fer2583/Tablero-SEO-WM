import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const site = "https://www.whalemate.com/";

test("las agregaciones del Resumen respetan rango, comparación y tablas nuevas", async () => {
  const pg = new PGlite();
  const schema = await readFile(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  await pg.exec(schema);
  (globalThis as unknown as { whaleMateDb: unknown }).whaleMateDb = {
    query: async (text: string, params?: unknown[]) => {
      const result = await pg.query(text, params);
      return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
    },
  };
  const queries = await import("../src/db/queries");

  await queries.saveGscPerformance([
    { siteUrl: site, day: "2026-10-01", clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
    { siteUrl: site, day: "2026-10-02", clicks: 20, impressions: 200, ctr: 0.1, position: 3 },
  ]);
  await queries.saveGscQueries([
    { siteUrl: site, day: "2026-10-01", query: "whalemate", clicks: 8, impressions: 80, ctr: 0.1, position: 4 },
    { siteUrl: site, day: "2026-10-02", query: "whalemate", clicks: 12, impressions: 120, ctr: 0.1, position: 2 },
    { siteUrl: site, day: "2026-10-01", query: "seo", clicks: 5, impressions: 50, ctr: 0.1, position: 10 },
  ]);
  await queries.saveGscQueryPages([
    { siteUrl: site, day: "2026-10-01", query: "whalemate", pageUrl: "https://www.whalemate.com/", clicks: 8, impressions: 80, ctr: 0.1, position: 4 },
  ]);
  await queries.saveGa4Daily([
    { siteUrl: site, day: "2026-10-01", channel: "Organic Search", sessions: 10, engagedSessions: 5, conversions: 1, engagementRate: 0.5 },
  ]);
  await queries.saveGa4AiDaily([
    { siteUrl: site, day: "2026-10-01", source: "chatgpt.com", sessions: 2, conversions: 0 },
  ]);

  const totals = await queries.getGscTotals(site, "2026-10-01", "2026-10-02");
  assert.equal(Number(totals.clicks), 30);
  assert.equal(Number(totals.impressions), 300);
  assert.equal(Math.round(Number(totals.position) * 100) / 100, 3.67);

  const rows = await queries.getGscQueryRows(site, "2026-10-01", "2026-10-02", "2026-09-01", "2026-09-02");
  assert.equal(rows.length, 2);
  const whalemate = rows.find((row) => row.query === "whalemate");
  assert.equal(Number(whalemate?.clicks), 20);
  assert.equal(Number(whalemate?.previousClicks), 0);

  const ga4 = await queries.getGa4Totals(site, "2026-10-01", "2026-10-02");
  assert.equal(Number(ga4.sessions), 10);
  assert.equal(Number(ga4.engagementRate), 0.5);
  assert.equal(Number((await queries.getGa4AiTotals(site, "2026-10-01", "2026-10-02")).sessions), 2);
  assert.equal((await queries.getGscDailySeries(site, "2026-10-01", "2026-10-02")).length, 2);
  await pg.close();
});
