import "server-only";

import { dates, searchConsoleClient, searchConsoleSite, type IntegrationFilters } from "@/lib/integrations";

export type KeywordRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  positionLabel: "Media GSC";
  keywordTarget: string | null;
  intent: "unknown";
  cluster: "unassigned";
  status: "unmapped";
  brand: "brand" | "non_brand";
};

export type KeywordsData = {
  period: ReturnType<typeof dates>;
  rows: KeywordRow[];
  winners: KeywordRow[];
  losers: KeywordRow[];
  opportunities: KeywordRow[];
  cannibalization: Array<{ query: string; pages: string[] }>;
};

const number = (value: unknown) => { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; };

export async function fetchKeywords(filters: IntegrationFilters): Promise<KeywordsData> {
  const period = dates(filters.days);
  const client = searchConsoleClient();
  const filterRows = [
    filters.country !== "all" && { dimension: "country", operator: "equals", expression: filters.country.toLowerCase() },
    filters.device !== "all" && { dimension: "device", operator: "equals", expression: filters.device },
    filters.page && { dimension: "page", operator: "includingRegex", expression: filters.page },
    filters.query && { dimension: "query", operator: "includingRegex", expression: filters.query },
  ].filter(Boolean) as Array<{ dimension: string; operator: string; expression: string }>;
  const result = await client.searchanalytics.query({
    siteUrl: searchConsoleSite(),
    requestBody: { startDate: period.start, endDate: period.end, dimensions: ["query", "page"], dimensionFilterGroups: filterRows.length ? [{ groupType: "and", filters: filterRows }] : undefined, rowLimit: 1_000 },
  });
  const rows = (result.data.rows ?? []).map((row) => {
    const query = row.keys?.[0] ?? "";
    return { query, page: row.keys?.[1] ?? "", clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), position: number(row.position), positionLabel: "Media GSC" as const, keywordTarget: null, intent: "unknown" as const, cluster: "unassigned" as const, status: "unmapped" as const, brand: query.toLowerCase().includes("whalemate") ? "brand" as const : "non_brand" as const };
  });
  const byQuery = new Map<string, Set<string>>();
  for (const row of rows) byQuery.set(row.query, (byQuery.get(row.query) ?? new Set()).add(row.page));
  const cannibalization = [...byQuery.entries()].filter(([, pages]) => pages.size > 1).map(([query, pages]) => ({ query, pages: [...pages] }));
  return { period, rows, winners: [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 20), losers: [...rows].sort((a, b) => a.clicks - b.clicks).slice(0, 20), opportunities: rows.filter((row) => row.position >= 4 && row.position <= 15 && row.impressions > 100 && row.ctr < 0.03), cannibalization };
}
