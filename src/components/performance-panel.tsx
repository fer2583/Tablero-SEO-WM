"use client";

import { useState } from "react";
import type { AuditData, AuditDevice, CruxResult, PsiResult } from "@/lib/audit";
import type { RunView } from "@/lib/crawler/service";
import { coreWebVitalsAssessment, formatCollectionPeriod, formatPerformanceMetric, webVitalRating } from "@/lib/performance-display";
import { Card, CardHeader, EmptyState, StatusPill } from "./ui";

const deviceName = (device: AuditDevice) => device === "mobile" ? "Mobile" : "Desktop";
const date = (value?: string) => value ? new Date(value).toLocaleString("es-ES") : "Todavía sin consultar";
const scores = { performance: "Performance", accessibility: "Accesibilidad", bestPractices: "Buenas prácticas", seo: "SEO" };
const ratingLabel = { good: "Bueno", "needs-improvement": "Necesita mejoras", poor: "Deficiente", unavailable: "Sin datos" };

function PsiCard({ result, device }: { result: PsiResult; device: AuditDevice }) {
  return <Card>
    <CardHeader title={`PageSpeed · ${deviceName(device)}`} detail={`Lighthouse · laboratorio · ${date(result.fetchedAt)}`} />
    {result.status === "live" ? <>
      <div className="performance-scores">{Object.entries(scores).map(([key, label]) => {
        const value = result.scores[key];
        return <div className={`performance-score ${value == null ? "neutral" : value >= 90 ? "good" : value >= 50 ? "needs-improvement" : "poor"}`} key={key}>
          <span>{label}</span><strong aria-label={`${label} ${deviceName(device)}: ${value == null ? "sin datos" : `${value} de 100`}`}>{value ?? "—"}</strong><small>/100</small>
        </div>;
      })}</div>
      <div className="performance-metrics">{["lcp", "cls", "fcp", "tbt"].map((key) => <div className="vital-row" key={key}><span>{key.toUpperCase()}</span><b>{formatPerformanceMetric(key, result.metrics[key])}</b></div>)}</div>
      <small className="audit-muted">Prueba simulada de esta URL. TBT no es INP y estas mediciones no sustituyen los datos de usuarios reales.</small>
    </> : <EmptyState title={result.status === "error" ? "El test de PageSpeed falló" : "Test de PageSpeed pendiente"} detail={result.message || "Se ejecuta automáticamente al terminar la auditoría general. También podés iniciarlo desde Rendimiento."} />}
  </Card>;
}
function CruxCard({ result, device }: { result: CruxResult; device: AuditDevice }) {
  const noData = result.diagnostic?.code === "no_data" || /volumen suficiente|datos suficientes/i.test(result.message || "");
  const assessment = coreWebVitalsAssessment(result.metrics);
  const period = formatCollectionPeriod(result.collectionPeriod);
  return <Card>
    <CardHeader title={`Core Web Vitals · ${deviceName(device)}`} detail={`CrUX · usuarios reales · p75 · ${result.origin}`} />
    {result.status === "live" ? <>
      <StatusPill tone={assessment === "passed" ? "success" : assessment === "incomplete" ? "neutral" : "warning"}>{assessment === "passed" ? "Cumple Core Web Vitals" : assessment === "incomplete" ? "Medición incompleta" : "Necesita atención"}</StatusPill>
      <div className="performance-metrics">{["lcp", "inp", "cls"].map((key) => {
        const rating = webVitalRating(key, result.metrics[key]);
        return <div className="vital-row" key={key}><span>{key.toUpperCase()}</span><b>{formatPerformanceMetric(key, result.metrics[key])}</b><small className={`performance-rating ${rating}`}>{ratingLabel[rating]}</small></div>;
      })}</div>
      {period && <p>Período de colección: {period}</p>}
      <small className="audit-muted">Datos del origen, no de cada URL. Consultado: {date(result.fetchedAt)}.</small>
    </> : <EmptyState title={noData ? "Google no tiene datos de campo suficientes" : result.status === "error" ? "La consulta a CrUX falló" : "Consulta de CrUX pendiente"} detail={noData ? "CrUX no dispone de una muestra publicable para este origen y dispositivo. Esto no impide ejecutar PageSpeed; INP de usuarios reales queda sin datos hasta que Google publique una muestra." : result.message || "Se consulta junto con los tests de PageSpeed al terminar la auditoría."} />}
  </Card>;
}
export function PerformanceSummary({ data }: { data: AuditData }) {
  const running = data.performanceTask?.status === "running";
  return <section aria-label="PageSpeed y Core Web Vitals" className="performance-section">
    <h2>PageSpeed y Core Web Vitals</h2>
    {running && <p role="status">Consultando PageSpeed y Core Web Vitals… Los resultados se actualizarán automáticamente.</p>}
    {data.performanceTask?.status === "error" && <p role="alert">{data.performanceTask.message}</p>}
    <div className="performance-grid">{(["mobile", "desktop"] as AuditDevice[]).map((device) => <PsiCard key={device} device={device} result={data.devices[device].psi} />)}</div>
    <div className="performance-grid">{(["mobile", "desktop"] as AuditDevice[]).map((device) => <CruxCard key={device} device={device} result={data.devices[device].crux} />)}</div>
  </section>;
}

