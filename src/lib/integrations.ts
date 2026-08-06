import { google } from "googleapis";
import { keywords, landingPages, traffic } from "@/lib/mock-data";

export type IntegrationStatus = "live" | "fallback";
export type IntegrationFilters = { days: 7 | 28 | 60 | 90; language: "all" | "es" | "en" | "pt"; country: string; device: "all" | "desktop" | "mobile" | "tablet"; page?: string; query?: string };
export type IntegrationResponse<T> = { status: IntegrationStatus; data: T; error?: string; warnings?: string[]; generatedAt: string; metadata?: { rows: number; lastResponseAt: string; filters: IntegrationFilters } };
export type SearchConsoleRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };
export type SearchConsolePage = { page: string; clicks: number; impressions: number; ctr: number; position: number; language: string; trend: number };
export type SearchConsoleData = { period: { start: string; end: string; previousStart: string; previousEnd: string }; metrics: { clicks: number; impressions: number; ctr: number; position: number }; previous: { clicks: number; impressions: number; ctr: number; position: number }; queries: SearchConsoleRow[]; pages: SearchConsolePage[]; opportunities: { positions4to10: SearchConsoleRow[]; positions11to20: SearchConsoleRow[] } };
export type AnalyticsRow = { name: string; page: string; users: number; sessions: number; conversions: number; engagementRate: number; engagementDuration: number };
export type AnalyticsData = { period: { start: string; end: string; previousStart: string; previousEnd: string }; metrics: { users: number; newUsers: number; sessions: number; organicSessions: number; engagedSessions: number; engagementRate: number; engagementDuration: number; eventCount: number; conversions: number }; previous: Omit<AnalyticsData["metrics"], "organicSessions"> & { organicSessions: number }; landingPages: AnalyticsRow[]; sources: AnalyticsRow[]; countries: AnalyticsRow[]; devices: AnalyticsRow[]; dailySessions: number[]; warnings: string[] };

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
function number(value?: string | number | null) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function summary(rows: Array<{ clicks?: string | number | null; impressions?: string | number | null; ctr?: string | number | null; position?: string | number | null }>) {
  const totals = rows.reduce<{ clicks: number; impressions: number; ctr: number; position: number }>((result, row) => { result.clicks += number(row.clicks); result.impressions += number(row.impressions); result.ctr += number(row.ctr); result.position += number(row.position); return result; }, { clicks: 0, impressions: 0, ctr: 0, position: 0 });
  return { clicks: totals.clicks, impressions: totals.impressions, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, position: rows.length ? totals.position / rows.length : 0 };
}
const parseMock = (value: string) => Number(value.replaceAll(".", "").replace(/K$/, "000").replace(",", "."));
const pageLanguage = (page: string) => page.startsWith("/en/") ? "EN" : page.startsWith("/pt/") ? "PT" : "ES";

export function fallbackSearchConsole(days: IntegrationFilters["days"] = 28): SearchConsoleData { const period = dates(days); const queries = keywords.map((item) => ({ query: item.keyword, clicks: parseMock(item.clicks), impressions: parseMock(item.impressions), ctr: parseMock(item.ctr) / 100, position: parseMock(item.position) })); return { period, metrics: { clicks: 24860, impressions: 1240000, ctr: 0.0201, position: 11.8 }, previous: { clicks: 20999, impressions: 1100000, ctr: 0.0177, position: 13.9 }, queries, pages: landingPages.map((item) => ({ page: item.page, clicks: parseMock(item.clicks), impressions: parseMock(item.impressions), ctr: parseMock(item.ctr) / 100, position: parseMock(item.position), language: item.language, trend: Number(item.trend.replace("%", "")) })), opportunities: { positions4to10: queries.filter((item) => item.position >= 4 && item.position <= 10), positions11to20: queries.filter((item) => item.position > 10 && item.position <= 20) } }; }
export function fallbackAnalytics(days: IntegrationFilters["days"] = 28): AnalyticsData { const period = dates(days); const pages = landingPages.map((item) => ({ name: item.page, page: item.page, users: Math.round(parseMock(item.clicks) * 0.9), sessions: parseMock(item.clicks), conversions: Math.round(parseMock(item.clicks) * 0.02), engagementRate: 0.64, engagementDuration: 48 })); const row = (name: string, users: number, sessions: number, conversions: number): AnalyticsRow => ({ name, page: name, users, sessions, conversions, engagementRate: 0.648, engagementDuration: 48 }); return { period, metrics: { users: 26180, newUsers: 18940, sessions: 31420, organicSessions: 31420, engagedSessions: 20354, engagementRate: 0.648, engagementDuration: 1548200, eventCount: 118640, conversions: 846 }, previous: { users: 23290, newUsers: 16300, sessions: 27180, organicSessions: 27180, engagedSessions: 16499, engagementRate: 0.607, engagementDuration: 1324400, eventCount: 101210, conversions: 774 }, landingPages: pages, sources: [row("google / organic", 21300, 25800, 710), row("(direct) / (none)", 3200, 3500, 64), row("linkedin.com / referral", 1680, 2120, 42)], countries: [row("España", 12800, 15500, 420), row("México", 4100, 5000, 120), row("Estados Unidos", 2900, 3400, 98)], devices: [row("mobile", 14800, 17600, 410), row("desktop", 10200, 12500, 380), row("tablet", 1180, 1320, 28)], dailySessions: traffic.slice(-days), warnings: [] }; }

