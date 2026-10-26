"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CircleCheck, Clock3, RefreshCw, Search, ShieldAlert } from "lucide-react";
import type { Alert, AlertEvaluation, AlertSeverity, AlertSource, AlertStatus } from "@/lib/alerts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

const SOURCES: Array<"Todas" | AlertSource> = ["Todas", "GSC", "GA4", "Auditoría", "CWV", "Indexación", "Integraciones"];
const SEVERITY_LABEL: Record<AlertSeverity, string> = { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja" };
const SEVERITY_TONE = { critical: "negative", high: "negative", medium: "caution", low: "neutral" } as const;
const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SOURCE_HREF: Partial<Record<AlertSource, string>> = { GSC: "/search-console", GA4: "/analytics", Auditoría: "/auditoria-tecnica", CWV: "/auditoria-tecnica", Indexación: "/indexacion", Integraciones: "/configuracion" };
const EMPTY: AlertEvaluation = { alerts: [], evaluatedAt: "", evaluatedSources: [], pendingSources: [], persistence: "session" };

const when = (value: string) => (value ? new Date(value).toLocaleString("es-ES") : "Pendiente");
const display = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 });

export function AlertsPanel() {
  const [data, setData] = useState<AlertEvaluation>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof SOURCES)[number]>("Todas");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("severity");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      const json = (await response.json()) as AlertEvaluation & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "No se pudieron evaluar las alertas.");
      setData(json);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron evaluar las alertas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const update = async (alert: Alert, nextStatus: AlertStatus) => {
    const response = await fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: alert.id, status: nextStatus }) });
    if (response.ok) setData((await response.json()) as AlertEvaluation);
  };

  const filtered = useMemo(
    () =>
      data.alerts
        .filter(
          (item) =>
            (tab === "Todas" || item.source === tab) &&
            (severity === "all" || item.severity === severity) &&
            (status === "all" || (status === "active" ? item.status !== "resolved" : item.status === status)) &&
            (!search || `${item.title} ${item.message} ${item.entity ?? ""}`.toLowerCase().includes(search.toLowerCase())),
        )
        .sort((a, b) =>
          sort === "date"
            ? new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
            : sort === "variation"
              ? Math.abs(b.variation ?? 0) - Math.abs(a.variation ?? 0)
              : SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
        ),
    [data.alerts, search, severity, sort, status, tab],
  );

  const active = data.alerts.filter((item) => item.status !== "resolved");
  const critical = active.filter((item) => item.severity === "critical" || item.severity === "high").length;
  const medium = active.filter((item) => item.severity === "medium").length;
  const resolved = data.alerts.filter((item) => item.status === "resolved").length;
  const counts = (source: (typeof SOURCES)[number]) => (source === "Todas" ? data.alerts.length : data.alerts.filter((item) => item.source === source).length);

  return (
    <div className="wm-rise space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <ShieldAlert className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">SEO Control Center</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Alertas</h1>
          <p className="mt-1 text-[11.5px] text-content-muted">Señales reales evaluadas desde snapshots persistidos, sin consultas externas en cada render.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Actualizar datos
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-content-faint">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3" /> Última evaluación: <strong className="font-medium text-content-muted">{when(data.evaluatedAt)}</strong>
        </span>
        <span>
          Fuentes evaluadas: <strong className="font-medium text-content-muted">{data.evaluatedSources.length ? data.evaluatedSources.join(" · ") : "Ninguna"}</strong>
        </span>
        <Badge tone={data.persistence === "database" ? "positive" : "caution"}>{data.persistence === "database" ? "Persistencia en base" : "Persistencia de sesión"}</Badge>
      </div>

      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-[11.5px] text-negative">
          <AlertTriangle className="size-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Activas" value={active.length} icon={<ShieldAlert className="size-3.5" />} detail="Alertas accionables" />
        <StatCard label="Críticas / altas" value={critical} icon={<AlertTriangle className="size-3.5" />} tone={critical ? "negative" : "positive"} detail="Prioridad inmediata" />
        <StatCard label="Medias" value={medium} icon={<Clock3 className="size-3.5" />} tone={medium ? "caution" : "positive"} detail="Requieren seguimiento" />
        <StatCard label="Resueltas" value={resolved} icon={<CircleCheck className="size-3.5" />} tone="positive" detail="Historial persistido" />
      </div>

      {data.pendingSources.length > 0 ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-[11px] text-caution">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">Fuentes pendientes</strong> · {data.pendingSources.join(" · ")}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-edge bg-surface-1 p-1">
        {SOURCES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            aria-pressed={tab === item}
            className={cn(
              "wm-focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors",
              tab === item ? "bg-surface-3 text-content shadow-sm" : "text-content-muted hover:text-content",
            )}
          >
            {item}
            <span className="tnum text-[10px] text-content-faint">{counts(item)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <label className="inline-flex h-7 items-center gap-1.5 rounded-md border border-edge bg-surface-1 pl-2 pr-1 text-[11px] text-content-muted">
          <span className="text-content-faint">Severidad</span>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Severidad" className="wm-focus-ring cursor-pointer appearance-none bg-transparent py-0.5 pr-1 text-[11px] font-medium text-content outline-none">
            <option value="all">Todas</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
        </label>
        <label className="inline-flex h-7 items-center gap-1.5 rounded-md border border-edge bg-surface-1 pl-2 pr-1 text-[11px] text-content-muted">
          <span className="text-content-faint">Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Estado" className="wm-focus-ring cursor-pointer appearance-none bg-transparent py-0.5 pr-1 text-[11px] font-medium text-content outline-none">
            <option value="active">Activas</option>
            <option value="new">Nuevas</option>
            <option value="reviewed">Revisadas</option>
            <option value="resolved">Resueltas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label className="inline-flex h-7 items-center gap-1.5 rounded-md border border-edge bg-surface-1 pl-2 pr-1 text-[11px] text-content-muted">
          <span className="text-content-faint">Orden</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Orden" className="wm-focus-ring cursor-pointer appearance-none bg-transparent py-0.5 pr-1 text-[11px] font-medium text-content outline-none">
            <option value="severity">Severidad</option>
            <option value="date">Fecha</option>
            <option value="variation">Variación</option>
          </select>
        </label>
        <label className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-content-faint" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar alerta"
            aria-label="Buscar alerta"
            className="wm-focus-ring h-8 w-full rounded-lg border border-edge bg-surface-1 pl-8 pr-3 text-[11.5px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none"
          />
        </label>
      </div>

      {filtered.length ? (
        <div className="space-y-2">
          {filtered.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onUpdate={(item, next) => void update(item, next)} />
          ))}
        </div>
      ) : (
        <Section title="Sin alertas para estos filtros" detail="Probá cambiar la fuente, la severidad o el estado.">
          <p className="px-1 py-6 text-center text-[11px] text-content-faint">
            {loading ? "Evaluando alertas…" : "No hay alertas que coincidan con la selección actual."}
          </p>
        </Section>
      )}
    </div>
  );
}

