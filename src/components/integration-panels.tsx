"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/charts";
import { Card, CardHeader, Change, DataSourceBadge } from "@/components/ui";
import type { AnalyticsData, IntegrationResponse, SearchConsoleData } from "@/lib/integrations";
import { traffic } from "@/lib/mock-data";

const formatNumber = (value: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
const formatPercent = (value: number) => `${(value * 100).toFixed(2).replace(".", ",")}%`;
const change = (value: number, previous: number, suffix = "%") => `${value >= previous ? "+" : ""}${previous ? (((value - previous) / previous) * 100).toFixed(1).replace(".", ",") : "0"}${suffix}`;
const errorText = (error?: string) => error ? <small className="integration-error">{error}</small> : null;

function useIntegration<T>(url: string, initial: T) {
  const [response, setResponse] = useState<IntegrationResponse<T> | null>(null);
  useEffect(() => { fetch(url).then((result) => result.json()).then(setResponse).catch((error) => setResponse({ status: "fallback", data: initial, error: error.message, generatedAt: new Date().toISOString() })); }, [url, initial]);
  return response ?? { status: "fallback" as const, data: initial, generatedAt: new Date().toISOString() };
}

const initialSearch: SearchConsoleData = { period: { start: "", end: "", previousStart: "", previousEnd: "" }, metrics: { clicks: 24860, impressions: 1240000, ctr: 0.0201, position: 11.8 }, previous: { clicks: 20999, impressions: 1100000, ctr: 0.0177, position: 13.9 }, queries: [], pages: [] };
const initialAnalytics: AnalyticsData = { period: { start: "", end: "", previousStart: "", previousEnd: "" }, metrics: { users: 26180, sessions: 31420, engagementRate: 0.648, conversions: 846 }, previous: { users: 23290, sessions: 27180, engagementRate: 0.607, conversions: 774 }, landingPages: [], dailySessions: traffic };

export function SearchConsoleLive() {
  const response = useIntegration("/api/integrations/search-console", initialSearch);
  const { data } = response;
  return <><div className="mini-kpis"><Metric label="Clics" value={formatNumber(data.metrics.clicks)} change={change(data.metrics.clicks, data.previous.clicks)} /><Metric label="Impresiones" value={formatNumber(data.metrics.impressions)} change={change(data.metrics.impressions, data.previous.impressions)} /><Metric label="CTR medio" value={formatPercent(data.metrics.ctr)} change={change(data.metrics.ctr, data.previous.ctr, " pp")} /><Metric label="Posición media" value={data.metrics.position.toFixed(1).replace(".", ",")} change={`${(data.metrics.position - data.previous.position).toFixed(1).replace(".", ",")} posiciones`} /></div><Card><CardHeader title="Consultas principales" detail={`${data.period.start} — ${data.period.end} · comparación anterior`} action={<DataSourceBadge live={response.status === "live"} error={response.error} />} /><DataTable headers={["Consulta", "Clics", "Impresiones", "CTR", "Posición"]} rows={data.queries.map((item) => [item.query, formatNumber(item.clicks), formatNumber(item.impressions), formatPercent(item.ctr), item.position.toFixed(1).replace(".", ",")])} />{errorText(response.error)}</Card></>;
}

export function AnalyticsLive() {
  const response = useIntegration("/api/integrations/analytics", initialAnalytics);
  const { data } = response;
  return <><div className="mini-kpis"><Metric label="Usuarios" value={formatNumber(data.metrics.users)} change={change(data.metrics.users, data.previous.users)} /><Metric label="Sesiones orgánicas" value={formatNumber(data.metrics.sessions)} change={change(data.metrics.sessions, data.previous.sessions)} /><Metric label="Engagement" value={formatPercent(data.metrics.engagementRate)} change={change(data.metrics.engagementRate, data.previous.engagementRate, " pp")} /><Metric label="Conversiones / key events" value={formatNumber(data.metrics.conversions)} change={change(data.metrics.conversions, data.previous.conversions)} /></div><div className="dashboard-grid"><Card className="wide-card"><CardHeader title="Sesiones" detail={`${data.period.start} — ${data.period.end}`} action={<DataSourceBadge live={response.status === "live"} error={response.error} />} /><LineChart values={data.dailySessions.length ? data.dailySessions : traffic} color="#002DF0" /></Card><Card><CardHeader title="Landing pages principales" detail="GA4 · sesiones y conversiones" /><DataTable headers={["Página", "Usuarios", "Sesiones", "Conversiones"]} rows={data.landingPages.slice(0, 5).map((item) => [item.page, formatNumber(item.users), formatNumber(item.sessions), formatNumber(item.conversions)])} /></Card></div>{errorText(response.error)}</>;
}

export function SummaryLive() {
  const search = useIntegration("/api/integrations/search-console", initialSearch);
  const analytics = useIntegration("/api/integrations/analytics", initialAnalytics);
  const live = search.status === "live" || analytics.status === "live";
  return <div className="integration-summary"><DataSourceBadge live={live} error={search.error || analytics.error} /><span>{live ? "Conexiones reales activas" : "Configura las variables para consultar GSC y GA4"}</span>{errorText(search.error || analytics.error)}</div>;
}

function Metric({ label, value, change: valueChange }: { label: string; value: string; change: string }) { return <Card className="metric-card"><span>{label}</span><strong>{value}</strong><Change value={valueChange} /></Card>; }
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cellIndex === 0 ? <b>{cell}</b> : cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>Sin datos para este periodo.</td></tr>}</tbody></table></div>; }
