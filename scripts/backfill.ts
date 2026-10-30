import { loadEnvConfig } from "@next/env";
import { saveGa4AiDaily, saveGa4Daily, saveGa4LandingPages, saveGscPages, saveGscPerformance, saveGscQueries, saveGscQueryPages } from "../src/db/queries";
import { fetchAnalyticsRange, fetchSearchConsoleRange } from "../src/lib/integrations";
import { SITE_URL } from "../src/lib/site";

const format = (date: Date) => date.toISOString().slice(0, 10);

function flag(name: string) {
  const raw = process.argv.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!raw) return undefined;
  return raw.includes("=") ? raw.split("=").slice(1).join("=") : "";
}

function chunkRange(months: number) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - months * 30 + 1);
  const chunks: Array<{ start: string; end: string }> = [];
  let cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 29);
    if (chunkEnd.getTime() > end.getTime()) chunkEnd.setTime(end.getTime());
    chunks.push({ start: format(cursor), end: format(chunkEnd) });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

async function main() {
  loadEnvConfig(process.cwd());
  const months = Math.min(16, Math.max(1, Number(flag("months") ?? "12") || 12));
  const topQueries = Math.max(100, Math.min(10_000, Number(flag("top-queries") ?? "2000") || 2_000));
  const withQueries = flag("queries") !== undefined;
  const dryRun = flag("dry-run") !== undefined;
  const chunks = chunkRange(months);

  console.log(`Backfill: ${months} meses · ${chunks.length} bloques · queries=${withQueries ? "sí" : "no"} · topQueries/día=${topQueries}`);
  for (const chunk of chunks) console.log(`  ${chunk.start} → ${chunk.end}`);
  if (dryRun) return;

  const hasGoogle = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const hasDb = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING);
  if (!hasGoogle) throw new Error("Faltan credenciales de Google (GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS).");
  if (!hasDb) throw new Error("Falta DATABASE_URL (o POSTGRES_URL) para persistir el backfill.");

  for (const [index, chunk] of chunks.entries()) {
    const label = `[${index + 1}/${chunks.length}] ${chunk.start} → ${chunk.end}`;
    try {
      const gsc = await fetchSearchConsoleRange(chunk.start, chunk.end, topQueries);
      await saveGscPerformance(gsc.performance.map((row) => ({ siteUrl: SITE_URL, day: row.day, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })));
      if (withQueries) {
        await saveGscQueries(gsc.queries.map((row) => ({ siteUrl: SITE_URL, day: row.day, query: row.query, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })));
        await saveGscPages(gsc.pages.map((row) => ({ siteUrl: SITE_URL, day: row.day, pageUrl: row.pageUrl, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })));
        await saveGscQueryPages(gsc.queryPages.map((row) => ({ siteUrl: SITE_URL, day: row.day, query: row.query, pageUrl: row.pageUrl, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })));
      }
      console.log(`${label} · GSC ${gsc.performance.length} días${withQueries ? ` · ${gsc.queries.length} queries` : ""}`);
    } catch (error) {
      console.error(`${label} · GSC falló: ${error instanceof Error ? error.message : "error"}`);
    }
    try {
      const ga4 = await fetchAnalyticsRange(chunk.start, chunk.end);
      await saveGa4Daily(ga4.daily.map((row) => ({ siteUrl: SITE_URL, day: row.day, channel: row.channel, users: row.users, sessions: row.sessions, engagedSessions: row.engagedSessions, conversions: row.conversions, engagementRate: row.engagementRate, engagementDuration: row.engagementDuration })));
      await saveGa4LandingPages(ga4.landingPages.map((row) => ({ siteUrl: SITE_URL, day: row.day, landingPage: row.landingPage, users: row.users, sessions: row.sessions, conversions: row.conversions, engagementRate: row.engagementRate })));
      await saveGa4AiDaily(ga4.aiDaily.map((row) => ({ siteUrl: SITE_URL, day: row.day, source: row.source, users: row.users, sessions: row.sessions, conversions: row.conversions })));
      console.log(`${label} · GA4 ${ga4.daily.length} días · ${ga4.aiDaily.length} filas IA`);
    } catch (error) {
      console.error(`${label} · GA4 falló: ${error instanceof Error ? error.message : "error"}`);
    }
  }
  console.log("Backfill finalizado.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "No se pudo ejecutar el backfill.");
  process.exitCode = 1;
});
