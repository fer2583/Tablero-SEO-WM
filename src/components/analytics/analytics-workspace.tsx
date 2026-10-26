"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import type { AnalyticsViewData, IntegrationResponse } from "@/lib/integrations";
import { useDashboardFilters } from "@/components/filter-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataGrid, type GridColumn } from "@/components/ui/data-grid";
import { FilterPill } from "@/components/ui/filter-pill";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { LazySessionsChart } from "@/components/charts/lazy";
import { cn } from "@/lib/utils";

const VIEWS = ["Acquisition", "Conversions", "Device", "Geographic", "Page Path", "Monthly", "Weekly", "Daily"] as const;
type View = (typeof VIEWS)[number];
type Row = AnalyticsViewData["rows"][number];

const TEMPORAL: View[] = ["Monthly", "Weekly", "Daily"];
const CHART_COLORS = ["var(--wm-chart-1)", "var(--wm-chart-2)", "var(--wm-chart-3)", "var(--wm-chart-4)", "var(--wm-chart-5)", "var(--wm-chart-6)"];
const DIMENSION_LABELS: Record<string, string> = {
  sessionSourceMedium: "Origen / medio",
  eventName: "Evento",
  deviceCategory: "Dispositivo",
  "country / region": "País / región",
  landingPagePlusQueryString: "Landing page",
  pagePath: "Ruta de página",
  sessionDefaultChannelGroup: "Canal",
  sessionCampaignName: "Campaña",
  month: "Mes",
  week: "Semana",
  date: "Fecha",
};
const dimensionLabel = (value: string) => DIMENSION_LABELS[value] ?? value;

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number) => percent.format(value).replace(/\s/g, "");

const numeric = (value: number | null | undefined) =>
  value == null
    ? "—"
    : Number.isInteger(value)
      ? integer.format(value)
      : value < 10
        ? value.toFixed(2).replace(".", ",")
        : value.toLocaleString("es-ES", { maximumFractionDigits: 1 });

const delta = (current: number | null | undefined, previous: number | null | undefined) =>
  current == null || previous == null || previous === 0 ? null : (current - previous) / Math.abs(previous);

const EMPTY: AnalyticsViewData = {
  view: "Acquisition",
  dimension: "",
  period: { start: "", end: "", previousStart: "", previousEnd: "" },
  metrics: { sessions: null, activeUsers: null, newUsers: null, engagementRate: null, conversions: null, keyEvents: null, keyEventsPerSession: null },
  previous: { sessions: null, activeUsers: null, newUsers: null, engagementRate: null, conversions: null, keyEvents: null, keyEventsPerSession: null },
  rows: [],
  warnings: [],
};

const formatDay = (value: string) => {
  if (!value) return "—";
  const iso = /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }).format(parsed).replace(" de ", " ");
};

