import { google } from "googleapis";

export type IntegrationStatus = "live" | "no_data" | "unavailable";
export type CompareMode = "previous" | "year";
export type IntegrationFilters = { days: 7 | 28 | 30 | 60 | 90; language: "all" | "es" | "en" | "pt"; country: string; region?: string; source?: string; device: "all" | "desktop" | "mobile" | "tablet"; page?: string; query?: string; compare: CompareMode };
export type IntegrationResponse<T> = { status: IntegrationStatus; data: T; error?: string; warnings?: string[]; generatedAt: string; metadata?: { rows?: number; lastResponseAt?: string; filters?: IntegrationFilters; snapshotAt?: Record<string, string | null> } };
export type SearchConsoleRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };
export type SearchConsolePage = { page: string; clicks: number; impressions: number; ctr: number; position: number; language: string; trend: number };
export type SearchConsoleDimensionRow = { dimension: string; value: string; clicks: number; impressions: number; ctr: number; position: number };
export type SearchConsoleData = { period: { start: string; end: string; previousStart: string; previousEnd: string }; metrics: { clicks: number | null; impressions: number | null; ctr: number | null; position: number }; previous: { clicks: number | null; impressions: number | null; ctr: number | null; position: number }; queries: SearchConsoleRow[]; pages: SearchConsolePage[]; dimensions?: { country: SearchConsoleDimensionRow[]; device: SearchConsoleDimensionRow[]; searchType: SearchConsoleDimensionRow[]; appearance: SearchConsoleDimensionRow[]; brand?: SearchConsoleDimensionRow[]; nonBrand?: SearchConsoleDimensionRow[] }; opportunities: { positions4to10: SearchConsoleRow[]; positions11to20: SearchConsoleRow[] } };
export type AnalyticsRow = { name: string; page: string; users: number; activeUsers?: number | null; newUsers?: number | null; sessions: number; conversions: number; keyEventsPerSession?: number | null; engagementRate: number; engagementDuration: number };
export type AiTrafficStatus = "available" | "unavailable";
export type AnalyticsData = { period: { start: string; end: string; previousStart: string; previousEnd: string }; metrics: { users: number | null; activeUsers?: number | null; newUsers: number | null; sessions: number | null; organicSessions: number | null; aiSessions: number | null; engagedSessions: number | null; engagementRate: number | null; engagementDuration: number | null; eventCount: number | null; conversions: number | null; keyEventsPerSession?: number | null }; previous: Omit<AnalyticsData["metrics"], "organicSessions"> & { organicSessions: number | null }; landingPages: AnalyticsRow[]; sources: AnalyticsRow[]; aiSources: AnalyticsRow[]; aiLandingPages: AnalyticsRow[]; countries: AnalyticsRow[]; regions?: AnalyticsRow[]; devices: AnalyticsRow[]; dailySessions: number[]; aiStatus: AiTrafficStatus; warnings: string[] };
export const ANALYTICS_VIEWS = ["Acquisition", "Conversions", "Device", "Geographic", "Page Path", "Monthly", "Weekly", "Daily"] as const;
export type AnalyticsView = typeof ANALYTICS_VIEWS[number];
export type AnalyticsViewRow = { name: string; page: string; users: number; sessions: number; activeUsers: number; newUsers: number; engagementRate: number; engagementDuration: number; conversions: number; keyEvents: number; keyEventsPerSession: number; eventCount: number };
export type AnalyticsViewData = { view: AnalyticsView; dimension: string; period: { start: string; end: string; previousStart: string; previousEnd: string }; metrics: { sessions: number | null; activeUsers: number | null; newUsers: number | null; engagementRate: number | null; conversions: number | null; keyEvents: number | null; keyEventsPerSession: number | null }; previous: AnalyticsViewData["metrics"]; rows: AnalyticsViewRow[]; warnings: string[] };

