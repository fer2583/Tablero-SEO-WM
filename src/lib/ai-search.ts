import "server-only";

import { google } from "googleapis";
import { AI_REFERRAL_SOURCE_PATTERN, auth, dates, type IntegrationFilters } from "@/lib/integrations";

export type AiPlatform = "ChatGPT" | "Perplexity" | "Gemini" | "Copilot" | "Claude" | "DeepSeek" | "Otra IA";

export type AiSearchSource = { platform: AiPlatform; source: string; sessions: number; users: number; conversions: number; engagementRate: number };
export type AiSearchLanding = { page: string; sessions: number; users: number; conversions: number; engagementRate: number };
export type AiSearchDaily = { date: string; sessions: number; users: number };

export type AiSearchData = {
  period: { start: string; end: string; previousStart: string; previousEnd: string };
  metrics: { sessions: number; users: number; conversions: number; engagementRate: number };
  previous: { sessions: number; users: number; conversions: number; engagementRate: number };
  totalSessions: number;
  previousTotalSessions: number;
  share: number;
  previousShare: number;
  sources: AiSearchSource[];
  platforms: Array<{ platform: AiPlatform; sessions: number; users: number; conversions: number; share: number }>;
  landingPages: AiSearchLanding[];
  daily: AiSearchDaily[];
  aiStatus: "available" | "unavailable";
  generatedAt: string;
};

const PLATFORMS: Array<[AiPlatform, RegExp]> = [
  ["ChatGPT", /chatgpt|openai/i],
  ["Perplexity", /perplexity/i],
  ["Gemini", /gemini|bard/i],
  ["Copilot", /copilot/i],
  ["Claude", /claude|anthropic/i],
  ["DeepSeek", /deepseek/i],
];

export const AI_PLATFORMS: AiPlatform[] = ["ChatGPT", "Perplexity", "Gemini", "Copilot", "Claude", "DeepSeek", "Otra IA"];

export function platformOf(source: string): AiPlatform {
  return PLATFORMS.find(([, pattern]) => pattern.test(source))?.[0] ?? "Otra IA";
}

