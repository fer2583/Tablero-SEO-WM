import { google } from "googleapis";
import { keywords, landingPages, traffic } from "@/lib/mock-data";

export type IntegrationStatus = "live" | "fallback";
export type IntegrationFilters = { days: 7 | 28 | 60 | 90; language: "all" | "es" | "en" | "pt"; country: string; device: "all" | "desktop" | "mobile" | "tablet"; page?: string; query?: string };
export type IntegrationResponse<T> = { status: IntegrationStatus; data: T; error?: string; generatedAt: string; metadata?: { rows: number; lastResponseAt: string; filters: IntegrationFilters } };
export type SearchConsoleData = { period: { start: string; end: string; previousStart: string; previousEnd: string }; metrics: { clicks: number; impressions: number; ctr: number; position: number }; previous: { clicks: number; impressions: number; ctr: number; position: number }; queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>; pages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }> };
export type AnalyticsData = { period: { start: string; end: string; previousStart: string; previousEnd: string }; metrics: { users: number; sessions: number; engagementRate: number; conversions: number }; previous: { users: number; sessions: number; engagementRate: number; conversions: number }; landingPages: Array<{ page: string; users: number; sessions: number; conversions: number }>; dailySessions: number[] };

export function dates(days: number) {
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - (days - 1));
  const previousEnd = new Date(start); previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd); previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1));
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { start: format(start), end: format(end), previousStart: format(previousStart), previousEnd: format(previousEnd) };
}

export function parseFilters(params: URLSearchParams): IntegrationFilters {
  const days = Number(params.get("days") ?? "28");
  const language = params.get("language") ?? "all";
  const device = params.get("device") ?? "all";
  const country = params.get("country") ?? "all";
  if (![7, 28, 60, 90].includes(days)) throw new Error("days debe ser 7, 28, 60 o 90.");
  if (!["all", "es", "en", "pt"].includes(language)) throw new Error("language no válido.");
  if (!["all", "desktop", "mobile", "tablet"].includes(device)) throw new Error("device no válido.");
  if (!/^(all|[A-Z]{2})$/.test(country)) throw new Error("country debe ser all o un código ISO de dos letras.");
  const clean = (value: string | null) => value?.trim().slice(0, 200) || undefined;
  return { days: days as IntegrationFilters["days"], language: language as IntegrationFilters["language"], country, device: device as IntegrationFilters["device"], page: clean(params.get("page")), query: clean(params.get("query")) };
}

function auth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credentials = raw ? JSON.parse(raw) : undefined;
  if (!credentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Falta la configuración de credenciales de Google.");
  return new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"] });
}
function number(value?: string | number | null) { return Number(value ?? 0); }
function summary(rows: Array<{ clicks?: string | number | null; impressions?: string | number | null; ctr?: string | number | null; position?: string | number | null }>) {
  const totals = rows.reduce<{ clicks: number; impressions: number; ctr: number; position: number }>((result, row) => { result.clicks += number(row.clicks); result.impressions += number(row.impressions); result.ctr += number(row.ctr); result.position += number(row.position); return result; }, { clicks: 0, impressions: 0, ctr: 0, position: 0 });
  return { clicks: totals.clicks, impressions: totals.impressions, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, position: rows.length ? totals.position / rows.length : 0 };
}
const parseMock = (value: string) => Number(value.replaceAll(".", "").replace(/K$/, "000").replace(",", "."));

export function fallbackSearchConsole(): SearchConsoleData { const period = dates(28); return { period, metrics: { clicks: 24860, impressions: 1240000, ctr: 0.0201, position: 11.8 }, previous: { clicks: 20999, impressions: 1100000, ctr: 0.0177, position: 13.9 }, queries: keywords.map((item) => ({ query: item.keyword, clicks: parseMock(item.clicks), impressions: parseMock(item.impressions), ctr: parseMock(item.ctr) / 100, position: parseMock(item.position) })), pages: landingPages.map((item) => ({ page: item.page, clicks: parseMock(item.clicks), impressions: parseMock(item.impressions), ctr: parseMock(item.ctr) / 100, position: parseMock(item.position) })) }; }
export function fallbackAnalytics(): AnalyticsData { const period = dates(28); return { period, metrics: { users: 26180, sessions: 31420, engagementRate: 0.648, conversions: 846 }, previous: { users: 23290, sessions: 27180, engagementRate: 0.607, conversions: 774 }, landingPages: landingPages.map((item) => ({ page: item.page, users: Math.round(parseMock(item.clicks) * 0.9), sessions: parseMock(item.clicks), conversions: Math.round(parseMock(item.clicks) * 0.02) })), dailySessions: traffic }; }