export const AI_REFERRAL_SOURCES = ["chat.openai.com", "chatgpt.com", "perplexity.ai", "claude.ai", "gemini.google.com", "copilot.microsoft.com", "you.com", "phind.com", "poe.com", "deepseek.com"] as const;
export const AI_REFERRAL_SOURCE_PATTERN = `^.*(${AI_REFERRAL_SOURCES.map((source) => source.replaceAll(".", "\\.")).join("|")}).*$`;

export function dates(days: number) { const end = new Date(); end.setUTCDate(end.getUTCDate() - 1); const start = new Date(end); start.setUTCDate(start.getUTCDate() - (days - 1)); const previousEnd = new Date(start); previousEnd.setUTCDate(previousEnd.getUTCDate() - 1); const previousStart = new Date(previousEnd); previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1)); const format = (date: Date) => date.toISOString().slice(0, 10); return { start: format(start), end: format(end), previousStart: format(previousStart), previousEnd: format(previousEnd) }; }
export function periods(days: number, compare: CompareMode = "previous") { const end = new Date(); end.setUTCDate(end.getUTCDate() - 1); const start = new Date(end); start.setUTCDate(start.getUTCDate() - (days - 1)); const format = (date: Date) => date.toISOString().slice(0, 10); let compareStart: Date; let compareEnd: Date; if (compare === "year") { compareStart = new Date(start); compareStart.setUTCFullYear(compareStart.getUTCFullYear() - 1); compareEnd = new Date(end); compareEnd.setUTCFullYear(compareEnd.getUTCFullYear() - 1); } else { compareEnd = new Date(start); compareEnd.setUTCDate(compareEnd.getUTCDate() - 1); compareStart = new Date(compareEnd); compareStart.setUTCDate(compareStart.getUTCDate() - (days - 1)); } return { start: format(start), end: format(end), compareStart: format(compareStart), compareEnd: format(compareEnd), compare }; }
export function periodFromFilters(filters: IntegrationFilters) { return periods(filters.days, filters.compare); }
export function parseFilters(params: URLSearchParams): IntegrationFilters { const days = Number(params.get("days") ?? "30"); const language = params.get("language") ?? "all"; const device = params.get("device") ?? "all"; const country = params.get("country") ?? "all"; const compare = params.get("compare") ?? "previous"; if (![7, 28, 30, 60, 90].includes(days)) throw new Error("days debe ser 7, 28, 30, 60 o 90."); if (!["all", "es", "en", "pt"].includes(language)) throw new Error("language no vÃ¡lido."); if (!["all", "desktop", "mobile", "tablet"].includes(device)) throw new Error("device no vÃ¡lido."); if (!["previous", "year"].includes(compare)) throw new Error("compare debe ser previous o year."); if (!/^(all|[A-Z]{2})$/.test(country)) throw new Error("country debe ser all o un cÃ³digo ISO de dos letras."); const clean = (value: string | null) => value?.trim().slice(0, 200) || undefined; return { days: days as IntegrationFilters["days"], language: language as IntegrationFilters["language"], country, region: clean(params.get("region")), source: clean(params.get("source")), device: device as IntegrationFilters["device"], page: clean(params.get("page")), query: clean(params.get("query")), compare: compare as CompareMode }; }
export function auth() { const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON; const credentials = raw ? JSON.parse(raw) : undefined; if (!credentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Falta la configuraciÃ³n de credenciales de Google."); return new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"] }); }
export function searchConsoleClient() { return google.searchconsole({ version: "v1", auth: auth() }); }
export const searchConsoleSite = () => process.env.GSC_SITE_URL || "sc-domain:whalemate.com";
function number(value?: string | number | null) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function summary(rows: Array<{ clicks?: string | number | null; impressions?: string | number | null; ctr?: string | number | null; position?: string | number | null }>) { const totals: { clicks: number; impressions: number; ctr: number; position: number } = { clicks: 0, impressions: 0, ctr: 0, position: 0 }; rows.forEach((row) => { totals.clicks += number(row.clicks); totals.impressions += number(row.impressions); totals.ctr += number(row.ctr); totals.position += number(row.position); }); return { clicks: totals.clicks, impressions: totals.impressions, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, position: rows.length ? totals.position / rows.length : 0 }; }
const pageLanguage = (page: string) => page.startsWith("/en/") ? "EN" : page.startsWith("/pt/") ? "PT" : "ES";

