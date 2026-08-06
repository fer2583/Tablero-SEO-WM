"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/charts";
import { Card, CardHeader, Change, DataSourceBadge, LoadingState } from "@/components/ui";
import { useDashboardFilters } from "./filter-context";
import type { AnalyticsData, IntegrationResponse, SearchConsoleData } from "@/lib/integrations";
import { traffic } from "@/lib/mock-data";

const formatNumber = (value: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
const formatPercent = (value: number) => `${(value * 100).toFixed(2).replace(".", ",")}%`;
const change = (value: number, previous: number, suffix = "%") => `${value >= previous ? "+" : ""}${previous ? (((value - previous) / previous) * 100).toFixed(1).replace(".", ",") : "0"}${suffix}`;
const initialSearch: SearchConsoleData = { period: { start: "", end: "", previousStart: "", previousEnd: "" }, metrics: { clicks: 24860, impressions: 1240000, ctr: 0.0201, position: 11.8 }, previous: { clicks: 20999, impressions: 1100000, ctr: 0.0177, position: 13.9 }, queries: [], pages: [] };
const initialAnalytics: AnalyticsData = { period: { start: "", end: "", previousStart: "", previousEnd: "" }, metrics: { users: 26180, sessions: 31420, engagementRate: 0.648, conversions: 846 }, previous: { users: 23290, sessions: 27180, engagementRate: 0.607, conversions: 774 }, landingPages: [], dailySessions: traffic };

function useIntegration<T>(endpoint: string, initial: T) {
  const { filters, refreshKey } = useDashboardFilters();
  const [response, setResponse] = useState<IntegrationResponse<T> | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");
  const params = new URLSearchParams({ days: String(filters.days), language: filters.language, country: filters.country, device: filters.device });
  if (filters.page) params.set("page", filters.page); if (filters.query) params.set("query", filters.query);
  const url = `${endpoint}?${params.toString()}`;
  useEffect(() => { const controller = new AbortController(); fetch(url, { cache: "no-store", signal: controller.signal }).then(async (result) => { if (!result.ok) throw new Error(`Respuesta HTTP ${result.status}`); return result.json(); }).then((value) => { setResponse(value); setLoadedUrl(url); }).catch((error) => { if (error.name !== "AbortError") { setResponse({ status: "fallback", data: initial, error: error.message, generatedAt: new Date().toISOString() }); setLoadedUrl(url); } }); return () => controller.abort(); }, [url, refreshKey, initial]);
  return { response: response ?? { status: "fallback" as const, data: initial, generatedAt: new Date().toISOString() }, loading: loadedUrl !== url };
}

function Verification({ response, source }: { response: IntegrationResponse<SearchConsoleData | AnalyticsData>; source: string }) { const metadata = response.metadata; return <div className="verification"><strong>Cómo verificar datos</strong><span>{source} · {response.status === "live" ? "Live" : "Demo fallback"} · {metadata?.rows ?? 0} filas</span><span>{response.data.period.start || "sin fecha"} — {response.data.period.end || "sin fecha"} · última respuesta {new Date(response.generatedAt).toLocaleString("es-ES")}</span></div>; }
function State({ error }: { error?: string }) { return error ? <small className="integration-error">{error}</small> : null; }

export function SearchConsoleLive() {
  const { response, loading } = useIntegration("/api/integrations/search-console", initialSearch); const { data } = response;
  if (loading) return <LoadingState />;
  return <><div className="mini-kpis"><Metric label="Clics" value={formatNumber(data.metrics.clicks)} change={change(data.metrics.clicks, data.previous.clicks)} /><Metric label="Impresiones" value={formatNumber(data.metrics.impressions)} change={change(data.metrics.impressions, data.previous.impressions)} /><Metric label="CTR medio" value={formatPercent(data.metrics.ctr)} change={change(data.metrics.ctr, data.previous.ctr, " pp")} /><Metric label="Posición media" value={data.metrics.position.toFixed(1).replace(".", ",")} change={`${(data.metrics.position - data.previous.position).toFixed(1).replace(".", ",")} posiciones`} /></div><Card><CardHeader title="Consultas principales" detail={`${data.period.start} — ${data.period.end} · comparación anterior`} action={<DataSourceBadge live={response.status === "live"} error={response.error} />} /><DataTable headers={["Consulta", "Clics", "Impresiones", "CTR", "Posición"]} rows={data.queries.map((item) => [item.query, formatNumber(item.clicks), formatNumber(item.impressions), formatPercent(item.ctr), item.position.toFixed(1).replace(".", ",")])} /><State error={response.error} /></Card><Verification response={response} source="Search Console" /></>;
}

export function AnalyticsLive() {
  const { response, loading } = useIntegration("/api/integrations/analytics", initialAnalytics); const { data } = response;
  if (loading) return <LoadingState />;
  return <><div className="mini-kpis"><Metric label="Usuarios" value={formatNumber(data.metrics.users)} change={change(data.metrics.users, data.previous.users)} /><Metric label="Sesiones orgánicas" value={formatNumber(data.metrics.sessions)} change={change(data.metrics.sessions, data.previous.sessions)} /><Metric label="Engagement" value={formatPercent(data.metrics.engagementRate)} change={change(data.metrics.engagementRate, data.previous.engagementRate, " pp")} /><Metric label="Conversiones / key events" value={formatNumber(data.metrics.conversions)} change={change(data.metrics.conversions, data.previous.conversions)} /></div><div className="dashboard-grid"><Card className="wide-card"><CardHeader title="Sesiones" detail={`${data.period.start} — ${data.period.end}`} action={<DataSourceBadge live={response.status === "live"} error={response.error} />} /><LineChart values={data.dailySessions.length ? data.dailySessions : traffic} color="#002DF0" /></Card><Card><CardHeader title="Landing pages principales" detail="GA4 · sesiones y conversiones" /><DataTable headers={["Página", "Usuarios", "Sesiones", "Conversiones"]} rows={data.landingPages.slice(0, 5).map((item) => [item.page, formatNumber(item.users), formatNumber(item.sessions), formatNumber(item.conversions)])} /></Card></div><State error={response.error} /><Verification response={response} source="GA4" /></>;
}

export function SummaryLive() { const search = useIntegration("/api/integrations/search-console", initialSearch); const analytics = useIntegration("/api/integrations/analytics", initialAnalytics); if (search.loading || analytics.loading) return <LoadingState />; const live = search.response.status === "live" || analytics.response.status === "live"; return <><div className="integration-summary"><DataSourceBadge live={live} error={search.response.error || analytics.response.error} /><span>{live ? "Conexiones reales activas" : "Demo fallback: configura las variables para consultar GSC y GA4"}</span></div><div className="mini-kpis"><Metric label="Clics orgánicos" value={formatNumber(search.response.data.metrics.clicks)} change={change(search.response.data.metrics.clicks, search.response.data.previous.clicks)} /><Metric label="Impresiones" value={formatNumber(search.response.data.metrics.impressions)} change={change(search.response.data.metrics.impressions, search.response.data.previous.impressions)} /><Metric label="Sesiones orgánicas" value={formatNumber(analytics.response.data.metrics.sessions)} change={change(analytics.response.data.metrics.sessions, analytics.response.data.previous.sessions)} /><Metric label="Conversiones" value={formatNumber(analytics.response.data.metrics.conversions)} change={change(analytics.response.data.metrics.conversions, analytics.response.data.previous.conversions)} /></div><Verification response={search.response} source="GSC" /><Verification response={analytics.response} source="GA4" /></>; }

function Metric({ label, value, change: valueChange }: { label: string; value: string; change: string }) { return <Card className="metric-card"><span>{label}</span><strong>{value}</strong><Change value={valueChange} /></Card>; }
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cellIndex === 0 ? <b>{cell}</b> : cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>Sin datos para este periodo.</td></tr>}</tbody></table></div>; }
