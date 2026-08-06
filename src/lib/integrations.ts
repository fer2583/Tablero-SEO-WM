import { google } from "googleapis";
import { keywords, landingPages, traffic } from "@/lib/mock-data";

export type IntegrationStatus = "live" | "fallback";

export type IntegrationResponse<T> = {
  status: IntegrationStatus;
  data: T;
  error?: string;
  generatedAt: string;
};

export type SearchConsoleData = {
  period: { start: string; end: string; previousStart: string; previousEnd: string };
  metrics: { clicks: number; impressions: number; ctr: number; position: number };
  previous: { clicks: number; impressions: number; ctr: number; position: number };
  queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  pages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
};

export type AnalyticsData = {
  period: { start: string; end: string; previousStart: string; previousEnd: string };
  metrics: { users: number; sessions: number; engagementRate: number; conversions: number };
  previous: { users: number; sessions: number; engagementRate: number; conversions: number };
  landingPages: Array<{ page: string; users: number; sessions: number; conversions: number }>;
  dailySessions: number[];
};

function dates() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - 27);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { start: format(start), end: format(end), previousStart: format(previousStart), previousEnd: format(previousEnd) };
}

function auth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credentials = raw ? JSON.parse(raw) : undefined;
  if (!credentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON (o GOOGLE_APPLICATION_CREDENTIALS solo para desarrollo local). ");
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"],
  });
}

function number(value?: string | number | null) { return Number(value ?? 0); }

export function fallbackSearchConsole(): SearchConsoleData {
  const period = dates();
  return {
    period,
    metrics: { clicks: 24860, impressions: 1240000, ctr: 0.0201, position: 11.8 },
    previous: { clicks: 20999, impressions: 1100000, ctr: 0.0177, position: 13.9 },
    queries: keywords.map((item) => ({ query: item.keyword, clicks: Number(item.clicks.replaceAll(".", "")), impressions: Number(item.impressions.replace(/K$/, "000").replace(".", "")), ctr: Number(item.ctr.replace("%", "").replace(",", ".")) / 100, position: Number(item.position.replace(",", ".")) })),
    pages: landingPages.map((item) => ({ page: item.page, clicks: Number(item.clicks.replaceAll(".", "")), impressions: Number(item.impressions.replace(/K$/, "000").replace(".", "")), ctr: Number(item.ctr.replace("%", "").replace(",", ".")) / 100, position: Number(item.position.replace(",", ".")) })),
  };
}

export function fallbackAnalytics(): AnalyticsData {
  const period = dates();
  return { period, metrics: { users: 26180, sessions: 31420, engagementRate: 0.648, conversions: 846 }, previous: { users: 23290, sessions: 27180, engagementRate: 0.607, conversions: 774 }, landingPages: landingPages.map((item) => ({ page: item.page, users: Math.round(Number(item.clicks.replaceAll(".", "")) * 0.9), sessions: Number(item.clicks.replaceAll(".", "")), conversions: Math.round(Number(item.clicks.replaceAll(".", "")) * 0.02) })), dailySessions: traffic,
  };
}

function summary(rows: Array<{ clicks?: string | number; impressions?: string | number; ctr?: string | number; position?: string | number }>) {
  const totals = rows.reduce<{ clicks: number; impressions: number; ctr: number; position: number }>((result, row) => { result.clicks += number(row.clicks); result.impressions += number(row.impressions); result.ctr += number(row.ctr); result.position += number(row.position); return result; }, { clicks: 0, impressions: 0, ctr: 0, position: 0 });
  return { clicks: totals.clicks, impressions: totals.impressions, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, position: rows.length ? totals.position / rows.length : 0 };
}

export async function fetchSearchConsole(): Promise<SearchConsoleData> {
  const period = dates();
  const client = google.searchconsole({ version: "v1", auth: auth() });
  const request = (startDate: string, endDate: string, dimension: "query" | "page") => client.searchanalytics.query({ siteUrl: process.env.GSC_SITE_URL || "https://www.whalemate.com", requestBody: { startDate, endDate, dimensions: [dimension], rowLimit: 10 } });
  const [current, previous, pages] = await Promise.all([request(period.start, period.end, "query"), request(period.previousStart, period.previousEnd, "query"), request(period.start, period.end, "page")]);
  const rows = (current.data.rows ?? []).map((row) => ({ query: row.keys?.[0] ?? "", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }));
  const pageRows = (pages.data.rows ?? []).map((row) => ({ page: row.keys?.[0] ?? "", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }));
  return { period, metrics: summary(rows), previous: summary((previous.data.rows ?? []).map((row) => ({ clicks: String(row.clicks ?? 0), impressions: String(row.impressions ?? 0), ctr: String(row.ctr ?? 0), position: String(row.position ?? 0) }))), queries: rows, pages: pageRows };
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const period = dates();
  const client = google.analyticsdata({ version: "v1beta", auth: auth() });
  const property = `properties/${process.env.GA4_PROPERTY_ID}`;
  const run = (startDate: string, endDate: string, dimensions: string[], metrics: string[]) => client.properties.runReport({ property, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), limit: "100" } });
  const [totals, pages, daily, previous] = await Promise.all([run(period.start, period.end, [], ["totalUsers", "sessions", "engagementRate", "conversions"]), run(period.start, period.end, ["landingPagePlusQueryString"], ["totalUsers", "sessions", "conversions"]), run(period.start, period.end, ["date"], ["sessions"]), run(period.previousStart, period.previousEnd, [], ["totalUsers", "sessions", "engagementRate", "conversions"])]);
  const values = (report: typeof totals) => report.data.rows?.[0]?.metricValues?.map((item) => number(item.value)) ?? [0, 0, 0, 0];
  const [users, sessions, engagementRate, conversions] = values(totals);
  const previousValues = values(previous);
  return { period, metrics: { users, sessions, engagementRate, conversions }, previous: { users: previousValues[0], sessions: previousValues[1], engagementRate: previousValues[2], conversions: previousValues[3] }, landingPages: (pages.data.rows ?? []).map((row) => ({ page: row.dimensionValues?.[0]?.value ?? "(not set)", users: number(row.metricValues?.[0]?.value), sessions: number(row.metricValues?.[1]?.value), conversions: number(row.metricValues?.[2]?.value) })), dailySessions: (daily.data.rows ?? []).map((row) => number(row.metricValues?.[0]?.value)) };
}
