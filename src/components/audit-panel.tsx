"use client";

import Image from "next/image";
import { AlertTriangle, ChevronDown, Clock3, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuditData, AuditDevice, AuditHistory, AuditIssue, PageAudit, PsiResult } from "@/lib/audit";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { DataTable, type TableColumn } from "@/components/data-table";

const tabs = ["Resumen", "Issues", "Páginas", "Rendimiento", "Historial", "Configuración"] as const;
const number = (value: number | null | undefined) => value == null ? "No data" : value.toLocaleString("es-ES");
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString("es-ES") : "No data";

export function AuditPanel() {
  const [data, setData] = useState<AuditData | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Resumen");
  const [device, setDevice] = useState<AuditDevice>("mobile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async (refresh = false) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/audit${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "La auditoría no pudo responder.");
      setData(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Error de conexión"); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  if (loading && !data) return <div className="analytics-workspace audit-workspace"><div className="audit-skeleton" aria-label="Cargando auditoría"><i /><i /><i /><i /></div></div>;
  if (!data) return <div className="analytics-workspace audit-workspace"><EmptyState title="No data available" detail={error || "No existe un snapshot de auditoría."} /><button className="primary-button" onClick={() => void load()}><RefreshCw size={14} /> Reintentar</button></div>;

  const hostname = new URL(data.siteUrl).hostname;
  const pages = data.crawler.audited;
  const issues = data.crawler.issues;
  const psi = data.devices[device].psi;
  const incomplete = data.sitemap.urls.length > pages.length || data.sources.crawler === "partial";
  return <div className="analytics-workspace audit-workspace">
    <header className="analytics-header audit-header">
      <div className="audit-title"><Image src="/whalemate-logo-header.webp" alt="" width={100} height={54} className="audit-thumbnail" /><div><button className="analytics-breadcrumb" onClick={() => window.history.back()}>← <span>Dashboards</span></button><h1>Auditoría Web</h1><p className="analytics-period">{hostname} · Última auditoría: {date(data.generatedAt)}</p><small>{number(pages.length)} páginas auditadas · {number(issues.length)} issues · Estado: {data.sources.crawler === "live" ? "Live" : "Partial"}</small></div></div>
      <div className="analytics-actions"><button className="audit-run-button" onClick={() => void load(true)} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={16} /> {loading ? "Auditando..." : "Auditar ahora"}</button><button aria-label="Cambiar dispositivo" onClick={() => setDevice(device === "mobile" ? "desktop" : "mobile")}><span>{device}</span><ChevronDown size={15} /></button></div>
    </header>
    {error && <div className="state-box audit-error"><AlertTriangle size={17} /><strong>Error de conexión</strong><span>{error}</span></div>}
    <nav className="analytics-tabs audit-tabs" aria-label="Secciones de auditoría">{tabs.map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}{item === "Issues" ? ` (${issues.length})` : item === "Páginas" ? ` (${pages.length})` : ""}</button>)}</nav>
    {tab === "Resumen" && <Summary data={data} incomplete={incomplete} />}
    {tab === "Issues" && <Issues issues={issues} />}
    {tab === "Páginas" && <Pages pages={pages} />}
    {tab === "Rendimiento" && <Performance data={data} device={device} psi={psi} />}
    {tab === "Historial" && <History history={data.history} />}
    {tab === "Configuración" && <Configuration data={data} />}
  </div>;
}