export async function fetchSearchConsole(filters: IntegrationFilters): Promise<SearchConsoleData> {
  const period = dates(filters.days); const client = google.searchconsole({ version: "v1", auth: auth() });
  const dimensionFilters = [filters.country !== "all" && { dimension: "country", operator: "equals", expression: filters.country.toLowerCase() }, filters.device !== "all" && { dimension: "device", operator: "equals", expression: filters.device }, filters.language !== "all" && { dimension: "page", operator: "includingRegex", expression: filters.language === "en" ? "/en/" : filters.language === "pt" ? "/pt/" : "^(?!.*\\/(en|pt)\\/).*" }, filters.page && { dimension: "page", operator: "includingRegex", expression: filters.page }, filters.query && { dimension: "query", operator: "includingRegex", expression: filters.query }].filter(Boolean) as Array<{ dimension: string; operator: string; expression: string }>;
  const request = (startDate: string, endDate: string, dimension: "query" | "page") => client.searchanalytics.query({ siteUrl: process.env.GSC_SITE_URL || "https://www.whalemate.com", requestBody: { startDate, endDate, dimensions: [dimension], dimensionFilterGroups: dimensionFilters.length ? [{ groupType: "and", filters: dimensionFilters }] : undefined, rowLimit: 100 } });
  const [current, previous, pages, previousPages] = await Promise.all([request(period.start, period.end, "query"), request(period.previousStart, period.previousEnd, "query"), request(period.start, period.end, "page"), request(period.previousStart, period.previousEnd, "page")]);
  const rows = (current.data.rows ?? []).map((row) => ({ query: row.keys?.[0] ?? "", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }));
  const oldPages = new Map((previousPages.data.rows ?? []).map((row) => [row.keys?.[0] ?? "", row.clicks ?? 0]));
  const pageRows = (pages.data.rows ?? []).map((row) => { const page = row.keys?.[0] ?? ""; const oldClicks = number(oldPages.get(page)); return { page, clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0, language: pageLanguage(page), trend: oldClicks ? ((number(row.clicks) - oldClicks) / oldClicks) * 100 : 0 }; });
  return { period, metrics: summary(rows), previous: summary((previous.data.rows ?? []).map((row) => ({ clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }))), queries: rows, pages: pageRows, opportunities: { positions4to10: rows.filter((row) => row.position >= 4 && row.position <= 10), positions11to20: rows.filter((row) => row.position > 10 && row.position <= 20) } };
}

