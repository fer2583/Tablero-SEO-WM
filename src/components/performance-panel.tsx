"use client";

import { useState } from "react";
import { Gauge, RefreshCw, RotateCw } from "lucide-react";
import type { AuditData, AuditDevice, CruxResult, PsiResult } from "@/lib/audit";
import type { RunView } from "@/lib/crawler/service";
import { coreWebVitalsAssessment, formatCollectionPeriod, formatPerformanceMetric, webVitalRating } from "@/lib/performance-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

const deviceName = (device: AuditDevice) => (device === "mobile" ? "Mobile" : "Desktop");
const when = (value?: string) => (value ? new Date(value).toLocaleString("es-ES") : "Todavía sin consultar");
const SCORES = [
  ["performance", "Performance"],
  ["accessibility", "Accesibilidad"],
  ["bestPractices", "Buenas prácticas"],
  ["seo", "SEO"],
] as const;
const ratingLabel = { good: "Bueno", "needs-improvement": "Necesita mejoras", poor: "Deficiente", unavailable: "Sin datos" };
const ratingTone = { good: "positive", "needs-improvement": "caution", poor: "negative", unavailable: "neutral" } as const;

function ScoreTile({ label, value, device }: { label: string; value: number | null; device: AuditDevice }) {
  const tone = value == null ? "muted" : value >= 90 ? "positive" : value >= 50 ? "caution" : "negative";
  return (
    <div className="rounded-lg border border-edge bg-surface-2/50 px-2.5 py-2">
      <p className="truncate text-[9.5px] uppercase tracking-[0.06em] text-content-faint">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <strong
          aria-label={`${label} ${deviceName(device)}: ${value == null ? "sin datos" : `${value} de 100`}`}
          className={cn(
            "font-mono text-[19px] font-semibold leading-none tabular-nums",
            tone === "positive" && "text-positive",
            tone === "caution" && "text-caution",
            tone === "negative" && "text-negative",
            tone === "muted" && "text-content-faint",
          )}
        >
          {value ?? "—"}
        </strong>
        <span className="text-[9px] text-content-faint">/100</span>
      </p>
      <Progress className="mt-1.5" value={value ?? 0} tone={tone} label={label} />
    </div>
  );
}