export async function fetchSearchConsole(filters: IntegrationFilters): Promise<SearchConsoleData> { const period = dates(filters.days); const client = google.searchconsole({ version: "v1", auth: auth() }); const dimensionFilters = [filters.country !== "all" && { dimension: "country", operator: "equals", expression: filters.country.toLowerCase() }, filters.device !== "all" && { dimension: "device", operator: "equals", expression: filters.device }, filters.language !== "all" && { dimension: "page", operator: "includingRegex", expression: filters.language === "en" ? "/en/" : filters.language === "pt" ? "/pt/" : "^(?!.*\\/(en|pt)\\/).*" }, filters.page && { dimension: "page", operator: "includingRegex", expression: filters.page }, filters.query && { dimension: "query", operator: "includingRegex", expression: filters.query }].filter(Boolean) as Array<{ dimension: string; operator: string; expression: string }>; const request = (startDate: string, endDate: string, dimension: "query" | "page") => client.searchanalytics.query({ siteUrl: process.env.GSC_SITE_URL || "https://www.whalemate.com", requestBody: { startDate, endDate, dimensions: [dimension], dimensionFilterGroups: dimensionFilters.length ? [{ groupType: "and", filters: dimensionFilters }] : undefined, rowLimit: 25000 } }); const [current, previous, pages, previousPages] = await Promise.all([request(period.start, period.end, "query"), request(period.previousStart, period.previousEnd, "query"), request(period.start, period.end, "page"), request(period.previousStart, period.previousEnd, "page")]); const rows = (current.data.rows ?? []).map((row) => ({ query: row.keys?.[0] ?? "", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 })); const oldPages = new Map((previousPages.data.rows ?? []).map((row) => [row.keys?.[0] ?? "", row.clicks ?? 0])); const pageRows = (pages.data.rows ?? []).map((row) => { const page = row.keys?.[0] ?? ""; const oldClicks = number(oldPages.get(page)); return { page, clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0, language: pageLanguage(page), trend: oldClicks ? ((number(row.clicks) - oldClicks) / oldClicks) * 100 : 0 }; }); return { period, metrics: summary(rows), previous: summary((previous.data.rows ?? []).map((row) => ({ clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }))), queries: rows, pages: pageRows, opportunities: { positions4to10: rows.filter((row) => row.position >= 4 && row.position <= 10), positions11to20: rows.filter((row) => row.position > 10 && row.position <= 20) } }; }

