"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardHeader, EmptyState, LoadingState, StatusPill } from "@/components/ui";
import { DataTable, type TableColumn } from "@/components/data-table";
import type { IndexationData, IndexationRow } from "@/lib/indexation";

const text = (value: string | null | undefined) => value || "No data";
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString("es-ES") : "No data";
const statusTone = (status: IndexationRow["status"]) => status === "indexed" ? "success" : status === "error" ? "error" : status === "not_indexed" ? "warning" : "neutral";
const statusLabel = (status: IndexationRow["status"]) => status === "indexed" ? "Indexada" : status === "not_indexed" ? "No indexada" : status === "error" ? "Error" : "No data";

export function IndexationPanel() {
  const [data, setData] = useState<IndexationData | null>(null); const [loading, setLoading] = useState(true); const [inspecting, setInspecting] = useState(false); const [error, setError] = useState("");
  const load = async (inspect = false) => { if (loading || inspecting) return; setError(""); if (inspect) setInspecting(true); else setLoading(true); try { const response = await fetch(`/api/indexation?refresh=1${inspect ? "&action=inspect-priority" : ""}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "No se pudo cargar Indexación."); setData(payload); } catch (reason) { setError(reason instanceof Error ? reason.message : "Error de conexión"); } finally { setLoading(false); setInspecting(false); } };
  // La carga inicial se ejecuta una sola vez para respetar el snapshot existente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  if (loading && !data) return <LoadingState />;
  if (!data) return <Card><EmptyState title="Error de conexión" detail={error || "Indexación no pudo responder."} /><button className="primary-button" onClick={() => void load()}><RefreshCw size={14} /> Reintentar</button></Card>;
  const rows = data.inspection.rows;
  const columns: TableColumn<IndexationRow>[] = [
    { key: "url", label: "URL", sortValue: (row) => row.url, filter: "text" },
    { key: "status", label: "Estado", sortValue: (row) => row.status, filter: "select", options: ["indexed", "not_indexed", "error", "not_inspected"], render: (row) => <StatusPill tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusPill> },
    { key: "lastCrawl", label: "Último rastreo", sortValue: (row) => row.lastCrawl || "", render: (row) => date(row.lastCrawl) },
    { key: "userCanonical", label: "Canonical declarado", sortValue: (row) => row.userCanonical || "", render: (row) => text(row.userCanonical) },
    { key: "googleCanonical", label: "Canonical Google", sortValue: (row) => row.googleCanonical || "", render: (row) => text(row.googleCanonical) },
    { key: "robotsTxtState", label: "Robots", sortValue: (row) => row.robotsTxtState || "", render: (row) => text(row.robotsTxtState) },
    { key: "coverageState", label: "Cobertura", sortValue: (row) => row.coverageState || "", render: (row) => text(row.coverageState) },
    { key: "sitemap", label: "Sitemap", sortValue: (row) => row.sitemap || "", render: (row) => text(row.sitemap) },
    { key: "lastInspection", label: "Comprobada", sortValue: (row) => row.lastInspection || "", render: (row) => date(row.lastInspection) },
  ];
  const indexed = data.inspection.indexed; const inspected = data.inspection.inspected; const errors = data.inspection.errors; const pending = data.sitemap.urls.length - (inspected || 0);
  return <div className="indexation-panel">
     <div className="audit-toolbar"><div><strong>{data.siteUrl}</strong><small>Propiedad GSC: {data.gscSiteUrl} · Última actualización: {date(data.generatedAt)} · Estado: {data.inspection.status}</small></div><div className="audit-actions"><button className="outline-button small" onClick={() => void load()} disabled={loading || inspecting}><RefreshCw className={loading ? "spin" : ""} size={14} /> Actualizar sitemap</button><button className="primary-button" onClick={() => void load(true)} disabled={loading || inspecting}><RefreshCw className={inspecting ? "spin" : ""} size={14} /> Inspeccionar prioritarias</button></div></div>
    {error && <EmptyState title="Error" detail={error} />}
    <div className="audit-kpis"><Kpi label="URLs en sitemap" value={data.sitemap.urls.length.toLocaleString("es-ES")} /><Kpi label="Inspeccionadas" value={String(inspected)} /><Kpi label="Indexadas · GSC" value={indexed === null ? "No data" : String(indexed)} /><Kpi label="No indexadas · GSC" value={data.inspection.notIndexed === null ? "No data" : String(data.inspection.notIndexed)} /><Kpi label="Pendientes" value={String(Math.max(0, pending))} /><Kpi label="Errores" value={errors === null ? "No data" : String(errors)} /></div>
    <div className="source-status"><Source label="Sitemap" status={data.sitemap.status} detail={`${data.sitemap.sitemaps.length} sitemap(s) · ${data.sitemap.fetchedAt ? date(data.sitemap.fetchedAt) : "No data"}`} /><Source label="Inspección GSC" status={data.inspection.status} detail={data.inspection.message || "URL por URL"} /><Source label="Crawler" status={data.crawler.status} detail={`${data.crawler.rows.length}/${data.crawler.limit} URLs · fuente crawler`} /></div>
    <Card><CardHeader title="Sitemaps registrados en Search Console" detail="Sitemaps API real; no se usa indexed URLs como contador." />{data.sitemaps.rows.length ? <Table rows={data.sitemaps.rows.map((row) => [row.path, row.isPending === null ? "No data" : String(row.isPending), row.isSitemapsIndex === null ? "No data" : String(row.isSitemapsIndex), date(row.lastSubmitted), date(row.lastDownloaded), row.warnings.join(" · ") || "No data", row.errors.join(" · ") || "No data"])} headers={["Path", "Pending", "Índice", "Último envío", "Última descarga", "Warnings", "Errors"]} /> : <EmptyState title="Unavailable" detail={data.sitemaps.message || "Sitemaps API no disponible."} />}</Card>
    <Card><CardHeader title="URLs reales del sitemap e inspección" detail={`${data.strategy.priority} ${data.strategy.persistence} ${data.inspection.checkedAt ? `Última comprobación: ${date(data.inspection.checkedAt)}.` : ""}`} />{rows.length ? <DataTable rows={rows} columns={columns} rowKey={(row) => row.url} label="URLs de indexación" pageSize={8} /> : <EmptyState title="No data" detail="No se encontraron URLs en el sitemap." />}</Card>
    <p className="metric-explanation"><strong>Fuentes separadas:</strong> <span><StatusPill tone="success">Inspección GSC</StatusPill> Google URL Inspection · <StatusPill tone="neutral">Sitemap</StatusPill> XML/Sitemaps API · <StatusPill tone="neutral">Crawler</StatusPill> HTTP propio · <StatusPill tone="neutral">No data</StatusPill> aún no consultado. URL Inspection es URL por URL; sin persistencia, la estrategia prioriza una muestra diaria/semanal configurable.</span></p>
  </div>;
}
function Kpi({ label, value }: { label: string; value: string }) { return <Card className="audit-kpi"><span>{label}</span><strong>{value}</strong></Card>; }
function Source({ label, status, detail }: { label: string; status: string; detail: string }) { return <div className="source-card"><div><b>{label}</b><small>{detail}</small></div><StatusPill tone={status === "live" ? "success" : status === "error" ? "error" : "neutral"}>{status === "live" ? "Live" : status === "no_data" ? "No data" : "Unavailable"}</StatusPill></div>; }
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>; }
