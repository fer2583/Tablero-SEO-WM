import { fetchAnalytics, fetchSearchConsoleWorkspace, type AnalyticsData, type IntegrationFilters, type SearchConsoleWorkspaceData } from "@/lib/integrations";

export type ContentQuery = { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number };
export type ContentPage = { page: string; sessions: number | null; clicks: number; impressions: number; engagementRate: number | null };
export type ContentData = {
  period: SearchConsoleWorkspaceData["period"];
  gscStatus: "live" | "no_data";
  ga4Status: "live" | "no_data" | "unavailable";
  queries: ContentQuery[];
  pages: ContentPage[];
  opportunities: ContentQuery[];
  related: Array<{ cluster: string; queries: string[]; page: string }>;
  withoutPage: ContentQuery[];
  cannibalization: Array<{ query: string; pages: string[]; clicks: number; impressions: number }>;
  ga4Warning?: string;
};

const cleanTerm = (value: string) => value.toLowerCase().replace(/[^a-z0-9áéíóúüñ ]/gi, " ").split(/\s+/).filter((term) => term.length > 2);
const clusterKey = (query: string) => [...new Set(cleanTerm(query))].sort().slice(0, 3).join(" ");

export async function fetchContent(filters: IntegrationFilters): Promise<ContentData> {
  const gsc = await fetchSearchConsoleWorkspace(filters, "queries");
  const queries = gsc.rows.map((row) => ({ query: row.dimension, page: row.page ?? "", clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }));
  let analytics: AnalyticsData | null = null;
  let ga4Warning: string | undefined;
  if (process.env.GA4_PROPERTY_ID && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    try { analytics = await fetchAnalytics(filters); } catch { ga4Warning = "GA4 está configurado pero no devolvió datos para este período."; }
  }
  const pageMap = new Map<string, ContentPage>();
  for (const row of gsc.rows.filter((row) => row.page)) {
    const current = pageMap.get(row.page ?? "") ?? { page: row.page ?? "", sessions: null, clicks: 0, impressions: 0, engagementRate: null };
    current.clicks += row.clicks; current.impressions += row.impressions; pageMap.set(current.page, current);
  }
  for (const row of analytics?.landingPages ?? []) {
    const current = pageMap.get(row.page) ?? { page: row.page, sessions: 0, clicks: 0, impressions: 0, engagementRate: null };
    current.sessions = (current.sessions ?? 0) + row.sessions; current.engagementRate = row.engagementRate; pageMap.set(row.page, current);
  }
  const byQuery = new Map<string, ContentQuery[]>();
  queries.forEach((row) => byQuery.set(row.query, [...(byQuery.get(row.query) ?? []), row]));
  const relatedMap = new Map<string, ContentQuery[]>();
  queries.forEach((row) => { const key = clusterKey(row.query); if (key) relatedMap.set(key, [...(relatedMap.get(key) ?? []), row]); });
  return {
    period: gsc.period,
    gscStatus: queries.length ? "live" : "no_data",
    ga4Status: analytics ? (analytics.landingPages.length ? "live" : "no_data") : "unavailable",
    queries,
    pages: [...pageMap.values()].sort((a, b) => b.impressions - a.impressions),
    opportunities: queries.filter((row) => row.position >= 4 && row.position <= 15 && row.impressions >= 50 && row.ctr < 0.03).sort((a, b) => b.impressions - a.impressions),
    related: [...relatedMap.entries()].filter(([, rows]) => rows.length > 1).slice(0, 20).map(([cluster, rows]) => ({ cluster, queries: rows.map((row) => row.query), page: [...new Set(rows.map((row) => row.page).filter(Boolean))].length === 1 ? rows[0].page : "No data" })),
    withoutPage: queries.filter((row) => !row.page),
    cannibalization: [...byQuery.entries()].filter(([, rows]) => new Set(rows.map((row) => row.page).filter(Boolean)).size > 1).map(([query, rows]) => ({ query, pages: [...new Set(rows.map((row) => row.page).filter(Boolean))], clicks: rows.reduce((sum, row) => sum + row.clicks, 0), impressions: rows.reduce((sum, row) => sum + row.impressions, 0) })),
    ga4Warning,
  };
}