export function PerformancePanel({ data, run, device, setDevice, apply }: { data: AuditData; run: RunView | null; device: AuditDevice; setDevice: (device: AuditDevice) => void; apply: (run: RunView) => void }) {
  const htmlPages = data.crawler.audited.filter((page) => page.outcome === "html");
  const [url, setUrl] = useState(htmlPages.some((page) => page.url === data.siteUrl) ? data.siteUrl : htmlPages[0]?.url || data.siteUrl);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const representatives = new Map<string, typeof htmlPages[number]>();
  htmlPages.forEach((page) => { const key = `${page.template}:${page.language}`; if (!representatives.has(key)) representatives.set(key, page); });
  const available = new Map([...representatives.values(), ...htmlPages.filter((page) => !!data.performancePages?.[page.url])].map((page) => [page.url, page]));
  const devices = data.performancePages?.[url] || (url === data.siteUrl ? data.devices : null);
  const running = data.performanceTask?.status === "running";
  const enrich = async (force: boolean) => {
    if (!run) return;
    setStarting(true); setError("");
    try {
      const response = await fetch(`/api/audit/runs/${run.id}/enrich`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, force }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo iniciar la consulta.");
      apply(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Error de rendimiento"); }
    finally { setStarting(false); }
  };
  return <>
    <Card>
      <CardHeader title="Tests de PageSpeed y Core Web Vitals" detail="La home se consulta automáticamente al terminar el crawl general. Las páginas representativas se pueden consultar aquí." />
      <div className="crawl-actions">
        <select aria-label="URL de rendimiento" value={url} onChange={(event) => setUrl(event.target.value)}>
          {htmlPages.some((page) => page.url === data.siteUrl) && <option value={data.siteUrl}>Home · {data.siteUrl}</option>}
          {[...available.values()].filter((page) => page.url !== data.siteUrl).map((page) => <option key={page.url} value={page.url}>{page.template} · {page.language} · {page.url}</option>)}
        </select>
        <select aria-label="Dispositivo" value={device} onChange={(event) => setDevice(event.target.value as AuditDevice)}><option value="mobile">Mobile</option><option value="desktop">Desktop</option></select>
        <button disabled={starting || running || run?.status !== "completed"} onClick={() => void enrich(false)}>{starting || running ? "Consultando…" : "Consultar PageSpeed y CWV"}</button>
        <button disabled={starting || running || run?.status !== "completed"} onClick={() => void enrich(true)}>Repetir tests sin caché</button>
      </div>
      {running && <p role="status">Consultando PageSpeed y Core Web Vitals… Los resultados se actualizarán automáticamente.</p>}
      {error && <p role="alert">{error}</p>}
      {data.performanceTask?.status === "error" && <p role="alert">{data.performanceTask.message}</p>}
      <small className="audit-muted">Consultar reutiliza resultados válidos durante 24 h. Repetir solicita una nueva medición a Google. Cada ejecución consulta mobile y desktop.</small>
    </Card>
    {devices ? <>
      <div className="performance-grid"><PsiCard result={devices[device].psi} device={device} /><CruxCard result={devices[device].crux} device={device} /></div>
      <Card><CardHeader title="Oportunidades Lighthouse" detail={url} />{devices[device].psi.opportunities.length ? devices[device].psi.opportunities.map((item, index) => <p key={index}><b>{item.title}</b> {item.displayValue}</p>) : <p>No hay oportunidades publicadas para esta medición.</p>}</Card>
    </> : <EmptyState title="Esta URL todavía no tiene un test guardado" detail="Iniciá una consulta para obtener resultados específicos de la página seleccionada." />}
  </>;
}