export async function fetchAnalytics(filters: IntegrationFilters): Promise<AnalyticsData> {
  const period = dates(filters.days); const client = google.analyticsdata({ version: "v1beta", auth: auth() }); const property = `properties/${process.env.GA4_PROPERTY_ID}`;
  type MatchType = "EXACT" | "FULL_REGEXP" | "CONTAINS";
  type Filter = { fieldName: string; stringFilter: { matchType: MatchType; value: string } };
  const organic: Filter = { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } };
  const organicMedium: Filter = { fieldName: "sessionMedium", stringFilter: { matchType: "EXACT", value: "organic" } };
  const filtersFor = (): Filter[] => [filters.country !== "all" && { fieldName: "countryId", stringFilter: { matchType: "EXACT", value: filters.country } }, filters.device !== "all" && { fieldName: "deviceCategory", stringFilter: { matchType: "EXACT", value: filters.device } }, filters.language !== "all" && { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "FULL_REGEXP", value: filters.language === "en" ? "^/en(?:/|$)" : filters.language === "pt" ? "^/pt(?:/|$)" : "^/(?!en(?:/|$)|pt(?:/|$))" } }, filters.page && { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS", value: filters.page } }].filter(Boolean) as Filter[];
  const dimensionFilter = () => ({ andGroup: { expressions: [{ orGroup: { expressions: [{ filter: organic }, { filter: organicMedium }] } }, ...filtersFor().map((filter) => ({ filter }))] } });
  const run = (startDate: string, endDate: string, dimensions: string[], metrics: string[]) => client.properties.runReport({ property, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), dimensionFilter: dimensionFilter(), limit: "100" } });
  const warnings: string[] = [];
  const safeRun = async (label: string, start: string, end: string, dimensions: string[], metrics: string[]) => { try { return await run(start, end, dimensions, metrics); } catch (error) { warnings.push(`${label}: ${error instanceof Error ? error.message : "GA4 rechazó la consulta."}`); return null; } };
  const core = ["totalUsers", "newUsers", "sessions", "engagedSessions", "engagementRate", "conversions"];
  const optional = ["userEngagementDuration", "eventCount"];
  const [totals, oldTotals, optionalTotals, oldOptionalTotals, pages, sources, countries, devices, daily] = await Promise.all([safeRun("Métricas principales", period.start, period.end, [], core), safeRun("Comparación", period.previousStart, period.previousEnd, [], core), safeRun("Métricas opcionales", period.start, period.end, [], optional), safeRun("Comparación de métricas opcionales", period.previousStart, period.previousEnd, [], optional), safeRun("Landing pages", period.start, period.end, ["landingPagePlusQueryString"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"]), safeRun("Fuente/medio", period.start, period.end, ["sessionSource", "sessionMedium"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"]), safeRun("País", period.start, period.end, ["country"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"]), safeRun("Dispositivo", period.start, period.end, ["deviceCategory"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"]), safeRun("Serie temporal", period.start, period.end, ["date"], ["sessions"])]);
  const values = (report: typeof totals, size: number) => report?.data.rows?.[0]?.metricValues?.map((item) => number(item.value)) ?? Array(size).fill(0) as number[];
  const current = values(totals, core.length); const previous = values(oldTotals, core.length); const optionalValues = values(optionalTotals, optional.length); const oldOptionalValues = values(oldOptionalTotals, optional.length);
  const rows = (report: typeof pages): AnalyticsRow[] => (report?.data.rows ?? []).map((row) => { const name = row.dimensionValues?.map((value) => value.value ?? "(not set)").join(" / ") || "(not set)"; return { name, page: name, users: number(row.metricValues?.[0]?.value), sessions: number(row.metricValues?.[1]?.value), conversions: number(row.metricValues?.[2]?.value), engagementRate: number(row.metricValues?.[3]?.value), engagementDuration: number(row.metricValues?.[4]?.value) }; });
  const metrics = { users: current[0], newUsers: current[1], sessions: current[2], organicSessions: current[2], engagedSessions: current[3], engagementRate: current[4], engagementDuration: optionalValues[0], eventCount: optionalValues[1], conversions: current[5] };
  const old = { users: previous[0], newUsers: previous[1], sessions: previous[2], organicSessions: previous[2], engagedSessions: previous[3], engagementRate: previous[4], engagementDuration: oldOptionalValues[0], eventCount: oldOptionalValues[1], conversions: previous[5] };
  return { period, metrics, previous: old, landingPages: rows(pages), sources: rows(sources), countries: rows(countries), devices: rows(devices), dailySessions: (daily?.data.rows ?? []).map((row) => number(row.metricValues?.[0]?.value)), warnings };
}