const number = (value?: string | number | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isoDay = (value: string) =>
  /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;

export function emptyAiSearch(filters: IntegrationFilters): AiSearchData {
  return {
    period: dates(filters.days),
    metrics: { sessions: 0, users: 0, conversions: 0, engagementRate: 0 },
    previous: { sessions: 0, users: 0, conversions: 0, engagementRate: 0 },
    totalSessions: 0,
    previousTotalSessions: 0,
    share: 0,
    previousShare: 0,
    sources: [],
    platforms: [],
    landingPages: [],
    daily: [],
    aiStatus: "unavailable",
    generatedAt: new Date().toISOString(),
  };
}

type FilterExpression = { filter: { fieldName: string; stringFilter: { matchType: "EXACT" | "FULL_REGEXP" | "CONTAINS"; value: string } } } | { notExpression: { filter: { fieldName: string; stringFilter: { matchType: "EXACT" | "FULL_REGEXP" | "CONTAINS"; value: string } } } };

export async function fetchAiSearch(filters: IntegrationFilters): Promise<AiSearchData> {
  const property = process.env.GA4_PROPERTY_ID;
  if (!property) throw new Error("GA4: falta GA4_PROPERTY_ID en la configuración del servidor.");

  const period = dates(filters.days);
  const client = google.analyticsdata({ version: "v1beta", auth: auth() });
  const propertyName = `properties/${property}`;

  const aiFilter: FilterExpression = { filter: { fieldName: "sessionSource", stringFilter: { matchType: "FULL_REGEXP", value: AI_REFERRAL_SOURCE_PATTERN } } };
  const scope: FilterExpression[] = [
    filters.country !== "all" && { filter: { fieldName: "countryId", stringFilter: { matchType: "EXACT" as const, value: filters.country } } },
    filters.device !== "all" && { filter: { fieldName: "deviceCategory", stringFilter: { matchType: "EXACT" as const, value: filters.device } } },
    filters.language === "en" && { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "FULL_REGEXP" as const, value: "^/en(?:/|$)" } } },
    filters.language === "pt" && { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "FULL_REGEXP" as const, value: "^/pt(?:/|$)" } } },
    filters.language === "es" && { notExpression: { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS" as const, value: "/en" } } } },
    filters.language === "es" && { notExpression: { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS" as const, value: "/pt" } } } },
    filters.page && { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS" as const, value: filters.page } } },
  ].filter(Boolean) as FilterExpression[];

  const run = (startDate: string, endDate: string, dimensions: string[], metrics: string[], extra: FilterExpression[] = [], limit = "100") => {
    const expressions = [...extra, ...scope];
    return client.properties.runReport({
      property: propertyName,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
        dimensionFilter: expressions.length ? { andGroup: { expressions } } : undefined,
        limit,
      },
    });
  };

  const [totals, previousTotals, allTotals, allPrevious, sources, landingPages, daily] = await Promise.all([
    run(period.start, period.end, [], ["sessions", "totalUsers", "conversions", "engagementRate"], [aiFilter]),
    run(period.previousStart, period.previousEnd, [], ["sessions", "totalUsers", "conversions", "engagementRate"], [aiFilter]),
    run(period.start, period.end, [], ["sessions"]),
    run(period.previousStart, period.previousEnd, [], ["sessions"]),
    run(period.start, period.end, ["sessionSource", "sessionMedium"], ["sessions", "totalUsers", "conversions", "engagementRate"], [aiFilter]),
    run(period.start, period.end, ["landingPagePlusQueryString"], ["sessions", "totalUsers", "conversions", "engagementRate"], [aiFilter], "50"),
    run(period.start, period.end, ["date"], ["sessions", "totalUsers"], [aiFilter], "400"),
  ]);

  const values = (report: typeof totals) => (report.data.rows?.[0]?.metricValues ?? []).map((item) => number(item.value));
  const current = values(totals);
  const previous = values(previousTotals);
  const totalSessions = number(allTotals.data.rows?.[0]?.metricValues?.[0]?.value);
  const previousTotalSessions = number(allPrevious.data.rows?.[0]?.metricValues?.[0]?.value);

  const sourceRows: AiSearchSource[] = (sources.data.rows ?? []).map((row) => {
    const source = row.dimensionValues?.[0]?.value ?? "(not set)";
    const medium = row.dimensionValues?.[1]?.value ?? "(not set)";
    return {
      platform: platformOf(source),
      source: medium === "(not set)" ? source : `${source} / ${medium}`,
      sessions: number(row.metricValues?.[0]?.value),
      users: number(row.metricValues?.[1]?.value),
      conversions: number(row.metricValues?.[2]?.value),
      engagementRate: number(row.metricValues?.[3]?.value),
    };
  });

  const grouped = new Map<AiPlatform, { sessions: number; users: number; conversions: number }>();
  for (const row of sourceRows) {
    const bucket = grouped.get(row.platform) ?? { sessions: 0, users: 0, conversions: 0 };
    bucket.sessions += row.sessions;
    bucket.users += row.users;
    bucket.conversions += row.conversions;
    grouped.set(row.platform, bucket);
  }
  const aiSessions = current[0] ?? sourceRows.reduce((sum, row) => sum + row.sessions, 0);
  const platforms = [...grouped.entries()]
    .map(([platform, value]) => ({ platform, sessions: value.sessions, users: value.users, conversions: value.conversions, share: aiSessions ? value.sessions / aiSessions : 0 }))
    .sort((left, right) => right.sessions - left.sessions);

  return {
    period,
    metrics: { sessions: current[0] ?? 0, users: current[1] ?? 0, conversions: current[2] ?? 0, engagementRate: current[3] ?? 0 },
    previous: { sessions: previous[0] ?? 0, users: previous[1] ?? 0, conversions: previous[2] ?? 0, engagementRate: previous[3] ?? 0 },
    totalSessions,
    previousTotalSessions,
    share: totalSessions ? (current[0] ?? 0) / totalSessions : 0,
    previousShare: previousTotalSessions ? (previous[0] ?? 0) / previousTotalSessions : 0,
    sources: sourceRows.sort((left, right) => right.sessions - left.sessions),
    platforms,
    landingPages: (landingPages.data.rows ?? []).map((row) => ({
      page: row.dimensionValues?.[0]?.value ?? "(not set)",
      sessions: number(row.metricValues?.[0]?.value),
      users: number(row.metricValues?.[1]?.value),
      conversions: number(row.metricValues?.[2]?.value),
      engagementRate: number(row.metricValues?.[3]?.value),
    })),
    daily: (daily.data.rows ?? [])
      .map((row) => ({ date: isoDay(row.dimensionValues?.[0]?.value ?? ""), sessions: number(row.metricValues?.[0]?.value), users: number(row.metricValues?.[1]?.value) }))
      .filter((row) => row.date)
      .sort((left, right) => left.date.localeCompare(right.date)),
    aiStatus: "available",
    generatedAt: new Date().toISOString(),
  };
}
