import "server-only";

import { periods, searchConsoleClient, searchConsoleSite, type IntegrationFilters } from "@/lib/integrations";
import { expectedCtrFor, isOpportunity, opportunityScoreFor, potentialClicksFor } from "@/lib/opportunities";

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
  previousClicks: number | null;
  previousPosition: number | null;
  clickDelta: number | null;
  positionDelta: number | null;
  expectedCtr: number | null;
  potentialClicks: number | null;
  opportunityScore: number | null;
};

export type KeywordDaily = { date: string; clicks: number; impressions: number; ctr: number; position: number };
export type KeywordTotals = { clicks: number; impressions: number; ctr: number; position: number };
export type CannibalizationRow = { query: string; pages: string[]; clicks: number; impressions: number; share: number; confidence: "possible" };

export type KeywordsData = {
  period: { start: string; end: string; previousStart: string; previousEnd: string };
  totals: KeywordTotals;
  previous: KeywordTotals | null;
  daily: KeywordDaily[];
  rows: KeywordRow[];
  winners: KeywordRow[];
  losers: KeywordRow[];
  opportunities: KeywordRow[];
  cannibalization: CannibalizationRow[];
  truncated: boolean;
};

type GscRow = { keys?: string[] | null; clicks?: number | null; impressions?: number | null; ctr?: number | null; position?: number | null };

const number = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const BRAND_TERMS = ["whalemate", "whale mate"];

export function isBrandQuery(query: string) {
  const normalized = query.toLowerCase();
  return BRAND_TERMS.some((term) => normalized.includes(term));
}

/** Reexportado para compatibilidad; la definición vive en lib/opportunities.ts. */
export { expectedCtrFor };

function summarize(rows: Array<{ clicks: number; impressions: number; position: number }>): KeywordTotals {
  const clicks = rows.reduce((total, row) => total + row.clicks, 0);
  const impressions = rows.reduce((total, row) => total + row.impressions, 0);
  const weighted = rows.reduce((total, row) => total + row.position * row.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weighted / impressions : 0,
  };
}

function aggregateByQuery(rows: GscRow[]) {
  const map = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();
  for (const row of rows) {
    const query = row.keys?.[0] ?? "";
    if (!query) continue;
    const impressions = number(row.impressions);
    const current = map.get(query) ?? { clicks: 0, impressions: 0, positionWeighted: 0 };
    current.clicks += number(row.clicks);
    current.impressions += impressions;
    current.positionWeighted += number(row.position) * impressions;
    map.set(query, current);
  }
  return new Map(
    [...map.entries()].map(([query, value]) => [
      query,
      {
        clicks: value.clicks,
        impressions: value.impressions,
        position: value.impressions ? value.positionWeighted / value.impressions : 0,
      },
    ]),
  );
}