export async function fetchSearchConsole(filters: IntegrationFilters): Promise<SearchConsoleData> {
  const period = dates(filters.days); const client = google.searchconsole({ version: "v1", auth: auth() });
  const dimensionFilters = [filters.country !== "all" && { dimension: "country", operator: "equals", expression: filters.country.toLowerCase() }, filters.device !== "all" && { dimension: "device", operator: "equals", expression: filters.device }, filters.language !== "all" && { dimension: "page", operator: "includingRegex", expression: filters.language === "en" ? "/en/" : filters.language === "pt" ? "/pt/" : "^(?!.*\\/(en|pt)\\/).*" }, filters.page && { dimension: "page", operator: "includingRegex", expression: filters.page }, filters.query && { dimension: "query", operator: "includingRegex", expression: filters.query }].filter(Boolean) as Array<{ dimension: string; operator: string; expression: string }>;
  const request = (startDate: string, endDate: string, dimension: "query" | "page") => client.searchanalytics.query({ siteUrl: process.env.GSC_SITE_URL || "https://www.whalemate.com", requestBody: { startDate, endDate, dimensions: [dimension], dimensionFilterGroups: dimensionFilters.length ? [{ groupType: "and", filters: dimensionFilters }] : undefined, rowLimit: 100 } });
  const [current, previous, pages] = await Promise.all([request(period.start, period.end, "query"), request(period.previousStart, period.previousEnd, "query"), request(period.start, period.end, "page")]);
  const rows = (current.data.rows ?? []).map((row) => ({ query: row.keys?.[0] ?? "", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }));
  const pageRows = (pages.data.rows ?? []).map((row) => ({ page: row.keys?.[0] ?? "", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }));
  return { period, metrics: summary(rows), previous: summary((previous.data.rows ?? []).map((row) => ({ clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }))), queries: rows, pages: pageRows };
}

export async function fetchAnalytics(filters: IntegrationFilters): Promise<AnalyticsData> {
  const period = dates(filters.days); const client = google.analyticsdata({ version: "v1beta", auth: auth() }); const property = `properties/${process.env.GA4_PROPERTY_ID}`;
  type MatchType = "EXACT" | "BEGINS_WITH" | "FULL_REGEXP" | "CONTAINS";
  const baseFilters = [filters.country !== "all" && { fieldName: "country", stringFilter: { matchType: "EXACT" as MatchType, value: filters.country } }, filters.device !== "all" && { fieldName: "deviceCategory", stringFilter: { matchType: "EXACT" as MatchType, value: filters.device } }, filters.language !== "all" && { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: (filters.language === "es" ? "FULL_REGEXP" : "BEGINS_WITH") as MatchType, value: filters.language === "en" ? "/en/" : filters.language === "pt" ? "/pt/" : "^(?!/en/)(?!/pt/).*" } }, filters.page && { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS" as MatchType, value: filters.page } }].filter(Boolean) as unknown as Array<{ fieldName: string; stringFilter: { matchType: MatchType; value: string } }>;
  const run = (startDate: string, endDate: string, dimensions: string[], metrics: string[]) => client.properties.runReport({ property, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), dimensionFilter: baseFilters.length === 1 ? { filter: baseFilters[0] } : baseFilters.length ? { andGroup: { expressions: baseFilters.map((filter) => ({ filter })) } } : undefined, limit: "100" } });
  const [totals, pages, daily, previous] = await Promise.all([run(period.start, period.end, [], ["totalUsers", "sessions", "engagementRate", "conversions"]), run(period.start, period.end, ["landingPagePlusQueryString"], ["totalUsers", "sessions", "conversions"]), run(period.start, period.end, ["date"], ["sessions"]), run(period.previousStart, period.previousEnd, [], ["totalUsers", "sessions", "engagementRate", "conversions"])]);
  const values = (report: typeof totals) => report.data.rows?.[0]?.metricValues?.map((item) => number(item.value)) ?? [0, 0, 0, 0]; const [users, sessions, engagementRate, conversions] = values(totals); const previousValues = values(previous);
  return { period, metrics: { users, sessions, engagementRate, conversions }, previous: { users: previousValues[0], sessions: previousValues[1], engagementRate: previousValues[2], conversions: previousValues[3] }, landingPages: (pages.data.rows ?? []).map((row) => ({ page: row.dimensionValues?.[0]?.value ?? "(not set)", users: number(row.metricValues?.[0]?.value), sessions: number(row.metricValues?.[1]?.value), conversions: number(row.metricValues?.[2]?.value) })), dailySessions: (daily.data.rows ?? []).map((row) => number(row.metricValues?.[0]?.value)) };
}