function AlertRow({ alert, onUpdate }: { alert: Alert; onUpdate: (alert: Alert, status: AlertStatus) => void }) {
  const href = SOURCE_HREF[alert.source];
  const accent = alert.severity === "critical" || alert.severity === "high" ? "border-l-negative" : alert.severity === "medium" ? "border-l-caution" : "border-l-edge-strong";
  return (
    <article className={cn("rounded-xl border border-edge border-l-2 bg-surface-1 px-3 py-2.5", accent)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={SEVERITY_TONE[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</Badge>
        <Badge tone="neutral">{alert.source}</Badge>
        {alert.status === "reviewed" ? <Badge tone="caution">Revisada</Badge> : null}
        {alert.status === "resolved" ? <Badge tone="positive">Resuelta</Badge> : null}
        <span className="ml-auto font-mono text-[10px] text-content-faint">{when(alert.detectedAt)}</span>
      </div>

      <h2 className="mt-1.5 text-[12.5px] font-semibold text-content">{alert.title}</h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-content-muted">{alert.message}</p>
      {alert.entity ? <p className="mt-0.5 truncate font-mono text-[10px] text-content-faint">{alert.entity}</p> : null}

      {alert.metric ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-edge bg-surface-2/40 px-2.5 py-1.5 text-[10.5px] text-content-faint">
          <span className="font-medium text-content-muted">{alert.metric}</span>
          <span>
            Actual <strong className="font-mono tabular-nums text-content">{alert.currentValue == null ? "—" : display(alert.currentValue)}</strong>
          </span>
          {alert.previousValue != null ? (
            <span>
              Anterior <strong className="font-mono tabular-nums text-content">{display(alert.previousValue)}</strong>
            </span>
          ) : null}
          {alert.variation != null ? (
            <span className={cn("font-mono tabular-nums", alert.variation > 0 ? "text-positive" : alert.variation < 0 ? "text-negative" : "text-content-faint")}>
              {alert.variation > 0 ? "+" : ""}
              {alert.variation.toFixed(1).replace(".", ",")}%
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 rounded-lg border border-edge/70 bg-surface-2/30 px-2.5 py-1.5">
        <p className="text-[9.5px] uppercase tracking-[0.07em] text-content-faint">Recomendación</p>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-content-muted">{alert.recommendation}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {href ? (
          <Link href={href} className="wm-focus-ring rounded-md px-1.5 py-1 text-[10.5px] text-accent hover:underline">
            Ver sección
          </Link>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {alert.status === "resolved" ? (
            <Button variant="secondary" size="sm" onClick={() => onUpdate(alert, "new")} className="gap-1.5">
              <RefreshCw className="size-3" /> Reabrir
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onUpdate(alert, "reviewed")} disabled={alert.status === "reviewed"} className="gap-1.5">
                <Check className="size-3" /> {alert.status === "reviewed" ? "Revisada" : "Marcar revisada"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onUpdate(alert, "resolved")} className="gap-1.5">
                <CircleCheck className="size-3" /> Resolver
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