export async function fetchKeywords(filters: IntegrationFilters): Promise<KeywordsData> {
  const window = periods(filters.days, filters.compare);
  const period = { start: window.start, end: window.end, previousStart: window.compareStart, previousEnd: window.compareEnd };
  const client = searchConsoleClient();

  const dimensionFilters = [
    filters.country !== "all" && { dimension: "country", operator: "equals", expression: filters.country.toLowerCase() },
    filters.device !== "all" && { dimension: "device", operator: "equals", expression: filters.device },
    filters.language === "en" && { dimension: "page", operator: "includingRegex", expression: "/en/" },
    filters.language === "pt" && { dimension: "page", operator: "includingRegex", expression: "/pt/" },
    filters.language === "es" && { dimension: "page", operator: "includingRegex", expression: "^(?!.*\\/(en|pt)\\/).*" },
    filters.page && { dimension: "page", operator: "includingRegex", expression: filters.page },
    filters.query && { dimension: "query", operator: "includingRegex", expression: filters.query },
  ].filter(Boolean) as Array<{ dimension: string; operator: string; expression: string }>;

  const filterGroups = dimensionFilters.length ? [{ groupType: "and" as const, filters: dimensionFilters }] : undefined;

  const queryPair = async (startDate: string, endDate: string) => {
    const rows: GscRow[] = [];
    const pageSize = 25_000;
    let startRow = 0;
    try {
      while (rows.length < 25_000) {
        const response = await client.searchanalytics.query({
          siteUrl: searchConsoleSite(),
          requestBody: { startDate, endDate, dimensions: ["query", "page"], dimensionFilterGroups: filterGroups, rowLimit: pageSize, startRow },
        });
        const batch = response.data.rows ?? [];
        rows.push(...batch);
        if (batch.length < pageSize) break;
        startRow += pageSize;
      }
    } catch {
      return rows;
    }
    return rows.slice(0, 25_000);
  };

  const dailyRequest = client.searchanalytics
    .query({
      siteUrl: searchConsoleSite(),
      requestBody: { startDate: period.start, endDate: period.end, dimensions: ["date"], dimensionFilterGroups: filterGroups, rowLimit: 400 },
    })
    .then((response) => response.data.rows ?? [])
    .catch(() => [] as GscRow[]);

  const [currentRows, previousRows, dailyRows] = await Promise.all([
    queryPair(period.start, period.end),
    queryPair(period.previousStart, period.previousEnd),
    dailyRequest,
  ]);

  const previousByKey = new Map<string, GscRow>();
  for (const row of previousRows) previousByKey.set(`${row.keys?.[0] ?? ""}||${row.keys?.[1] ?? ""}`, row);
  const previousByQuery = aggregateByQuery(previousRows);

  const rows: KeywordRow[] = currentRows.map((row) => {
    const query = row.keys?.[0] ?? "";
    const page = row.keys?.[1] ?? "";
    const clicks = number(row.clicks);
    const impressions = number(row.impressions);
    const position = number(row.position);
    const previousRow = previousByKey.get(`${query}||${page}`);
    const previousQuery = previousByQuery.get(query);
    const previousClicks = previousRow ? number(previousRow.clicks) : previousQuery ? previousQuery.clicks : 0;
    const previousPosition = previousRow ? number(previousRow.position) : previousQuery?.position ?? null;
    const expectedCtr = expectedCtrFor(position);
    const opportunityInput = { impressions, ctr: number(row.ctr), position, clicks };
    const potentialClicks = potentialClicksFor(opportunityInput);
    return {
      query,
      page,
      clicks,
      impressions,
      ctr: number(row.ctr),
      position,
      positionLabel: "Media GSC" as const,
      keywordTarget: null,
      intent: "unknown" as const,
      cluster: "unassigned" as const,
      status: "unmapped" as const,
      brand: isBrandQuery(query) ? ("brand" as const) : ("non_brand" as const),
      previousClicks,
      previousPosition,
      clickDelta: clicks - previousClicks,
      positionDelta: previousPosition == null ? null : previousPosition - position,
      expectedCtr,
      potentialClicks,
      opportunityScore: opportunityScoreFor(opportunityInput),
    };
  });

  const byQuery = new Map<string, { pages: Map<string, number>; clicks: number; impressions: number }>();
  for (const row of rows) {
    const current = byQuery.get(row.query) ?? { pages: new Map<string, number>(), clicks: 0, impressions: 0 };
    current.pages.set(row.page, (current.pages.get(row.page) ?? 0) + row.clicks);
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    byQuery.set(row.query, current);
  }

  const cannibalization: CannibalizationRow[] = [...byQuery.entries()]
    .filter(([, value]) => value.pages.size > 1)
    .map(([query, value]) => {
      const pageClicks = [...value.pages.values()];
      const topClicks = Math.max(0, ...pageClicks);
      return {
        query,
        pages: [...value.pages.keys()],
        clicks: value.clicks,
        impressions: value.impressions,
        share: value.clicks ? Math.round((topClicks / value.clicks) * 100) : 0,
        confidence: "possible" as const,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);

  const daily: KeywordDaily[] = dailyRows
    .map((row) => {
      const raw = row.keys?.[0] ?? "";
      const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
      return { date, clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), position: number(row.position) };
    })
    .filter((row) => row.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const winners = rows
    .filter((row) => row.clickDelta != null && row.clickDelta > 0)
    .sort((a, b) => (b.clickDelta ?? 0) - (a.clickDelta ?? 0))
    .slice(0, 20);

  const losers = rows
    .filter((row) => row.clickDelta != null && row.clickDelta < 0)
    .sort((a, b) => (a.clickDelta ?? 0) - (b.clickDelta ?? 0))
    .slice(0, 20);

  const opportunities = rows
    .filter((row) => isOpportunity({ impressions: row.impressions, ctr: row.ctr, position: row.position, clicks: row.clicks }))
    .sort((a, b) => (b.potentialClicks ?? 0) - (a.potentialClicks ?? 0))
    .slice(0, 50);

  return {
    period,
    totals: summarize(rows),
    previous: previousRows.length
      ? summarize(previousRows.map((row) => ({ clicks: number(row.clicks), impressions: number(row.impressions), position: number(row.position) })))
      : null,
    daily,
    rows,
    winners,
    losers,
    opportunities,
    cannibalization,
    truncated: currentRows.length >= 25_000,
  };
}