function Summary({ data, incomplete }: { data: AuditData; incomplete: boolean }) {
  const pages = data.crawler.audited; const issues = data.crawler.issues;
  const score = pages.length ? Math.max(0, Math.round(100 - issues.reduce((total, issue) => total + (issue.severity === "Alta" ? 8 : issue.severity === "Media" ? 3 : 1), 0) / pages.length * 10)) : null;
  const severity = ["Alta", "Media", "Baja"].map((level) => ({ label: level, count: issues.filter((issue) => issue.severity === level).length }));
  const livePages = pages.filter((page) => page.status === "live");
  const http = livePages.reduce<Record<string, number>>((result, page) => { const key = page.httpStatus == null ? "No data" : String(page.httpStatus); result[key] = (result[key] || 0) + 1; return result; }, {});
  return <>
    {incomplete && <div className="audit-warning"><AlertTriangle size={17} /><div><strong>Hay páginas no analizadas</strong><span>{data.crawler.message || `${Math.max(0, data.sitemap.urls.length - pages.length)} URLs del sitemap no tienen respuesta del crawler.`}</span></div></div>}
    <div className="audit-summary-grid"><AuditKpi label="Score técnico" value={score == null ? "No data" : `${score}/100`} detail={score == null ? "Se necesitan páginas auditadas e issues reales." : "Calculado desde issues del crawler."} tone={score == null ? "neutral" : score >= 80 ? "success" : score >= 50 ? "warning" : "error"} /><AuditKpi label="Issues detectados" value={number(issues.length)} detail={severity.map((item) => `${item.label}: ${item.count}`).join(" · ")} tone={issues.some((issue) => issue.severity === "Alta") ? "error" : issues.length ? "warning" : "success"} /><AuditKpi label="Páginas analizadas" value={`${number(pages.length)} / ${number(data.sitemap.urls.length || null)}`} detail="Sitemap y crawler propio" tone={incomplete ? "warning" : "success"} /><AuditKpi label="Indexabilidad" value="No data" detail={data.sources.gsc === "unavailable" ? "Search Console no disponible" : "Sin estado de indexación en este snapshot"} tone="neutral" /></div>
    <div className="audit-section-title">Datos del rastreo</div><div className="audit-card-grid"><HttpCard values={http} /><NoDataCard title="Tiempo de respuesta" detail="El crawler no persiste duración de requests." /><LinksCard pages={pages} /></div>
    <div className="audit-card-grid"><SchemaCard data={data} /><NoDataCard title="Profundidad de click" detail="No se calcula profundidad del árbol de navegación." /><ContentCard pages={pages} /></div>
    <div className="audit-section-title">Puntuación por categoría</div><CategoryCards issues={issues} pages={pages} />
    <div className="audit-section-title">Core Web Vitals · {data.devices.mobile.crux.status === "live" ? "Mobile y Desktop" : "PageSpeed / CrUX"}</div><Vitals data={data} />
    <Card className="audit-no-data-card"><CardHeader title="GEO Readiness" detail="No se muestra sin una fuente real de datos GEO." /><EmptyState title="No data available" detail="No hay una integración GEO configurada." /></Card>
    <Issues issues={issues.slice(0, 10)} compact />
  </>;
}

function AuditKpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={`audit-kpi-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function HttpCard({ values }: { values: Record<string, number> }) { const entries = Object.entries(values); return <Card><CardHeader title="Códigos HTTP" detail="Respuestas registradas por el crawler." />{entries.length ? <div className="audit-bars">{entries.map(([key, value]) => <div key={key}><span>{key}</span><b>{value}</b><i><em style={{ width: `${Math.min(100, value / Math.max(...Object.values(values)) * 100)}%` }} /></i></div>)}</div> : <EmptyState title="No data available" detail="No hay respuestas HTTP persistidas." />}</Card>; }
function LinksCard({ pages }: { pages: PageAudit[] }) { const links = pages.map((page) => page.internalLinks).filter((value): value is number => value != null); const redirects = pages.reduce((total, page) => total + page.redirects.length, 0); return <Card><CardHeader title="Perfil de enlaces" detail="Enlaces internos y redirects del crawler." />{links.length ? <div className="audit-stat-list"><span>Enlaces internos<strong>{number(links.reduce((a, b) => a + b, 0))}</strong></span><span>Promedio por página<strong>{(links.reduce((a, b) => a + b, 0) / links.length).toFixed(1).replace(".", ",")}</strong></span><span>Redirects<strong>{number(redirects)}</strong></span></div> : <EmptyState title="No data available" detail="El crawler no devolvió perfil de enlaces." />}</Card>; }
function SchemaCard({ data }: { data: AuditData }) { return <Card><CardHeader title="Datos estructurados" detail="JSON-LD parseable, no validación Rich Results." />{data.schema.coverage == null ? <EmptyState title="No data available" detail={data.schema.message || "No hay páginas auditadas."} /> : <><strong className="audit-big-number">{data.schema.coverage}%</strong><span className="audit-muted">{data.schema.withJsonLd} de {data.schema.audited} páginas con JSON-LD</span><Progress value={data.schema.coverage} /></>}</Card>; }
function ContentCard({ pages }: { pages: PageAudit[] }) { const titles = pages.filter((page) => page.title).length; return <Card><CardHeader title="Calidad de contenido" detail="La auditoría actual no extrae palabras ni contenido escaso." /><div className="audit-stat-list"><span>Titles disponibles<strong>{pages.length ? `${titles}/${pages.length}` : "No data"}</strong></span><span>Total de palabras<strong>No data</strong></span><span>Contenido escaso<strong>No data</strong></span></div></Card>; }
function NoDataCard({ title, detail }: { title: string; detail: string }) { return <Card><CardHeader title={title} /><EmptyState title="No data available" detail={detail} /></Card>; }
function CategoryCards({ issues, pages }: { issues: AuditIssue[]; pages: PageAudit[] }) { const categories = [...new Set([...issues.map((issue) => issue.category), "Rastreo", "Etiquetas Meta", "Enlaces", "Velocidad", "Contenido"])]; return <div className="category-grid">{categories.map((category) => { const count = issues.filter((issue) => issue.category === category).length; const value = pages.length ? Math.max(0, Math.round(100 - count / pages.length * 100)) : null; return <div className="category-card" key={category}><span>{category}</span><strong>{value == null ? "No data" : value}</strong>{value != null && <Progress value={value} />}<small>{count ? `${count} issue${count === 1 ? "" : "s"}` : "Sin issues"}</small></div>; })}</div>; }
function Progress({ value }: { value: number }) { return <i className="audit-progress"><em style={{ width: `${value}%` }} /></i>; }
function Vitals({ data }: { data: AuditData }) { return <div className="vitals-grid">{(["mobile", "desktop"] as AuditDevice[]).map((device) => <Card key={device}><CardHeader title={`${device === "mobile" ? "Mobile" : "Desktop"} · PageSpeed + CrUX`} /><div className="vitals-columns"><MetricSet label="PageSpeed" result={data.devices[device].psi} /><MetricSet label="CrUX" result={data.devices[device].crux} /></div></Card>)}</div>; }
function MetricSet({ label, result }: { label: string; result: { status: string; metrics: Record<string, number | null>; message?: string } }) { return <div><span className="audit-muted">{label} · {result.status}</span>{result.status === "live" ? Object.entries(result.metrics).map(([key, value]) => <div className="vital-row" key={key}><span>{key.toUpperCase()}</span><b>{value == null ? "No data" : key === "cls" ? value.toFixed(3) : `${Math.round(value)} ms`}</b></div>) : <small className="audit-muted">{result.message || "No data available"}</small>}</div>; }

function Issues({ issues, compact = false }: { issues: AuditIssue[]; compact?: boolean }) { const [selected, setSelected] = useState<string | null>(null); return <Card className="issues-card"><CardHeader title={compact ? "Top issues" : "Issues detectados"} detail={issues.length ? "Evidencia, recomendación y alcance procedentes del crawler." : "La lista se completa solo con respuestas reales."} />{issues.length ? <div className="issue-list">{issues.map((issue) => <div className="issue-row" key={issue.id}><button onClick={() => setSelected(selected === issue.id ? null : issue.id)}><StatusPill tone={issue.severity === "Alta" ? "error" : issue.severity === "Media" ? "warning" : "neutral"}>{issue.severity}</StatusPill><span><strong>{issue.issue}</strong><small>{issue.evidence}</small></span><ChevronDown className={selected === issue.id ? "rotate" : ""} size={15} /></button>{selected === issue.id && <div className="issue-detail"><b>Recomendación</b><span>{issue.recommendation}</span><small>{issue.evidence}</small></div>}</div>)}</div> : <EmptyState title="No data available" detail="No se detectaron issues en las páginas auditadas." />}</Card>; }
function Pages({ pages }: { pages: PageAudit[] }) { const columns: TableColumn<PageAudit>[] = [{ key: "url", label: "URL", sortValue: (row) => row.url, filter: "text", render: (row) => <span className="analytics-cell-label" title={row.url}>{row.url}</span> }, { key: "httpStatus", label: "HTTP", sortValue: (row) => row.httpStatus ?? -1, render: (row) => row.httpStatus == null ? "No data" : String(row.httpStatus) }, { key: "title", label: "Title", sortValue: (row) => row.title || "", filter: "text", render: (row) => row.title || "No data" }, { key: "h1", label: "H1", sortValue: (row) => row.h1.join(" · "), render: (row) => row.h1.join(" · ") || "No data" }, { key: "schema", label: "JSON-LD", sortValue: (row) => row.jsonLd, render: (row) => row.jsonLd ? String(row.jsonLd) : "No data" }]; return <Card><CardHeader title="Páginas auditadas" detail="Solo URLs que respondió el crawler propio." /><DataTable columns={columns} rows={pages} label="páginas" rowKey={(row) => row.url} /></Card>; }
function Performance({ data, device, psi }: { data: AuditData; device: AuditDevice; psi: PsiResult }) { return <><div className="device-switch"><StatusPill tone="neutral">{device}</StatusPill><span>{data.siteUrl}</span></div><Card><CardHeader title={`PageSpeed · ${device}`} detail="Fuente: PageSpeed Insights / Lighthouse." />{psi.status === "live" ? <div className="score-grid">{Object.entries(psi.scores).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value == null ? "No data" : value}</strong><Progress value={value ?? 0} /></div>)}</div> : <EmptyState title="Unavailable" detail={psi.message || "PageSpeed no devolvió datos."} />}</Card><Card><CardHeader title="Oportunidades y diagnósticos" />{psi.opportunities.length ? <div className="opportunity-list">{psi.opportunities.map((item, index) => <div key={`${item.title}-${index}`}><b>{item.title}</b><span>{item.displayValue || "No data"}</span></div>)}</div> : <EmptyState title="No data available" detail="No se recibieron oportunidades de Lighthouse." />}</Card></>; }
function History({ history }: { history: AuditData["history"] }) { if (history === "no_data" || !history.length) return <Card><CardHeader title="Historial de auditorías" /><EmptyState title="No data available" detail="No hay ejecuciones persistidas en audit_runs." /></Card>; return <Card><CardHeader title="Historial de auditorías" detail="Ejecuciones leídas desde audit_runs." /><div className="history-list">{(history as AuditHistory[]).map((run) => <div key={run.id}><Clock3 size={16} /><span><b>{run.snapshotKey}</b><small>{date(run.completedAt)}</small></span><StatusPill tone={run.status === "success" ? "success" : "error"}>{run.status}</StatusPill></div>)}</div></Card>; }
function Configuration({ data }: { data: AuditData }) { return <><div className="source-status">{(["crawler", "psi", "crux", "gsc"] as const).map((source) => <div className="source-card" key={source}><span><b>{source === "psi" ? "PageSpeed Insights" : source === "crux" ? "CrUX" : source === "gsc" ? "Search Console" : "Crawler propio"}</b><small>Estado de la fuente en el snapshot</small></span><StatusPill tone={data.sources[source] === "live" ? "success" : data.sources[source] === "partial" ? "warning" : "neutral"}>{data.sources[source]}</StatusPill></div>)}</div><Card><CardHeader title="Configuración" action={<Settings2 size={17} />} /><div className="audit-stat-list"><span>Sitio<strong>{data.siteUrl}</strong></span><span>Sitemap<strong>{data.sitemap.status}</strong></span><span>Robots.txt<strong>{data.crawler.robots}</strong></span><span>Limitación<strong>{data.crawler.message || "No data"}</strong></span></div></Card></>; }
