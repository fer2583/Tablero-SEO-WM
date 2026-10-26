"use client";

import { AlertTriangle, Pause, Play, RefreshCw, ShieldCheck, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditData, AuditDevice, AuditHistory } from "@/lib/audit";
import type { RunView } from "@/lib/crawler/service";
import type { BrowserReport } from "@/lib/browser-audit/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { PerformancePanel } from "@/components/performance-panel";
import { AuditSummaryView } from "./audit/audit-summary-view";
import { AuditIssuesView } from "./audit/audit-issues-view";
import { AuditPagesView } from "./audit/audit-pages-view";
import { AuditExperienceView } from "./audit/audit-experience-view";
import { AuditHistoryView } from "./audit/audit-history-view";
import { AuditSettingsView } from "./audit/audit-settings-view";
import { cn } from "@/lib/utils";

const TABS = ["Resumen", "Issues", "Páginas", "Experiencia", "Rendimiento", "Historial", "Configuración"] as const;
type Tab = (typeof TABS)[number];

const when = (value?: string | null) => (value ? new Date(value).toLocaleString("es-ES") : "Sin datos");
const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "La operación falló.");
  return payload as T;
}

const statusTone = (status: string) =>
  status === "completed" ? "positive" : status === "running" ? "accent" : status === "paused" ? "caution" : status === "cancelled" ? "negative" : "neutral";

