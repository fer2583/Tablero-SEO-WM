"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, Change, DataSourceBadge, EmptyState, LoadingState } from "@/components/ui";
import { useDashboardFilters } from "@/components/filter-context";
import type { AnalyticsData, SearchConsoleData } from "@/lib/integrations";

type Summary = { period: SearchConsoleData["period"]; metrics: { searchConsole: SearchConsoleData["metrics"] | null; analytics: AnalyticsData["metrics"] | null }; previous: { searchConsole: SearchConsoleData["previous"] | null; analytics: AnalyticsData["previous"] | null }; keywords: { winning: SearchConsoleData["queries"]; losing: SearchConsoleData["queries"] }; indexation: { problemUrls?: string[] } | null; technical: { status?: string } | null; sources?: { searchConsole?: string; analytics?: string } };
const empty: Summary = { period: { start: "", end: "", previousStart: "", previousEnd: "" }, metrics: { searchConsole: null, analytics: null }, previous: { searchConsole: null, analytics: null }, keywords: { winning: [], losing: [] }, indexation: null, technical: null };
const format = (value: number | null | undefined) => value == null ? "No data" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null | undefined) => value == null ? "No data" : `${(value * 100).toFixed(2).replace(".", ",")}%`;

export function SummaryPanel() {
  const { refreshKey, refresh } = useDashboardFilters();
  const [summary, setSummary] = useState<{ status: string; data: Summary; error?: string; metadata?: { snapshotAt?: Record<string, string | null>; states?: Record<string, string> } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { const controller = new AbortController(); fetch("/api/summary?days=30", { cache: "no-store", signal: controller.signal }).then((response) => response.json()).then((value) => setSummary(value)).catch((error) => { if (error.name !== "AbortError") setSummary({ status: "unavailable", data: empty, error: "No se pudo consultar el Resumen." }); }).finally(() => setLoading(false)); return () => controller.abort(); }, [refreshKey]);
  const update = async () => { if (refreshing) return; setRefreshing(true); try { await fetch("/api/ingest?sources=gsc,ga4&refresh=1", { method: "POST" }); refresh(); } finally { setRefreshing(false); } };
  if (loading && !summary) return <LoadingState />;
  const payload = summary ?? { status: "unavailable", data: empty };
  const data = payload.data ?? empty;
  const gsc = data.metrics.searchConsole; const ga = data.metrics.analytics;
  const change = (current: number | null | undefined, previous: number | null | undefined) => current != null && previous != null && previous !== 0 ? `${current >= previous ? "+" : ""}${(((current - previous) / Math.abs(previous)) * 100).toFixed(1).replace(".", ",")}%` : "Comparación no disponible";
  const updated = payload.metadata?.snapshotAt ? Object.values(payload.metadata.snapshotAt).filter(Boolean).sort().at(-1) : null;
  return <><div className="integration-summary"><DataSourceBadge live={payload.status === "live"} error={payload.error} /><span>Últimos 30 días vs. 30 días anteriores.</span><button className="outline-button small" onClick={update} disabled={refreshing}>{refreshing ? "Actualizando..." : "Actualizar datos"}</button>{updated && <span>Última actualización: {new Date(updated).toLocaleString("es-ES")}</span>}</div><div className="mini-kpis"><Metric label="Clicks orgánicos · GSC" value={format(gsc?.clicks)} change={change(gsc?.clicks, data.previous.searchConsole?.clicks)} /><Metric label="Impresiones · GSC" value={format(gsc?.impressions)} change={change(gsc?.impressions, data.previous.searchConsole?.impressions)} /><Metric label="CTR · GSC" value={percent(gsc?.ctr)} change={change(gsc?.ctr, data.previous.searchConsole?.ctr)} /><Metric label="Posición media · GSC" value={format(gsc?.position)} /><Metric label="Usuarios orgánicos · GA4" value={format(ga?.users)} change={change(ga?.users, data.previous.analytics?.users)} /><Metric label="Sesiones orgánicas · GA4" value={format(ga?.organicSessions)} change={change(ga?.organicSessions, data.previous.analytics?.organicSessions)} /><Metric label="Conversiones · GA4" value={format(ga?.conversions)} change={change(ga?.conversions, data.previous.analytics?.conversions)} /></div>{payload.status !== "live" && <EmptyState title="Datos parcialmente disponibles" detail={payload.error ?? `GSC: ${data.sources?.searchConsole ?? "sin snapshot"}. GA4: ${data.sources?.analytics ?? "sin snapshot"}.`} />}<Card><CardHeader title="Keywords ganadoras y perdedoras" detail="Derivadas del snapshot de Search Console." /><div className="analytics-secondary-grid"><Rows title="Ganadoras" rows={data.keywords.winning} /><Rows title="Perdedoras" rows={data.keywords.losing} /></div></Card><Card><CardHeader title="Indexación y estado técnico" /><p>{data.indexation ? `${data.indexation.problemUrls?.length ?? 0} URLs con problemas de indexación.` : "No data available"}</p><p>{data.technical ? `Auditoría: ${data.technical.status ?? "available"}.` : "Estado técnico: Unavailable"}</p></Card></>;
}

function Metric({ label, value, change = "Fuente conectada" }: { label: string; value: string; change?: string }) { return <Card className="metric-card"><span>{label}</span><strong>{value}</strong><Change value={change} trend="steady" /></Card>; }
function Rows({ title, rows }: { title: string; rows: Array<{ query: string; clicks: number }> }) { return <div><strong>{title}</strong>{rows.length ? <ul>{rows.map((row) => <li key={row.query}><span>{row.query}</span><b>{row.clicks.toLocaleString("es-ES")}</b></li>)}</ul> : <EmptyState title="No data available" />}</div>; }