export async function fetchAnalytics(filters: IntegrationFilters): Promise<AnalyticsData> { const period = dates(filters.days); const client = google.analyticsdata({ version: "v1beta", auth: auth() }); const property = `properties/${process.env.GA4_PROPERTY_ID}`; type MatchType = "EXACT" | "FULL_REGEXP" | "CONTAINS"; type Filter = { fieldName: string; stringFilter: { matchType: MatchType; value: string } }; const organic: Filter = { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } }; const aiSource: Filter = { fieldName: "sessionSource", stringFilter: { matchType: "FULL_REGEXP", value: AI_REFERRAL_SOURCE_PATTERN } }; const filtersFor = (): Filter[] => [filters.country !== "all" && { fieldName: "countryId", stringFilter: { matchType: "EXACT", value: filters.country } }, filters.device !== "all" && { fieldName: "deviceCategory", stringFilter: { matchType: "EXACT", value: filters.device } }, filters.language !== "all" && { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "FULL_REGEXP", value: filters.language === "en" ? "^/en(?:/|$)" : filters.language === "pt" ? "^/pt(?:/|$)" : "^/(?!en(?:/|$)|pt(?:/|$))" } }, filters.page && { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS", value: filters.page } }].filter(Boolean) as Filter[]; const dimensionFilter = (extra: Filter[] = []) => { const all = [...extra, ...filtersFor()]; return all.length ? { andGroup: { expressions: all.map((filter) => ({ filter })) } } : undefined; }; const run = (startDate: string, endDate: string, dimensions: string[], metrics: string[], extra: Filter[] = []) => client.properties.runReport({ property, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), dimensionFilter: dimensionFilter(extra), limit: "100" } }); const warnings: string[] = []; const safeRun = async (label: string, start: string, end: string, dimensions: string[], metrics: string[], extra: Filter[] = []) => { try { return await run(start, end, dimensions, metrics, extra); } catch (error) { warnings.push(`${label}: ${error instanceof Error ? error.message : "GA4 rechazÃ³ la consulta."}`); return null; } }; const core = ["totalUsers", "newUsers", "sessions", "engagedSessions", "engagementRate", "conversions"]; const optional = ["userEngagementDuration", "eventCount"]; const [totals, oldTotals, organicTotals, oldOrganicTotals, optionalTotals, oldOptionalTotals, pages, sources, aiSources, aiLandingPages, countries, devices, daily] = await Promise.all([safeRun("MÃ©tricas principales", period.start, period.end, [], core), safeRun("ComparaciÃ³n", period.previousStart, period.previousEnd, [], core), safeRun("Sesiones orgÃ¡nicas", period.start, period.end, [], ["sessions"], [organic]), safeRun("ComparaciÃ³n orgÃ¡nica", period.previousStart, period.previousEnd, [], ["sessions"], [organic]), safeRun("MÃ©tricas opcionales", period.start, period.end, [], optional), safeRun("ComparaciÃ³n de mÃ©tricas opcionales", period.previousStart, period.previousEnd, [], optional), safeRun("Landing pages", period.start, period.end, ["landingPagePlusQueryString"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"]), safeRun("Fuente/medio", period.start, period.end, ["sessionSource", "sessionMedium"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"]), safeRun("Fuentes IA", period.start, period.end, ["sessionSource", "sessionMedium"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"], [aiSource]), safeRun("Landing pages IA", period.start, period.end, ["landingPagePlusQueryString"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"], [aiSource]), safeRun("PaÃ­s", period.start, period.end, ["country"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"]), safeRun("Dispositivo", period.start, period.end, ["deviceCategory"], ["totalUsers", "sessions", "conversions", "engagementRate", "userEngagementDuration"]), safeRun("Serie temporal", period.start, period.end, ["date"], ["sessions"]) ]); const values = (report: typeof totals, size: number) => report?.data.rows?.[0]?.metricValues?.map((item) => number(item.value)) ?? Array(size).fill(0) as number[]; const current = values(totals, core.length); const previous = values(oldTotals, core.length); const optionalValues = values(optionalTotals, optional.length); const oldOptionalValues = values(oldOptionalTotals, optional.length); const rows = (report: typeof pages): AnalyticsRow[] => (report?.data.rows ?? []).map((row) => { const name = row.dimensionValues?.map((value) => value.value ?? "(not set)").join(" / ") || "(not set)"; return { name, page: name, users: number(row.metricValues?.[0]?.value), sessions: number(row.metricValues?.[1]?.value), conversions: number(row.metricValues?.[2]?.value), engagementRate: number(row.metricValues?.[3]?.value), engagementDuration: number(row.metricValues?.[4]?.value) }; }); const organicValues = values(organicTotals, 1); const oldOrganicValues = values(oldOrganicTotals, 1); const aiRows = rows(aiSources); const metrics = { users: current[0], newUsers: current[1], sessions: current[2], organicSessions: organicValues[0], aiSessions: aiRows.reduce((sum, row) => sum + row.sessions, 0), engagedSessions: current[3], engagementRate: current[4], engagementDuration: optionalValues[0], eventCount: optionalValues[1], conversions: current[5] }; const old = { users: previous[0], newUsers: previous[1], sessions: previous[2], organicSessions: oldOrganicValues[0], aiSessions: 0, engagedSessions: previous[3], engagementRate: previous[4], engagementDuration: oldOptionalValues[0], eventCount: oldOptionalValues[1], conversions: previous[5] }; return { period, metrics, previous: old, landingPages: rows(pages), sources: rows(sources), aiSources: aiRows, aiLandingPages: rows(aiLandingPages), countries: rows(countries), devices: rows(devices), dailySessions: (daily?.data.rows ?? []).map((row) => number(row.metricValues?.[0]?.value)), aiStatus: aiSources ? "available" : "unavailable", warnings }; }
export async function fetchAnalyticsView(filters: IntegrationFilters, view: AnalyticsView): Promise<AnalyticsViewData> {
  const period = dates(filters.days);
  const client = google.analyticsdata({ version: "v1beta", auth: auth() });
  const property = `properties/${process.env.GA4_PROPERTY_ID}`;
  type MatchType = "EXACT" | "FULL_REGEXP" | "CONTAINS";
  type Filter = { fieldName: string; stringFilter: { matchType: MatchType; value: string } };
  type FilterExpression = { filter: Filter } | { notExpression: { filter: Filter } };
  const organic: Filter = { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } };
  const filtersFor = (): FilterExpression[] => [
    filters.source && { filter: { fieldName: "sessionSourceMedium", stringFilter: { matchType: "EXACT", value: filters.source } } },
    filters.country !== "all" && { filter: { fieldName: "countryId", stringFilter: { matchType: "EXACT", value: filters.country } } },
    filters.region && { filter: { fieldName: "region", stringFilter: { matchType: "EXACT", value: filters.region } } },
    filters.device !== "all" && { filter: { fieldName: "deviceCategory", stringFilter: { matchType: "EXACT", value: filters.device } } },
    filters.language === "en" && { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "FULL_REGEXP", value: "^/en(?:/|$)" } } },
    filters.language === "pt" && { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "FULL_REGEXP", value: "^/pt(?:/|$)" } } },
    filters.language === "es" && { notExpression: { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS", value: "/en" } } } },
    filters.language === "es" && { notExpression: { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS", value: "/pt" } } } },
    filters.page && { filter: { fieldName: "landingPagePlusQueryString", stringFilter: { matchType: "CONTAINS", value: filters.page } } },
  ].filter(Boolean) as FilterExpression[];
  const dimensionByView: Record<AnalyticsView, { names: string[]; label: string }> = {
    Acquisition: { names: ["sessionSourceMedium"], label: "sessionSourceMedium" },
    Conversions: { names: ["eventName"], label: "eventName" },
    Device: { names: ["deviceCategory"], label: "deviceCategory" },
    Geographic: { names: ["country", "region"], label: "country / region" },
    "Page Path": { names: ["landingPagePlusQueryString"], label: "landingPagePlusQueryString" },
    Monthly: { names: ["month"], label: "month" },
    Weekly: { names: ["week"], label: "week" },
    Daily: { names: ["date"], label: "date" },
  };
  const dimensions = dimensionByView[view];
  const metricNames = ["sessions", "activeUsers", "newUsers", "engagementRate", "keyEvents", "eventsPerSession", "eventCount", "averageSessionDuration"];
  const request = (startDate: string, endDate: string, withDimensions: boolean) => client.properties.runReport({ property, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: withDimensions ? dimensions.names.map((name) => ({ name })) : undefined, metrics: metricNames.map((name) => ({ name })), dimensionFilter: { andGroup: { expressions: [{ filter: organic }, ...filtersFor()] } }, limit: "1000", keepEmptyRows: false } });
  const [current, currentSummary, previous] = await Promise.all([request(period.start, period.end, true), request(period.start, period.end, false), request(period.previousStart, period.previousEnd, false)]);
  const value = (row: { metricValues?: Array<{ value?: string | null }> }, index: number) => {
    const parsed = Number(row.metricValues?.[index]?.value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const metrics = (row: { metricValues?: Array<{ value?: string | null }> } | undefined) => ({ sessions: value(row ?? {}, 0), activeUsers: value(row ?? {}, 1), newUsers: value(row ?? {}, 2), engagementRate: value(row ?? {}, 3), conversions: value(row ?? {}, 4), keyEvents: value(row ?? {}, 4), keyEventsPerSession: value(row ?? {}, 5) });
  const rows = (current.data.rows ?? []).map((row) => ({ name: (row.dimensionValues ?? []).map((item) => item.value ?? "").join(" / ") || "(not set)", page: "", users: value(row, 1) ?? 0, sessions: value(row, 0) ?? 0, activeUsers: value(row, 1) ?? 0, newUsers: value(row, 2) ?? 0, engagementRate: value(row, 3) ?? 0, engagementDuration: value(row, 7) ?? 0, conversions: value(row, 4) ?? 0, keyEvents: value(row, 4) ?? 0, keyEventsPerSession: value(row, 5) ?? 0, eventCount: value(row, 6) ?? 0 }));
  return { view, dimension: dimensions.label, period, metrics: metrics(currentSummary.data.rows?.[0]), previous: metrics(previous.data.rows?.[0]), rows, warnings: [] };
}

type DailyGscRow = { day: string; query?: string; pageUrl?: string; clicks: number; impressions: number; ctr: number; position: number };
export type DailyGscData = { performance: DailyGscRow[]; queries: DailyGscRow[]; pages: DailyGscRow[]; queryPages: DailyGscRow[] };
const gscDay = (value: string) => value.length === 8 ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;

type GscApiRow = { keys?: string[] | null; clicks?: number | null; impressions?: number | null; ctr?: number | null; position?: number | null };

/** Lee todas las pÃ¡ginas de resultados de GSC (startRow) hasta un tope explÃ­cito. */
async function gscPaginated(dimensions: string[], startDate: string, endDate: string, maxRows = 25_000): Promise<GscApiRow[]> {
  const client = searchConsoleClient();
  const rows: GscApiRow[] = [];
  const pageSize = 25_000;
  let startRow = 0;
  while (rows.length < maxRows) {
    const response = await client.searchanalytics.query({ siteUrl: searchConsoleSite(), requestBody: { startDate, endDate, dimensions, rowLimit: pageSize, startRow } });
    const batch = response.data.rows ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    startRow += pageSize;
  }
  return rows.slice(0, maxRows);
}

const gscBase = (row: GscApiRow) => ({ day: gscDay(row.keys?.[0] ?? ""), clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), position: number(row.position) });

/**
 * Ingesta diaria. `topQueriesPerDay` protege el almacenamiento: guardar 25.000
 * queries por dÃ­a crece ~150 MB/mes y agota el free tier de Neon.
 */
export async function fetchSearchConsoleDaily(days = 30, topQueriesPerDay = 500): Promise<DailyGscData> {
  const period = dates(days);
  return fetchSearchConsoleRange(period.start, period.end, topQueriesPerDay);
}

export async function fetchSearchConsoleRange(startDate: string, endDate: string, topQueriesPerDay = 500): Promise<DailyGscData> {
  const [performance, queries, pages, queryPages] = await Promise.all([
    gscPaginated(["date"], startDate, endDate, 1_000),
    gscPaginated(["date", "query"], startDate, endDate, 25_000),
    gscPaginated(["date", "page"], startDate, endDate, 25_000),
    gscPaginated(["date", "query", "page"], startDate, endDate, 25_000),
  ]);
  const queryRows = queries.map((row) => ({ ...gscBase(row), query: row.keys?.[1] ?? "" }));
  const queryPageRows = queryPages.map((row) => ({ ...gscBase(row), query: row.keys?.[1] ?? "", pageUrl: row.keys?.[2] ?? "" }));
  const topByDay = new Map<string, Set<string>>();
  const grouped = new Map<string, DailyGscRow[]>();
  for (const row of queryRows) {
    const list = grouped.get(row.day) ?? [];
    list.push(row);
    grouped.set(row.day, list);
  }
  for (const [day, list] of grouped) {
    const top = [...list].sort((a, b) => b.impressions - a.impressions).slice(0, topQueriesPerDay);
    topByDay.set(day, new Set(top.map((row) => row.query ?? "")));
  }
  const keptQueries = queryRows.filter((row) => topByDay.get(row.day)?.has(row.query ?? ""));
  const keptQueryPages = queryPageRows.filter((row) => topByDay.get(row.day)?.has(row.query ?? ""));
  return {
    performance: performance.map(gscBase),
    queries: keptQueries,
    pages: pages.map((row) => ({ ...gscBase(row), pageUrl: row.keys?.[1] ?? "" })),
    queryPages: keptQueryPages,
  };
}

export type DailyGa4Data = { daily: Array<{ day: string; channel: string; users: number; sessions: number; engagedSessions: number; conversions: number; engagementRate: number; engagementDuration: number }>; landingPages: Array<{ day: string; landingPage: string; users: number; sessions: number; conversions: number; engagementRate: number }>; aiDaily: Array<{ day: string; source: string; users: number; sessions: number; conversions: number }> };

type Ga4DimensionFilter = { filter: { fieldName: string; stringFilter: { matchType: "EXACT" | "FULL_REGEXP" | "CONTAINS"; value: string } } };

export async function fetchAnalyticsDaily(days = 30): Promise<DailyGa4Data> {
  const period = dates(days);
  return fetchAnalyticsRange(period.start, period.end);
}

export async function fetchAnalyticsRange(startDate: string, endDate: string): Promise<DailyGa4Data> {
  const client = google.analyticsdata({ version: "v1beta", auth: auth() });
  const property = `properties/${process.env.GA4_PROPERTY_ID}`;
  const organic: Ga4DimensionFilter = { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } };
  const aiSource: Ga4DimensionFilter = { filter: { fieldName: "sessionSource", stringFilter: { matchType: "FULL_REGEXP", value: AI_REFERRAL_SOURCE_PATTERN } } };
  const run = (dimensions: string[], metrics: string[], filters: Ga4DimensionFilter[] = [organic]) => client.properties.runReport({ property, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), dimensionFilter: { andGroup: { expressions: filters } }, limit: "25000" } });
  const [daily, landing, ai] = await Promise.all([
    run(["date", "sessionDefaultChannelGroup"], ["totalUsers", "sessions", "engagedSessions", "conversions", "engagementRate", "userEngagementDuration"]),
    run(["date", "landingPagePlusQueryString"], ["totalUsers", "sessions", "conversions", "engagementRate"]),
    run(["date", "sessionSource"], ["totalUsers", "sessions", "conversions"], [aiSource]),
  ]);
  const value = (row: { metricValues?: Array<{ value?: string | null }> }, index: number) => number(row.metricValues?.[index]?.value);
  const day = (value: string) => value.length === 8 ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
  return { daily: (daily.data.rows ?? []).map((row) => ({ day: day(row.dimensionValues?.[0]?.value ?? ""), channel: row.dimensionValues?.[1]?.value ?? "Organic Search", users: value(row, 0), sessions: value(row, 1), engagedSessions: value(row, 2), conversions: value(row, 3), engagementRate: value(row, 4), engagementDuration: value(row, 5) })), landingPages: (landing.data.rows ?? []).map((row) => ({ day: day(row.dimensionValues?.[0]?.value ?? ""), landingPage: row.dimensionValues?.[1]?.value ?? "", users: value(row, 0), sessions: value(row, 1), conversions: value(row, 2), engagementRate: value(row, 3) })), aiDaily: (ai.data.rows ?? []).map((row) => ({ day: day(row.dimensionValues?.[0]?.value ?? ""), source: row.dimensionValues?.[1]?.value ?? "", users: value(row, 0), sessions: value(row, 1), conversions: value(row, 2) })) };
}

