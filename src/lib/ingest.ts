import "server-only";

import { acquireSynchronizationLock, releaseSynchronizationLock, saveGa4Daily, saveGa4LandingPages, saveGscPages, saveGscPerformance, saveGscQueries, saveSourceSnapshot, saveSynchronization } from "@/db/queries";
import { dates, fetchAnalytics, fetchAnalyticsDaily, fetchSearchConsole, fetchSearchConsoleDaily, type IntegrationFilters } from "@/lib/integrations";
import { SITE_URL } from "@/lib/site";

export type IngestSource = "gsc" | "ga4";
export type IngestResult = { source: IngestSource; status: "success" | "running" | "error"; generatedAt?: string; error?: string };

const filters: IntegrationFilters = { days: 30 as 7 | 28 | 60 | 90, language: "all", country: "all", device: "all" };

export async function ingestSources(sources: IngestSource[], force = false): Promise<IngestResult[]> {
  const selected = [...new Set(sources)];
  return Promise.all(selected.map((source) => ingestSource(source, force)));
}

export async function startOpportunisticIngest(sources: IngestSource[]) {
  void ingestSources(sources).catch(() => undefined);
}

async function ingestSource(source: IngestSource, _force: boolean): Promise<IngestResult> {
  void _force;
  const lockSource = source === "gsc" ? "search-console" : "analytics";
  const token = crypto.randomUUID();
  if (!(await acquireSynchronizationLock(lockSource, token))) return { source, status: "running" };
  try {
    const generatedAt = new Date().toISOString();
    if (source === "gsc") {
      const [data, daily] = await Promise.all([fetchSearchConsole(filters), fetchSearchConsoleDaily()]);
      await saveGscPerformance(daily.performance.map((row) => ({ siteUrl: SITE_URL, day: row.day, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })));
      await saveGscQueries(daily.queries.map((row) => ({ siteUrl: SITE_URL, day: row.day, query: row.query, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })));
      await saveGscPages(daily.pages.map((row) => ({ siteUrl: SITE_URL, day: row.day, pageUrl: row.pageUrl, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })));
      await saveSourceSnapshot(SITE_URL, "search-console", "gsc-summary:30:all:all:all", { ...data, generatedAt });
    } else {
      const [data, daily] = await Promise.all([fetchAnalytics(filters), fetchAnalyticsDaily()]);
      await saveGa4Daily(daily.daily.map((row) => ({ siteUrl: SITE_URL, day: row.day, channel: row.channel, users: row.users, sessions: row.sessions, engagedSessions: row.engagedSessions, conversions: row.conversions, engagementRate: row.engagementRate, engagementDuration: row.engagementDuration })));
      await saveGa4LandingPages(daily.landingPages.map((row) => ({ siteUrl: SITE_URL, day: row.day, landingPage: row.landingPage, users: row.users, sessions: row.sessions, conversions: row.conversions, engagementRate: row.engagementRate })));
      await saveSourceSnapshot(SITE_URL, "analytics", "ga4-summary:30:all:all:all", { ...data, generatedAt });
    }
    await saveSynchronization({ source: lockSource, status: "success" });
    return { source, status: "success", generatedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de ingesta";
    await saveSynchronization({ source: lockSource, status: "error", error: message });
    return { source, status: "error", error: message };
  } finally {
    await releaseSynchronizationLock(lockSource, token);
  }
}

export function ingestPeriod() {
  return dates(30);
}