export function PsiCard({ result, device }: { result: PsiResult; device: AuditDevice }) {
  return (
    <Section title={`PageSpeed · ${deviceName(device)}`} detail={`Lighthouse · laboratorio · ${when(result.fetchedAt)}`}>
      {result.status === "live" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {SCORES.map(([key, label]) => (
              <ScoreTile key={key} label={label} value={result.scores[key] ?? null} device={device} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {(["lcp", "cls", "fcp", "tbt"] as const).map((key) => (
              <div key={key} className="rounded-md border border-edge bg-surface-2/40 px-2 py-1.5 text-center">
                <p className="text-[9px] uppercase tracking-[0.06em] text-content-faint">{key.toUpperCase()}</p>
                <p className="mt-0.5 font-mono text-[11px] tabular-nums text-content">{formatPerformanceMetric(key, result.metrics[key])}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-content-faint">
            Prueba simulada de esta URL. TBT no es INP y estas mediciones no sustituyen los datos de usuarios reales.
          </p>
        </>
      ) : (
        <EmptyCard
          title={result.status === "error" ? "El test de PageSpeed falló" : "Test de PageSpeed pendiente"}
          detail={result.message || "Se ejecuta automáticamente al terminar la auditoría general. También podés iniciarlo desde Rendimiento."}
        />
      )}
    </Section>
  );
}

export function CruxCard({ result, device }: { result: CruxResult; device: AuditDevice }) {
  const noData = result.diagnostic?.code === "no_data" || /volumen suficiente|datos suficientes/i.test(result.message || "");
  const assessment = coreWebVitalsAssessment(result.metrics);
  const period = formatCollectionPeriod(result.collectionPeriod);
  return (
    <Section title={`Core Web Vitals · ${deviceName(device)}`} detail={`CrUX · usuarios reales · p75 · ${result.origin}`}>
      {result.status === "live" ? (
        <>
          <Badge tone={assessment === "passed" ? "positive" : assessment === "incomplete" ? "neutral" : "caution"}>
            {assessment === "passed" ? "Cumple Core Web Vitals" : assessment === "incomplete" ? "Medición incompleta" : "Necesita atención"}
          </Badge>
          <div className="mt-2 space-y-1.5">
            {(["lcp", "inp", "cls"] as const).map((key) => {
              const rating = webVitalRating(key, result.metrics[key]);
              return (
                <div key={key} className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-2/40 px-2.5 py-1.5">
                  <span className="font-mono text-[10px] text-content-faint">{key.toUpperCase()}</span>
                  <span className="font-mono text-[12px] tabular-nums text-content">{formatPerformanceMetric(key, result.metrics[key])}</span>
                  <Badge tone={ratingTone[rating]}>{ratingLabel[rating]}</Badge>
                </div>
              );
            })}
          </div>
          {period ? <p className="mt-2 text-[10px] text-content-faint">Período de colección: {period}</p> : null}
          <p className="mt-1 text-[10px] leading-relaxed text-content-faint">
            Datos del origen, no de cada URL. Consultado: {when(result.fetchedAt)}.
          </p>
        </>
      ) : (
        <EmptyCard
          title={noData ? "Google no tiene datos de campo suficientes" : result.status === "error" ? "La consulta a CrUX falló" : "Consulta de CrUX pendiente"}
          detail={
            noData
              ? "CrUX no dispone de una muestra publicable para este origen y dispositivo. Esto no impide ejecutar PageSpeed; INP de usuarios reales queda sin datos hasta que Google publique una muestra."
              : result.message || "Se consulta junto con los tests de PageSpeed al terminar la auditoría."
          }
        />
      )}
    </Section>
  );
}

function EmptyCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-edge/70 px-4 py-6 text-center">
      <p className="text-[12px] font-medium text-content">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[10.5px] leading-relaxed text-content-faint">{detail}</p>
    </div>
  );
}

export function PerformanceSummary({ data }: { data: AuditData }) {
  const running = data.performanceTask?.status === "running";
  return (
    <section aria-label="PageSpeed y Core Web Vitals" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[12.5px] font-semibold text-content">PageSpeed y Core Web Vitals</h2>
        {running ? (
          <span className="flex items-center gap-1.5 text-[10.5px] text-caution">
            <RotateCw className="size-3 animate-spin" /> Consultando…
          </span>
        ) : null}
      </div>
      {data.performanceTask?.status === "error" ? (
        <p role="alert" className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-[11px] text-negative">
          {data.performanceTask.message}
        </p>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-2">
        {(["mobile", "desktop"] as AuditDevice[]).map((device) => (
          <PsiCard key={`psi-${device}`} device={device} result={data.devices[device].psi} />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {(["mobile", "desktop"] as AuditDevice[]).map((device) => (
          <CruxCard key={`crux-${device}`} device={device} result={data.devices[device].crux} />
        ))}
      </div>
    </section>
  );
}

export function PerformancePanel({ data, run, device, setDevice, apply }: { data: AuditData; run: RunView | null; device: AuditDevice; setDevice: (device: AuditDevice) => void; apply: (run: RunView) => void }) {
  const htmlPages = data.crawler.audited.filter((page) => page.outcome === "html");
  const [url, setUrl] = useState(htmlPages.some((page) => page.url === data.siteUrl) ? data.siteUrl : htmlPages[0]?.url || data.siteUrl);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const representatives = new Map<string, (typeof htmlPages)[number]>();
  htmlPages.forEach((page) => {
    const key = `${page.template}:${page.language}`;
    if (!representatives.has(key)) representatives.set(key, page);
  });
  const available = new Map([...representatives.values(), ...htmlPages.filter((page) => !!data.performancePages?.[page.url])].map((page) => [page.url, page]));
  const devices = data.performancePages?.[url] || (url === data.siteUrl ? data.devices : null);
  const running = data.performanceTask?.status === "running";

  const enrich = async (force: boolean) => {
    if (!run) return;
    setStarting(true);
    setError("");
    try {
      const response = await fetch(`/api/audit/runs/${run.id}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, force }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo iniciar la consulta.");
      apply(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error de rendimiento");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Section
        title="Tests de PageSpeed y Core Web Vitals"
        detail="La home se consulta automáticamente al terminar el crawl general. Las páginas representativas se pueden consultar aquí."
        action={<Gauge className="size-4 text-content-faint" />}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="URL de rendimiento"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="wm-focus-ring h-8 max-w-full flex-1 rounded-lg border border-edge bg-surface-1 px-2 text-[11px] text-content outline-none focus:border-accent/60"
          >
            {htmlPages.some((page) => page.url === data.siteUrl) && <option value={data.siteUrl}>Home · {data.siteUrl}</option>}
            {[...available.values()]
              .filter((page) => page.url !== data.siteUrl)
              .map((page) => (
                <option key={page.url} value={page.url}>
                  {page.template} · {page.language} · {page.url}
                </option>
              ))}
          </select>
          <select
            aria-label="Dispositivo"
            value={device}
            onChange={(event) => setDevice(event.target.value as AuditDevice)}
            className="wm-focus-ring h-8 rounded-lg border border-edge bg-surface-1 px-2 text-[11px] text-content outline-none focus:border-accent/60"
          >
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
          <Button variant="secondary" size="sm" disabled={starting || running || run?.status !== "completed"} onClick={() => void enrich(false)} className="gap-1.5">
            <Gauge className="size-3.5" /> Consultar PageSpeed y CWV
          </Button>
          <Button variant="outline" size="sm" disabled={starting || running || run?.status !== "completed"} onClick={() => void enrich(true)} className="gap-1.5">
            <RefreshCw className="size-3.5" /> Repetir tests sin caché
          </Button>
        </div>
        {running ? (
          <p role="status" className="mt-2 text-[10.5px] text-caution">
            Consultando PageSpeed y Core Web Vitals… Los resultados se actualizarán automáticamente.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 rounded-lg border border-negative/30 bg-negative/10 px-2.5 py-1.5 text-[10.5px] text-negative">
            {error}
          </p>
        ) : null}
        {data.performanceTask?.status === "error" ? (
          <p role="alert" className="mt-2 rounded-lg border border-caution/30 bg-caution/10 px-2.5 py-1.5 text-[10.5px] text-caution">
            {data.performanceTask.message}
          </p>
        ) : null}
        <p className="mt-2 text-[10px] leading-relaxed text-content-faint">
          Consultar reutiliza resultados válidos durante 24 h. Repetir solicita una nueva medición a Google. Cada ejecución consulta mobile y desktop.
        </p>
      </Section>

      {devices ? (
        <>
          <div className="grid gap-3 xl:grid-cols-2">
            <PsiCard result={devices[device].psi} device={device} />
            <CruxCard result={devices[device].crux} device={device} />
          </div>
          <Section title="Oportunidades Lighthouse" detail={url}>
            {devices[device].psi.opportunities.length ? (
              <ul className="space-y-1.5">
                {devices[device].psi.opportunities.map((item, index) => (
                  <li key={index} className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-2/40 px-2.5 py-1.5 text-[11px]">
                    <span className="min-w-0 truncate text-content">{item.title}</span>
                    <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-content-muted">{item.displayValue}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-4 text-center text-[11px] text-content-faint">No hay oportunidades publicadas para esta medición.</p>
            )}
          </Section>
        </>
      ) : (
        <EmptyCard title="Esta URL todavía no tiene un test guardado" detail="Iniciá una consulta para obtener resultados específicos de la página seleccionada." />
      )}
    </div>
  );
}