export function AuditPanel() {
  const [data, setData] = useState<AuditData | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [history, setHistory] = useState<AuditHistory[]>([]);
  const [tab, setTab] = useState<Tab>("Resumen");
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
    setRun(view);
    setData(view.snapshot);
    if (view.snapshot.history !== "no_data") setHistory(view.snapshot.history);
  }, []);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const payload = await request<{ snapshot: AuditData | null; activeRun: RunView | null; latestRunId: number | null; history: AuditHistory[]; config?: { maxUrls: number } }>("/api/audit");
      setHistory(payload.history);
      if (payload.config) setMaxUrls(payload.config.maxUrls);
      if (payload.activeRun) {
        apply(payload.activeRun);
        setDriving(["queued", "running"].includes(payload.activeRun.status));
      } else {
        setData(payload.snapshot);
        setRun(null);
        if (payload.latestRunId) {
          const response = await fetch(`/api/audit/runs/${payload.latestRunId}`, { cache: "no-store" });
          if (response.ok) apply(await response.json());
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!run?.retryAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run?.retryAt]);

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
        if (!cancelled) {
          apply(view);
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo actualizar el rendimiento.");
      } finally {
        pending = false;
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [performanceRunId, performanceRunning, apply]);

  useEffect(() => {
    if (!driving || !run || !["queued", "running"].includes(run.status)) return;
    const timer = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      setWorking(true);
      try {
        const view = await request<RunView>(`/api/audit/runs/${run.id}/process`, {});
        if (pendingAction.current && ["queued", "running", "paused"].includes(view.status)) {
          const action = pendingAction.current;
          pendingAction.current = null;
          apply(await request<RunView>(`/api/audit/runs/${run.id}/actions`, { action }));
          setDriving(false);
        } else {
          apply(view);
          if (["completed", "paused", "cancelled"].includes(view.status)) setDriving(false);
        }
      } catch (reason) {
        setDriving(false);
        setError(reason instanceof Error ? reason.message : "Error de lote. Podés reanudar sin perder resultados.");
      } finally {
        busy.current = false;
        setWorking(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [run, driving, apply]);

  const start = async (urls?: string[]) => {
    setWorking(true);
    setError("");
    pendingAction.current = null;
    try {
      const view = await request<RunView>("/api/audit/runs", { urls, maxUrls });
      apply(view);
      setDriving(["queued", "running"].includes(view.status));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar.");
    } finally {
      setWorking(false);
    }
  };

  const action = async (value: "pause" | "resume" | "cancel") => {
    if (!run) return;
    if (busy.current && value !== "resume") {
      pendingAction.current = value;
      setDriving(false);
      return;
    }
    setWorking(true);
    setError("");
    try {
      const view = await request<RunView>(`/api/audit/runs/${run.id}/actions`, { action: value });
      apply(view);
      setDriving(value === "resume");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar el estado.");
    } finally {
      setWorking(false);
    }
  };

  const openRun = async (id: number) => {
    setError("");
    try {
      apply(await request<RunView>(`/api/audit/runs/${id}`));
      setDriving(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Snapshot histórico anterior a v2.");
    }
  };

  const active = !!run && ["queued", "running", "paused"].includes(run.status);
  const total = run ? Math.max(1, run.progress.processed + run.progress.pending) : 1;
  const progress = run ? (run.progress.processed / total) * 100 : 0;

  return (
    <div className="wm-rise space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <ShieldCheck className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">Auditoría técnica</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Auditoría Web</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
            <span className="truncate">{data?.siteUrl ?? "www.whalemate.com"}</span>
            <span className="text-content-faint">·</span>
            <span className="text-content-faint">{data ? when(data.generatedAt) : "Sin auditorías publicadas"}</span>
            {data ? <Badge tone="neutral">{data.scope === "selective" ? "Reauditoría selectiva" : "SEO técnico + experiencia renderizada"}</Badge> : null}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="primary" size="sm" disabled={working || active || loading} onClick={() => void start()} className="gap-1.5">
            <RefreshCw className={cn("size-3.5", working && "animate-spin")} /> Auditar sitio
          </Button>
          <Button variant="secondary" size="sm" disabled={working} onClick={() => void load()}>
            Actualizar
          </Button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-[11.5px] text-negative">
          <AlertTriangle className="size-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      {run ? (
        <Section
          title={`Corrida #${run.id} · ${run.status}`}
          detail={`${integer.format(run.progress.processed)} procesadas · ${integer.format(run.progress.pending)} pendientes · ${integer.format(run.progress.blocked)} bloqueadas · ${integer.format(run.progress.failed)} fallidas · ${integer.format(run.progress.excluded)} excluidas`}
          action={<Badge tone={statusTone(run.status)}>{run.status}</Badge>}
        >
          <Progress value={progress} tone={run.status === "paused" ? "caution" : run.status === "cancelled" ? "negative" : "accent"} label="Progreso del crawl" />

          <p aria-live="polite" className="mt-2 text-[11px] text-content-muted">
            {run.snapshot.crawler.message}
            {run.retryAt ? ` Reintentar después de ${when(run.retryAt)}.` : ""}
          </p>

          {run.progress.limitReached ? <p className="mt-1 text-[10.5px] text-caution">Cobertura limitada por la configuración; consultar exclusiones.</p> : null}

          {active ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Button variant="secondary" size="sm" disabled={run.status === "paused"} onClick={() => void action("pause")} className="gap-1.5">
                <Pause className="size-3.5" /> Pausar al terminar el lote
              </Button>
              <Button variant="secondary" size="sm" disabled={working || driving || (!!run.retryAt && Date.parse(run.retryAt) > clock)} onClick={() => void action("resume")} className="gap-1.5">
                <Play className="size-3.5" /> Reanudar
              </Button>
              <Button variant="danger" size="sm" onClick={() => void action("cancel")} className="gap-1.5">
                <Square className="size-3.5" /> Cancelar
              </Button>
            </div>
          ) : null}
        </Section>
      ) : null}

      <div aria-label="Secciones de auditoría" className="wm-scroll-x flex w-full gap-1 overflow-x-auto rounded-lg border border-edge bg-surface-1 p-1">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
            className={cn(
              "wm-focus-ring shrink-0 rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors",
              tab === item ? "bg-surface-3 text-content shadow-sm" : "text-content-muted hover:text-content",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="wm-skeleton h-[104px] rounded-xl" />
            ))}
          </div>
          <div className="wm-skeleton h-[220px] rounded-xl" />
        </div>
      ) : tab === "Historial" ? (
        <AuditHistoryView history={history} active={active} working={working} openRun={(id) => void openRun(id)} />
      ) : !data ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
          <ShieldCheck className="size-6 text-content-faint" />
          <p className="mt-3 text-[13px] font-medium text-content">Todavía no hay una auditoría</p>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-content-faint">
            Iniciá una corrida para analizar el sitio completo. El progreso se conserva al cerrar esta página.
          </p>
        </div>
      ) : (
        <>
          {tab === "Resumen" ? <AuditSummaryView data={data} /> : null}
          {tab === "Issues" ? <AuditIssuesView issues={data.crawler.issues} disabled={working || active} recheck={(urls) => void start(urls)} /> : null}
          {tab === "Páginas" ? <AuditPagesView data={data} disabled={working || active} recheck={(urls) => void start(urls)} /> : null}
          {tab === "Experiencia" ? <AuditExperienceView reports={(run?.browserReports || []) as BrowserReport[]} runId={run?.id} /> : null}
          {tab === "Rendimiento" ? <PerformancePanel key={run?.id} data={data} run={run} device={device} setDevice={setDevice} apply={apply} /> : null}
          {tab === "Configuración" ? <AuditSettingsView data={data} run={run} maxUrls={maxUrls} setMaxUrls={setMaxUrls} /> : null}
        </>
      )}
    </div>
  );
}