export type SearchConsoleWorkspaceTab = "performance" | "queries" | "geographic" | "device" | "site-url";
export type SearchConsoleWorkspaceRow = { dimension: string; page?: string; clicks: number; impressions: number; ctr: number; position: number };
export type SearchConsoleWorkspaceData = { tab: SearchConsoleWorkspaceTab; period: ReturnType<typeof dates>; metrics: { clicks: number; impressions: number; ctr: number; position: number }; previous: { clicks: number; impressions: number; ctr: number; position: number }; rows: SearchConsoleWorkspaceRow[] };

export async function fetchSearchConsoleWorkspace(filters: IntegrationFilters, tab: SearchConsoleWorkspaceTab): Promise<SearchConsoleWorkspaceData> {
  const window = periods(filters.days, filters.compare);
  const period = { start: window.start, end: window.end, previousStart: window.compareStart, previousEnd: window.compareEnd };
  const client = searchConsoleClient();
  const dimension = tab === "performance" ? ["date"] : tab === "queries" ? ["query", "page"] : tab === "geographic" ? ["country"] : tab === "device" ? ["device"] : ["page"];
  const dimensionFilters = [
    filters.country !== "all" && { dimension: "country", operator: "equals", expression: filters.country.toLowerCase() },
    filters.device !== "all" && { dimension: "device", operator: "equals", expression: filters.device },
    filters.language !== "all" && { dimension: "page", operator: "includingRegex", expression: filters.language === "en" ? "/en/" : filters.language === "pt" ? "/pt/" : "^(?!.*\\/(en|pt)\\/).*" },
    filters.page && { dimension: "page", operator: "includingRegex", expression: filters.page },
    filters.query && { dimension: "query", operator: "includingRegex", expression: filters.query },
  ].filter(Boolean) as Array<{ dimension: string; operator: string; expression: string }>;
  const request = (startDate: string, endDate: string, dimensions?: string[]) => client.searchanalytics.query({ siteUrl: searchConsoleSite(), requestBody: { startDate, endDate, dimensions, dimensionFilterGroups: dimensionFilters.length ? [{ groupType: "and", filters: dimensionFilters }] : undefined, rowLimit: 25_000 } });
  const paginate = async (startDate: string, endDate: string, dimensions: string[]) => {
    const rows: Array<{ keys?: string[] | null; clicks?: number | null; impressions?: number | null; ctr?: number | null; position?: number | null }> = [];
    let startRow = 0;
    while (rows.length < 25_000) {
      const response = await client.searchanalytics.query({ siteUrl: searchConsoleSite(), requestBody: { startDate, endDate, dimensions, dimensionFilterGroups: dimensionFilters.length ? [{ groupType: "and", filters: dimensionFilters }] : undefined, rowLimit: 25_000, startRow } });
      const batch = response.data.rows ?? [];
      rows.push(...batch);
      if (batch.length < 25_000) break;
      startRow += 25_000;
    }
    return rows.slice(0, 25_000);
  };
  const [currentRows, currentSummary, previousSummary] = await Promise.all([paginate(period.start, period.end, dimension), request(period.start, period.end), request(period.previousStart, period.previousEnd)]);
  const rows = currentRows.map((row) => ({ dimension: row.keys?.[0] ?? "", page: tab === "queries" ? row.keys?.[1] ?? "" : undefined, clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), position: number(row.position) }));
  const aggregate = (response: { data: { rows?: Array<{ clicks?: number | null; impressions?: number | null; ctr?: number | null; position?: number | null }> } }) => {
    const row = response.data.rows?.[0];
    return { clicks: number(row?.clicks), impressions: number(row?.impressions), ctr: number(row?.impressions) ? number(row?.clicks) / number(row?.impressions) : 0, position: number(row?.position) };
  };
  return { tab, period, metrics: aggregate(currentSummary), previous: aggregate(previousSummary), rows };
}

