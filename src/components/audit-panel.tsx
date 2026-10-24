"use client";

import { AlertTriangle, Pause, Play, RefreshCw, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditData, AuditDevice, AuditHistory, AuditIssue, PageAudit } from "@/lib/audit";
import type { RunView } from "@/lib/crawler/service";
import type { BrowserReport } from "@/lib/browser-audit/types";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { DataTable, type TableColumn } from "@/components/data-table";
import { PerformancePanel, PerformanceSummary } from "@/components/performance-panel";

const tabs = ["Resumen", "Issues", "Páginas", "Experiencia", "Rendimiento", "Historial", "Configuración"] as const;
const date = (value?: string | null) => value ? new Date(value).toLocaleString("es-ES") : "Sin datos";
const number = (value?: number | null) => value == null ? "Sin datos" : value.toLocaleString("es-ES");
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", cache: "no-store", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload as T;
}
function exportRows(name: string, rows: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

export function AuditPanel() {
  const [data, setData] = useState<AuditData | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [history, setHistory] = useState<AuditHistory[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Resumen");
  const [device, setDevice] = useState<AuditDevice>("mobile");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [driving, setDriving] = useState(false);
  const [error, setError] = useState("");
  const [maxUrls, setMaxUrls] = useState(2000);
  const [clock, setClock] = useState(() => Date.now());
  const pendingAction = useRef<"pause" | "cancel" | null>(null);
  const busy = useRef(false);
  const apply = useCallback((view: RunView) => {
    setRun(view); setData(view.snapshot);
    if (view.snapshot.history !== "no_data") setHistory(view.snapshot.history);
  }, []);
  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try {
      const payload = await request<{ snapshot: AuditData | null; activeRun: RunView | null; latestRunId: number | null; history: AuditHistory[]; config?: { maxUrls: number } }>("/api/audit");
      setHistory(payload.history);
      if (payload.config) setMaxUrls(payload.config.maxUrls);
      if (payload.activeRun) { apply(payload.activeRun); setDriving(["queued", "running"].includes(payload.activeRun.status)); }
      else {
        setData(payload.snapshot); setRun(null);
        if (payload.latestRunId) {
          // Older snapshots remain readable even when they have no v2 state.
          const response = await fetch(`/api/audit/runs/${payload.latestRunId}`, { cache: "no-store" });
          if (response.ok) apply(await response.json());
        }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Error de conexión"); }
    finally { setLoading(false); }
  }, [apply]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (!run?.retryAt) return; const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [run?.retryAt]);
  const performanceRunId = run?.id;
  const performanceRunning = run?.snapshot.performanceTask?.status === "running";
  useEffect(() => {
    if (!performanceRunId || !performanceRunning) return;
    let cancelled = false;
    let pending = false;
    const timer = setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        const view = await request<RunView>(`/api/audit/runs/${performanceRunId}`);
        if (!cancelled) { apply(view); setError(""); }
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo actualizar el rendimiento."); }
      finally { pending = false; }
    }, 2500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [performanceRunId, performanceRunning, apply]);

  useEffect(() => {
    if (!driving || !run || !["queued", "running"].includes(run.status)) return;
    const timer = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true; setWorking(true);
      try {
        const view = await request<RunView>(`/api/audit/runs/${run.id}/process`, {});
        if (pendingAction.current && ["queued", "running", "paused"].includes(view.status)) {
          const action = pendingAction.current; pendingAction.current = null;
          apply(await request<RunView>(`/api/audit/runs/${run.id}/actions`, { action })); setDriving(false);
        } else { apply(view); if (["completed", "paused", "cancelled"].includes(view.status)) setDriving(false); }
      } catch (reason) { setDriving(false); setError(reason instanceof Error ? reason.message : "Error de lote. Podés reanudar sin perder resultados."); }
      finally { busy.current = false; setWorking(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [run, driving, apply]);

  const start = async (urls?: string[]) => {
    setWorking(true); setError(""); pendingAction.current = null;
    try { const view = await request<RunView>("/api/audit/runs", { urls, maxUrls }); apply(view); setDriving(["queued", "running"].includes(view.status)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo iniciar."); }
    finally { setWorking(false); }
  };
  const action = async (value: "pause" | "resume" | "cancel") => {
    if (!run) return;
    if (busy.current && value !== "resume") { pendingAction.current = value; setDriving(false); return; }
    setWorking(true); setError("");
    try { const view = await request<RunView>(`/api/audit/runs/${run.id}/actions`, { action: value }); apply(view); setDriving(value === "resume"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar el estado."); }
    finally { setWorking(false); }
  };
  const openRun = async (id: number) => {
    setError("");
    try { apply(await request<RunView>(`/api/audit/runs/${id}`)); setDriving(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Snapshot histórico anterior a v2."); }
  };
  const active = !!run && ["queued", "running", "paused"].includes(run.status);
  return <div className="analytics-workspace audit-workspace">
    <header className="analytics-header audit-header">
      <div><h1>Auditoría Web</h1><p className="analytics-period">www.whalemate.com · {data ? date(data.generatedAt) : "Sin auditorías publicadas"}</p><small>{data?.scope === "selective" ? "Reauditoría selectiva" : "SEO técnico y experiencia renderizada"}</small></div>
      <div className="analytics-actions"><button className="audit-run-button" disabled={working || active || loading} onClick={() => void start()}><RefreshCw size={16} className={working ? "spin" : ""} /> Auditar sitio</button><button disabled={working} onClick={() => void load()}>Actualizar</button></div>
    </header>
    {error && <div className="state-box audit-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
    {run && <Card><CardHeader title={`Corrida #${run.id} · ${run.status}`} detail={`${run.progress.processed} procesadas · ${run.progress.pending} pendientes · ${run.progress.blocked} bloqueadas · ${run.progress.failed} fallidas · ${run.progress.excluded} excluidas`} />
      <progress className="crawl-progress" max={Math.max(1, run.progress.processed + run.progress.pending)} value={run.progress.processed} aria-label="Progreso del crawl" />
      <p aria-live="polite">{run.snapshot.crawler.message}{run.retryAt ? ` Reintentar después de ${date(run.retryAt)}.` : ""}</p>
      {run.progress.limitReached && <p className="audit-muted">Cobertura limitada por la configuración; consultar exclusiones.</p>}
      {active && <div className="crawl-actions"><button onClick={() => void action("pause")} disabled={run.status === "paused"}><Pause size={14} /> Pausar al terminar el lote</button><button onClick={() => void action("resume")} disabled={working || driving || (!!run.retryAt && Date.parse(run.retryAt) > clock)}><Play size={14} /> Reanudar</button><button onClick={() => void action("cancel")}><Square size={14} /> Cancelar</button></div>}
    </Card>}
    <nav className="analytics-tabs audit-tabs" aria-label="Secciones de auditoría">{tabs.map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {loading && !data ? <EmptyState title="Cargando auditorías…" detail="Consultando snapshots persistidos." /> : !data ? <EmptyState title="Todavía no hay una auditoría" detail="Iniciá una corrida para analizar el sitio completo. El progreso se conserva al cerrar esta página." /> : <>
      {tab === "Resumen" && <Summary data={data} />}
      {tab === "Issues" && <Issues issues={data.crawler.issues} disabled={working || active} recheck={(urls) => void start(urls)} />}
      {tab === "Páginas" && <Pages data={data} disabled={working || active} recheck={(urls) => void start(urls)} />}
      {tab === "Experiencia" && <Experience reports={(run?.browserReports || []) as BrowserReport[]} runId={run?.id} />}
      {tab === "Rendimiento" && <PerformancePanel key={run?.id} data={data} run={run} device={device} setDevice={setDevice} apply={apply} />}
      {tab === "Configuración" && <Card><CardHeader title="Configuración y cobertura" detail="La nueva configuración se aplica a la próxima corrida." /><label className="crawl-config">Máximo de URLs <input type="number" min={1} max={10000} value={maxUrls} onChange={(event) => setMaxUrls(Number(event.target.value))} /></label><p>Reglas: {data.rulesVersion || "Snapshot anterior a v2"} · Robots: {data.crawler.robots} · Sitemap: {data.sitemap.status}</p><p>{run ? `Lote ${run.config.batchSize}; concurrencia ${run.config.concurrency}; parámetros ${run.config.maxQueryUrls}; profundidad ${run.config.maxDepth}.` : "Configuración de servidor pendiente de una corrida nueva."}</p><p>PSI: {data.sources.psi} · CrUX: {data.sources.crux} · GSC: {data.sources.gsc}</p><details><summary>Exclusiones ({data.crawler.excluded?.length || 0})</summary>{data.crawler.excluded?.map((item) => <p key={item.url}>{item.reason}: {item.url}</p>)}</details></Card>}
    </>}
    {tab === "Historial" && <Card><CardHeader title="Historial" detail="Las reauditorías selectivas no reemplazan la salud general del sitio." /><div className="history-list">{history.map((item) => <div key={item.id}><button disabled={active || working} onClick={() => void openRun(item.id)}>Ver #{item.id}</button><span>{date(item.completedAt)} · {item.status}</span></div>)}</div></Card>}
  </div>;
}

function Summary({ data }: { data: AuditData }) {
  const pages = data.crawler.audited;
  const report = data.report;
  const html = pages.filter((page) => page.outcome === "html");
  const indexable = html.filter((page) => page.indexable).length;
  return <>
    <div className="audit-summary-grid"><Kpi label="Salud técnica interna" value={report?.score == null ? "Sin datos" : `${report.score}/100`} detail={data.sources.crawler === "live" ? "Reglas ponderadas; no predice posiciones" : "Provisional: revisar cobertura"} /><Kpi label="Cobertura HTML" value={report ? `${report.coverage}%` : "Sin datos"} detail={`${html.length} HTML · ${pages.length} procesadas`} /><Kpi label="Problemas" value={number(report?.groups.length)} detail={`${data.crawler.issues.length} incidencias · ${new Set(data.crawler.issues.map((item) => item.url)).size} páginas`} /><Kpi label="Indexabilidad HTML" value={html.length ? `${indexable}/${html.length}` : "Sin datos"} detail="No equivale a indexación en Google" /></div>
    <div className="category-grid">{report?.categories.map((item) => <div className="category-card" key={item.category}><span>{item.category}</span><strong>{number(item.score)}</strong><small>{item.evaluated} evaluaciones</small></div>)}</div>
    <div className="audit-card-grid"><Card><CardHeader title="Contenido principal" /><p>{number(html.reduce((sum, page) => sum + page.wordCount, 0))} palabras extraídas</p><p>{data.schema.withJsonLd}/{data.schema.audited} páginas con bloques JSON-LD</p><small>JSON válido no garantiza resultados enriquecidos.</small></Card><Card><CardHeader title="Respuesta observada" /><p>{html.length ? `${Math.round(html.reduce((sum, page) => sum + page.durationMs, 0) / html.length)} ms promedio` : "Sin datos"}</p><small>Tiempo de descarga; no es un Core Web Vital.</small></Card><Card><CardHeader title="Profundidad desde la home" /><p>{html.filter((page) => page.depth != null).length} páginas alcanzadas</p><p>{html.filter((page) => page.depth == null).length} sin camino detectado</p><small>Las posibles huérfanas requieren cobertura completa y revisión.</small></Card></div>
    {report && <Card><CardHeader title="Comparación con la auditoría anterior" detail="Solo se marcan resueltos los criterios reevaluados." /><div className="audit-stat-list"><span>Nuevas<strong>{report.comparison.new.length}</strong></span><span>Persistentes<strong>{report.comparison.persistent.length}</strong></span><span>Resueltas<strong>{report.comparison.resolved.length}</strong></span><span>Sin reevaluar<strong>{report.comparison.unevaluated.length}</strong></span></div></Card>}
    {data.indexing.rows.length > 0 && <Card><CardHeader title="URL Inspection · muestra persistida" detail={data.indexing.message} /><p>{data.indexing.indexed} indexadas de {data.indexing.inspected} inspeccionadas.</p></Card>}
    <PerformanceSummary data={data} />
  </>;
}
function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="audit-kpi-card neutral"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }

function Issues({ issues, disabled, recheck }: { issues: AuditIssue[]; disabled: boolean; recheck: (urls: string[]) => void }) {
  const groups = new Map<string, AuditIssue[]>();
  issues.forEach((issue) => { const key = issue.rule || issue.issue; groups.set(key, [...(groups.get(key) || []), issue]); });
  return <Card><CardHeader title={`${groups.size} tipos de problemas · ${issues.length} incidencias`} action={<button onClick={() => exportRows("audit-issues.json", issues)}>Exportar JSON</button>} /><div className="issue-list">{[...groups.entries()].map(([key, values]) => <details className="crawl-issue" key={key}><summary><StatusPill tone={values[0].severity === "Alta" ? "error" : "warning"}>{values[0].severity}</StatusPill> {values[0].issue} · {values.length} URLs {values[0].evaluation === "review" ? "· revisión humana" : ""}</summary><p>{values[0].recommendation}</p><button disabled={disabled} onClick={() => recheck(values.slice(0, 100).map((item) => item.url))}>Reauditar hasta 100 URLs</button>{values.map((issue) => <div className="crawl-evidence" key={issue.id}><a href={issue.url} target="_blank" rel="noreferrer">{issue.url || issue.id}</a><p>{issue.evidence}</p></div>)}</details>)}</div>{!issues.length && <EmptyState title="Sin incidencias detectadas" detail="Consultar la cobertura antes de interpretar el resultado." />}</Card>;
}

function Pages({ data, recheck, disabled }: { data: AuditData; recheck: (urls: string[]) => void; disabled: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const page = data.crawler.audited.find((item) => item.url === selected);
  const columns: TableColumn<PageAudit>[] = [
    { key: "url", label: "URL", sortValue: (row) => row.url, filter: "text", render: (row) => <button className="crawl-url" onClick={() => setSelected(row.url)}>{row.url}</button> },
    { key: "language", label: "Idioma", sortValue: (row) => row.language, filter: "select", options: ["ES", "EN", "PT-BR"] },
    { key: "template", label: "Plantilla", sortValue: (row) => row.template, filter: "text" },
    { key: "outcome", label: "Estado", sortValue: (row) => row.outcome || row.status, filter: "text" },
    { key: "http", label: "HTTP", sortValue: (row) => row.httpStatus || 0 },
    { key: "depth", label: "Profundidad", sortValue: (row) => row.depth ?? -1, render: (row) => row.depth ?? "No alcanzada" },
    { key: "impressions", label: "Impresiones GSC", sortValue: (row) => row.traffic?.impressions || 0, render: (row) => number(row.traffic?.impressions) },
  ];
  return <><Card><CardHeader title="Páginas" detail="Seleccionar una URL para ver su diagnóstico." action={<button onClick={() => exportRows("audit-pages.json", data.crawler.audited)}>Exportar JSON</button>} /><DataTable columns={columns} rows={data.crawler.audited} rowKey={(row) => row.url} label="páginas" storageKey="audit-pages-filters-v1" /></Card>
    {page && <Card><CardHeader title={page.url} action={<button onClick={() => setSelected(null)}>Cerrar</button>} /><button disabled={disabled} onClick={() => recheck([page.url])}>Reauditar URL</button><div className="audit-stat-list"><span>Resultado<strong>{page.outcome || page.status} · HTTP {page.httpStatus}</strong></span><span>Title<strong>{page.title || "Ausente"}</strong></span><span>Description<strong>{page.metaDescription || "Ausente"}</strong></span><span>Canonical<strong>{page.canonical || "Sin declaración"}</strong></span><span>Robots<strong>{page.robotsMeta || "Sin meta"} · {page.xRobotsTag || "Sin cabecera"}</strong></span><span>H1<strong>{page.h1.join(" · ") || "Ausente"}</strong></span><span>JSON-LD<strong>{page.jsonLd} bloques · {page.schemaEntities ?? "?"} entidades · {page.schemaTypes.join(", ")}</strong></span><span>Respuesta<strong>{number(page.durationMs)} ms · {page.wordCount ?? "?"} palabras</strong></span></div>{page.error && <p>{page.error}</p>}{page.traffic && <p>Prioridad: {page.traffic.impressions} impresiones, {page.traffic.clicks} clics y {page.traffic.users} usuarios de landing page · {page.traffic.start} a {page.traffic.end}.</p>}<details><summary>Enlaces entrantes</summary>{data.crawler.audited.filter((item) => item.links?.some((link) => link.url === page.url)).map((item) => <p key={item.url}>{item.url}</p>)}</details><details><summary>Enlaces salientes ({page.links?.length || 0})</summary>{page.links?.map((link) => <p key={link.url}>{link.text}: {link.url}</p>)}</details><details><summary>Hreflang</summary>{page.hreflang?.map((item) => <p key={`${item.language}-${item.url}`}>{item.language}: {item.url}</p>)}</details>{data.crawler.issues.filter((item) => item.url === page.url).map((item) => <p key={item.id}><b>{item.issue}:</b> {item.evidence}</p>)}</Card>}
  </>;
}

function Experience({ reports, runId }: { reports: BrowserReport[]; runId?: number }) {
  const evidenceUrl = (report: BrowserReport, name: string) => `/api/audit/runs/${runId}/evidence?report=${encodeURIComponent(report.id)}&name=${encodeURIComponent(name)}`;
  return <Card>
    <CardHeader title="Auditoría renderizada y experiencia" detail="Playwright + axe-core; la cobertura automática no certifica WCAG ni conversiones." />
    <p>Ejecutar en local o CI: <code>npm run audit:browser -- --run={runId || "ID"}</code></p>
    {!reports.length && <EmptyState title="Sin escenarios ejecutados" detail="El runner guarda resultados y capturas en esta corrida. Las trazas se conservan como artefactos del runner." />}
    {reports.map((report) => <section key={report.id}>
      <h3>{date(report.createdAt)} · criterios {report.criteriaVersion}</h3>
      <p>{report.scenarios.filter((item) => item.status === "completed").length}/{report.scenarios.length} escenarios completados · {report.findings.length} hallazgos</p>
      <p>{report.summary.journeys.passed}/{report.summary.journeys.evaluated} pasos de recorrido verificados · {report.summary.automaticFailures} fallos automáticos · {report.summary.reviewFindings} observaciones para revisión</p>
      <details><summary>Escenarios y criterios evaluados</summary>{report.scenarios.map((scenario) => <div className="crawl-evidence" key={scenario.id}><b>{scenario.language} · {scenario.template} · {scenario.viewport} · {scenario.status}</b><p>{scenario.url}</p>{scenario.screenshot && report.persistedArtifacts?.includes(scenario.screenshot) && <a href={evidenceUrl(report, scenario.screenshot)} target="_blank" rel="noreferrer">Ver captura</a>}{scenario.checks.map((check, index) => <p key={`${check.criterion}-${index}`}>{check.criterion}: {check.status} · {check.evidence}</p>)}</div>)}</details>
      {report.findings.map((finding, index) => <details className="crawl-issue" key={`${finding.scenario}-${finding.criterion}-${index}`}>
        <summary>{finding.severity} · {finding.title} · {finding.evaluation === "review" ? "revisión humana" : "automático"}</summary>
        <p>{finding.url} · {finding.viewport} · confianza {finding.confidence}</p><p>{finding.evidence}</p><p>{finding.recommendation}</p>
        {finding.artifact && (report.persistedArtifacts?.includes(finding.artifact) ? <a href={evidenceUrl(report, finding.artifact)} target="_blank" rel="noreferrer">Ver evidencia: {finding.artifact}</a> : <code>{finding.artifact}</code>)}
      </details>)}
    </section>)}
  </Card>;
}