const temporalLabel = (value: string) => {
  if (/^\d{8}$/.test(value)) return formatDay(value);
  if (/^\d{6}$/.test(value)) return `${value.slice(4, 6)}/${value.slice(0, 4)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDay(value.slice(0, 10));
  return value;
};

export function AnalyticsLive() {
  const { filters, updateFilter, refresh, refreshKey } = useDashboardFilters();
  const [view, setView] = useState<View>("Acquisition");
  const [fullscreen, setFullscreen] = useState(false);
  const [payload, setPayload] = useState<IntegrationResponse<AnalyticsViewData> | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");

  const params = useMemo(() => {
    const next = new URLSearchParams({ days: String(filters.days), language: filters.language, country: filters.country, device: filters.device, view });
    if (filters.source) next.set("source", filters.source);
    if (filters.region) next.set("region", filters.region);
    return next.toString();
  }, [filters.country, filters.days, filters.device, filters.language, filters.region, filters.source, view]);
  const url = `/api/integrations/analytics?${params}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: IntegrationResponse<AnalyticsViewData>) => {
        setPayload(value);
        setLoadedUrl(url);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPayload({ status: "unavailable", data: { ...EMPTY, view }, error: "No se pudo conectar con GA4.", generatedAt: "" });
        setLoadedUrl(url);
      });
    return () => controller.abort();
  }, [url, refreshKey, view]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const response = payload ?? { status: "unavailable" as const, data: { ...EMPTY, view }, error: "Consultando GA4.", generatedAt: "" };
  const data = response.data;
  const live = response.status === "live";
  const loading = loadedUrl !== url;
  const period = data.period.start ? `${formatDay(data.period.start)} – ${formatDay(data.period.end)}` : "Período no disponible";
  const temporal = TEMPORAL.includes(view);
  const dimLabel = dimensionLabel(data.dimension) || view;
  const chartData = useMemo(
    () =>
      [...data.rows]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => ({ label: temporalLabel(row.name), sessions: row.sessions })),
    [data.rows],
  );
  const columns = useMemo(() => buildColumns(dimLabel), [dimLabel]);

  return (
    <div className={cn("wm-rise space-y-3", fullscreen && "fixed inset-0 z-40 overflow-y-auto bg-surface-0 p-4 sm:p-6")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <BarChart3 className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">Analytics</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">El tráfico que mueve el negocio</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-content-faint" /> {period}
            </span>
            <Badge tone={live ? "positive" : response.status === "no_data" ? "caution" : "negative"}>
              {live ? "Live GA4" : response.status === "no_data" ? "Sin datos" : "No disponible"}
            </Badge>
            <span className="text-content-faint">Búsqueda orgánica · GA4</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={refresh} className="gap-1.5">
            <RefreshCw className="size-3.5" /> Actualizar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setFullscreen((value) => !value)} className="gap-1.5">
            {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />} {fullscreen ? "Salir" : "Pantalla completa"}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill label="Periodo" value={String(filters.days)} onChange={(value) => updateFilter("days", value)} options={[["7", "7 días"], ["28", "28 días"], ["30", "30 días"], ["60", "60 días"], ["90", "90 días"]]} />
        <FilterPill label="País" value={filters.country} onChange={(value) => updateFilter("country", value)} options={[["all", "Todos"], ["ES", "España"], ["MX", "México"], ["US", "EE. UU."], ["GB", "Reino Unido"], ["PT", "Portugal"], ["AR", "Argentina"]]} />
        <FilterPill label="Dispositivo" value={filters.device} onChange={(value) => updateFilter("device", value)} options={[["all", "Todos"], ["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]]} />
        <label className="inline-flex h-7 items-center gap-1 rounded-md border border-edge bg-surface-1 pl-2 pr-1">
          <span className="text-[11px] text-content-faint">Origen</span>
          <input
            key={filters.source ?? "empty"}
            defaultValue={filters.source ?? ""}
            onBlur={(event) => updateFilter("source", event.currentTarget.value.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") updateFilter("source", event.currentTarget.value.trim());
            }}
            placeholder="google / organic"
            aria-label="Origen o medio"
            className="wm-focus-ring h-6 w-28 rounded bg-transparent px-1 font-mono text-[10.5px] text-content placeholder:text-content-faint outline-none"
          />
        </label>
        <label className="inline-flex h-7 items-center gap-1 rounded-md border border-edge bg-surface-1 pl-2 pr-1">
          <span className="text-[11px] text-content-faint">Región</span>
          <input
            key={filters.region ?? "empty"}
            defaultValue={filters.region ?? ""}
            onBlur={(event) => updateFilter("region", event.currentTarget.value.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") updateFilter("region", event.currentTarget.value.trim());
            }}
            placeholder="Madrid"
            aria-label="Región"
            className="wm-focus-ring h-6 w-24 rounded bg-transparent px-1 font-mono text-[10.5px] text-content placeholder:text-content-faint outline-none"
          />
        </label>
      </div>

      {!live ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
          <BarChart3 className="size-6 text-content-faint" />
          <p className="mt-3 text-[13px] font-medium text-content">
            {response.status === "no_data" ? "Sin filas para esta vista" : "Google Analytics no está disponible"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-content-faint">
            {response.error ?? "Revisá la conexión de GA4 o los filtros seleccionados."}
          </p>
          <Button variant="secondary" size="sm" onClick={refresh} className="mt-4 gap-1.5">
            <RefreshCw className="size-3.5" /> Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sesiones" value={numeric(data.metrics.sessions)} delta={delta(data.metrics.sessions, data.previous.sessions)} />
            <StatCard label="Usuarios activos" value={numeric(data.metrics.activeUsers)} delta={delta(data.metrics.activeUsers, data.previous.activeUsers)} />
            <StatCard label="Usuarios nuevos" value={numeric(data.metrics.newUsers)} delta={delta(data.metrics.newUsers, data.previous.newUsers)} />
            <StatCard label="Tasa de interacción" value={data.metrics.engagementRate == null ? "—" : pct(data.metrics.engagementRate)} delta={delta(data.metrics.engagementRate, data.previous.engagementRate)} />
            <StatCard label="Conversiones" value={numeric(data.metrics.conversions)} delta={delta(data.metrics.conversions, data.previous.conversions)} />
            <StatCard label="Eventos / sesión" value={numeric(data.metrics.keyEventsPerSession)} delta={delta(data.metrics.keyEventsPerSession, data.previous.keyEventsPerSession)} />
          </div>

          {data.warnings.length ? (
            <div role="status" className="rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-[11px] text-caution">
              {data.warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div aria-label="Vistas de Analytics" className="wm-scroll-x flex w-full gap-1 overflow-x-auto rounded-lg border border-edge bg-surface-1 p-1">
            {VIEWS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                aria-pressed={view === item}
                className={cn(
                  "wm-focus-ring shrink-0 rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors",
                  view === item ? "bg-surface-3 text-content shadow-sm" : "text-content-muted hover:text-content",
                )}
              >
                {item}
              </button>
            ))}
          </div>

          {temporal ? (
            <Section title={`Sesiones · ${view}`} detail="Serie temporal según la vista seleccionada.">
              <LazySessionsChart data={chartData} />
            </Section>
          ) : (
            <div className="grid items-start gap-3 xl:grid-cols-3">
              <Section title="Distribución de sesiones" detail="Top 5 de la dimensión seleccionada." className="xl:col-span-1">
                <Donut rows={data.rows} totalSessions={data.metrics.sessions} />
              </Section>
              <Section title={dimLabel} detail="Resumen de la dimensión activa." className="xl:col-span-2">
                <DataGrid
                  rows={data.rows.slice(0, 6)}
                  columns={previewColumns(dimLabel)}
                  rowKey={(row) => row.name}
                  label={`Analytics · ${view}`}
                  pageSize={6}
                  minWidth={360}
                  dense
                  empty="Sin filas para esta vista."
                />
              </Section>
            </div>
          )}

          <Section
            title={`Datos por ${dimLabel}`}
            detail="Datos reales de GA4 Data API. Búsqueda, filtros y ordenamiento sobre la respuesta."
            action={loading ? <span className="text-[10px] text-content-faint">Actualizando…</span> : null}
          >
            <DataGrid
              rows={data.rows}
              columns={columns}
              rowKey={(row, index) => `${row.name}||${index}`}
              label={`datos de ${view}`}
              searchPlaceholder="Buscar en la dimensión"
              initialSort={{ key: "sessions", direction: "desc" }}
              minWidth={temporal ? 560 : 760}
              empty="Sin filas para el período y los filtros seleccionados."
            />
          </Section>

          <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-content-faint">
            <p>Fuente: Google Analytics 4 · Data API (live, sin caché).</p>
            {response.generatedAt ? <p>{new Date(response.generatedAt).toLocaleString("es-ES")}</p> : null}
          </footer>
        </>
      )}
    </div>
  );
}

function buildColumns(dimension: string): Array<GridColumn<Row>> {
  return [
    {
      key: "name",
      label: dimension || "Dimensión",
      value: (row) => row.name,
      filter: { type: "text" },
      render: (row) => (
        <span className="block max-w-[260px] truncate text-content" title={row.name}>
          {row.name || "(not set)"}
        </span>
      ),
    },
    { key: "sessions", label: "Sesiones", value: (row) => row.sessions, align: "right", render: (row) => <span className="font-mono tabular-nums text-content">{numeric(row.sessions)}</span> },
    { key: "activeUsers", label: "Activos", value: (row) => row.activeUsers, align: "right", hideBelow: "sm", render: (row) => <span className="font-mono tabular-nums text-content-muted">{numeric(row.activeUsers)}</span> },
    { key: "newUsers", label: "Nuevos", value: (row) => row.newUsers, align: "right", hideBelow: "md", render: (row) => <span className="font-mono tabular-nums text-content-muted">{numeric(row.newUsers)}</span> },
    { key: "engagementRate", label: "Interacción", value: (row) => row.engagementRate, align: "right", hideBelow: "lg", render: (row) => <span className="font-mono tabular-nums text-content-muted">{pct(row.engagementRate)}</span> },
    { key: "conversions", label: "Conversiones", value: (row) => row.conversions, align: "right", render: (row) => <span className="font-mono tabular-nums text-content-muted">{numeric(row.conversions)}</span> },
    { key: "keyEventsPerSession", label: "Eventos / sesión", value: (row) => row.keyEventsPerSession, align: "right", hideBelow: "xl", render: (row) => <span className="font-mono tabular-nums text-content-muted">{numeric(row.keyEventsPerSession)}</span> },
  ];
}

function previewColumns(dimension: string): Array<GridColumn<Row>> {
  return [
    {
      key: "name",
      label: dimension || "Dimensión",
      value: (row) => row.name,
      render: (row) => (
        <span className="block max-w-[220px] truncate text-content" title={row.name}>
          {row.name || "(not set)"}
        </span>
      ),
    },
    { key: "sessions", label: "Sesiones", value: (row) => row.sessions, align: "right", render: (row) => <span className="font-mono tabular-nums text-content">{numeric(row.sessions)}</span> },
    { key: "conversions", label: "Conv.", value: (row) => row.conversions, align: "right", render: (row) => <span className="font-mono tabular-nums text-content-muted">{numeric(row.conversions)}</span> },
  ];
}

function Donut({ rows, totalSessions }: { rows: Row[]; totalSessions: number | null }) {
  const top = [...rows].sort((a, b) => b.sessions - a.sessions).slice(0, 5).filter((row) => row.sessions > 0);
  const total = top.reduce((sum, row) => sum + row.sessions, 0);
  if (!total) return <div className="grid h-[180px] place-items-center rounded-lg border border-dashed border-edge/70 text-[11px] text-content-faint">Sin sesiones para graficar.</div>;

  const segments = top
    .reduce<{ items: string[]; offset: number }>(
      (state, row, index) => {
        const share = (row.sessions / total) * 100;
        return {
          items: [...state.items, `${CHART_COLORS[index % CHART_COLORS.length]} ${state.offset}% ${state.offset + share}%`],
          offset: state.offset + share,
        };
      },
      { items: [], offset: 0 },
    )
    .items.join(", ");

  return (
    <div className="space-y-3">
      <div className="mx-auto grid size-[150px] place-items-center rounded-full" style={{ background: `conic-gradient(${segments})` }}>
        <div className="grid size-[104px] place-items-center rounded-full bg-surface-1 text-center">
          <div>
            <p className="font-mono text-[18px] font-semibold tabular-nums text-content">{integer.format(total)}</p>
            <p className="text-[9.5px] uppercase tracking-[0.07em] text-content-faint">sesiones</p>
          </div>
        </div>
      </div>
      <ul className="space-y-1">
        {top.map((row, index) => (
          <li key={row.name} className="flex items-center gap-2 text-[10.5px]">
            <span className="size-2 shrink-0 rounded-sm" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-content-muted" title={row.name}>
              {row.name || "(not set)"}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-content-faint">{((row.sessions / total) * 100).toFixed(1).replace(".", ",")}%</span>
          </li>
        ))}
      </ul>
      <p className="text-center text-[9.5px] text-content-faint">
        Top 5 suma {integer.format(total)} {totalSessions != null ? `de ${integer.format(totalSessions)} sesiones` : "sesiones"}
      </p>
    </div>
  );
}
