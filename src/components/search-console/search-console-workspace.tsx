"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Maximize2, Minimize2, RefreshCw, Search as SearchIcon } from "lucide-react";
import type { IntegrationResponse, SearchConsoleWorkspaceData, SearchConsoleWorkspaceTab } from "@/lib/integrations";
import { useDashboardFilters } from "@/components/filter-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataGrid, type GridColumn } from "@/components/ui/data-grid";
import { FilterPill } from "@/components/ui/filter-pill";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { LazyTrendChart } from "@/components/charts/lazy";
import { cn } from "@/lib/utils";

const TABS: Array<[SearchConsoleWorkspaceTab, string]> = [
  ["performance", "Performance"],
  ["queries", "Queries"],
  ["geographic", "Geographic"],
  ["device", "Device"],
  ["site-url", "Site URL"],
];

type Row = SearchConsoleWorkspaceData["rows"][number];

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number) => percent.format(value).replace(/\s/g, "");

const formatDay = (value: string) => {
  if (!value) return "—";
  const iso = /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }).format(parsed).replace(" de ", " ");
};

const pathOf = (value: string) => {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
};

const delta = (current: number | null | undefined, previous: number | null | undefined) =>
  current == null || previous == null || previous === 0 ? null : (current - previous) / Math.abs(previous);

const EMPTY: SearchConsoleWorkspaceData = {
  tab: "performance",
  period: { start: "", end: "", previousStart: "", previousEnd: "" },
  metrics: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
  previous: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
  rows: [],
};

export function SearchConsoleLive() {
  const { filters, updateFilter, refresh, refreshKey } = useDashboardFilters();
  const [tab, setTab] = useState<SearchConsoleWorkspaceTab>("performance");
  const [fullscreen, setFullscreen] = useState(false);
  const [payload, setPayload] = useState<IntegrationResponse<SearchConsoleWorkspaceData> | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");

  const params = useMemo(() => {
    const next = new URLSearchParams({ days: String(filters.days), language: filters.language, country: filters.country, device: filters.device, tab });
    if (filters.page) next.set("page", filters.page);
    if (filters.query) next.set("query", filters.query);
    return next.toString();
  }, [filters.country, filters.days, filters.device, filters.language, filters.page, filters.query, tab]);
  const url = `/api/integrations/search-console?${params}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: IntegrationResponse<SearchConsoleWorkspaceData>) => {
        setPayload(value);
        setLoadedUrl(url);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPayload({ status: "unavailable", data: { ...EMPTY, tab }, error: "No se pudo conectar con Search Console.", generatedAt: "" });
        setLoadedUrl(url);
      });
    return () => controller.abort();
  }, [url, refreshKey, tab]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const response = payload ?? { status: "unavailable" as const, data: { ...EMPTY, tab }, error: "Consultando Search Console.", generatedAt: "" };
  const data = response.data;
  const live = response.status === "live";
  const loading = loadedUrl !== url;
  const period = data.period.start ? `${formatDay(data.period.start)} – ${formatDay(data.period.end)}` : "Período no disponible";

  const columns = useMemo(() => buildColumns(tab, data.rows), [tab, data.rows]);
  const chartData = useMemo(() => (tab === "performance" ? data.rows.map((row) => ({ date: row.dimension, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })) : []), [data.rows, tab]);

  return (
    <div className={cn("wm-rise space-y-3", fullscreen && "fixed inset-0 z-40 overflow-y-auto bg-surface-0 p-4 sm:p-6")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <SearchIcon className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">Search Console</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Rendimiento de búsqueda orgánica</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-content-faint" /> {period}
            </span>
            <Badge tone={live ? "positive" : response.status === "no_data" ? "caution" : "negative"}>
              {live ? "Live GSC" : response.status === "no_data" ? "Sin datos" : "No disponible"}
            </Badge>
            {data.rows.length ? <span className="text-content-faint">{integer.format(data.rows.length)} filas</span> : null}
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
        <FilterPill label="Idioma" value={filters.language} onChange={(value) => updateFilter("language", value)} options={[["all", "Todos"], ["es", "Español"], ["en", "Inglés"], ["pt", "Portugués"]]} />
        <FilterPill label="País" value={filters.country} onChange={(value) => updateFilter("country", value)} options={[["all", "Todos"], ["ES", "España"], ["MX", "México"], ["US", "EE. UU."], ["GB", "Reino Unido"], ["PT", "Portugal"], ["AR", "Argentina"]]} />
        <FilterPill label="Dispositivo" value={filters.device} onChange={(value) => updateFilter("device", value)} options={[["all", "Todos"], ["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]]} />
        <form
          className="inline-flex h-7 items-center gap-1 rounded-md border border-edge bg-surface-1 pl-2 pr-1"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem("page") as HTMLInputElement | null;
            updateFilter("page", input?.value.trim() ?? "");
          }}
        >
          <span className="text-[11px] text-content-faint">Directorio</span>
          <input
            name="page"
            key={filters.page ?? "empty"}
            defaultValue={filters.page ?? ""}
            onBlur={(event) => updateFilter("page", event.currentTarget.value.trim())}
            placeholder="/recursos"
            aria-label="Directorio o URL"
            className="wm-focus-ring h-6 w-28 rounded bg-transparent px-1 font-mono text-[10.5px] text-content placeholder:text-content-faint outline-none"
          />
        </form>
        {filters.page ? (
          <button type="button" onClick={() => updateFilter("page", "")} className="wm-focus-ring rounded px-1.5 py-1 text-[10px] text-content-faint hover:text-content">
            Limpiar
          </button>
        ) : null}
      </div>

      {!live ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
          <SearchIcon className="size-6 text-content-faint" />
          <p className="mt-3 text-[13px] font-medium text-content">
            {response.status === "no_data" ? "Sin filas para el período" : "Search Console no está disponible"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-content-faint">
            {response.error ?? "La fuente no devolvió datos para los filtros seleccionados."}
          </p>
          <Button variant="secondary" size="sm" onClick={refresh} className="mt-4 gap-1.5">
            <RefreshCw className="size-3.5" /> Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Clics" value={integer.format(data.metrics.clicks)} delta={delta(data.metrics.clicks, data.previous.clicks)} />
            <StatCard label="Impresiones" value={integer.format(data.metrics.impressions)} delta={delta(data.metrics.impressions, data.previous.impressions)} />
            <StatCard label="CTR medio" value={pct(data.metrics.ctr)} delta={delta(data.metrics.ctr, data.previous.ctr)} />
            <StatCard label="Posición media" value={data.metrics.position ? decimal.format(data.metrics.position) : "—"} delta={delta(data.metrics.position, data.previous.position)} lowerIsBetter />
          </div>

          <div aria-label="Vistas de Search Console" className="wm-scroll-x flex w-full gap-1 overflow-x-auto rounded-lg border border-edge bg-surface-1 p-1">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={cn(
                  "wm-focus-ring shrink-0 rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors",
                  tab === key ? "bg-surface-3 text-content shadow-sm" : "text-content-muted hover:text-content",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "performance" ? (
            <Section title="Evolución diaria" detail="Clics (área) e impresiones (línea punteada) del período.">
              {chartData.length ? <LazyTrendChart data={chartData} /> : <p className="px-1 py-8 text-center text-[11px] text-content-faint">Sin serie diaria para estos filtros.</p>}
            </Section>
          ) : null}

          {tab === "device" ? <DeviceSummary rows={data.rows} /> : null}

          <Section
            title={tabTitle(tab)}
            detail={tabDetail(tab)}
            action={loading ? <span className="text-[10px] text-content-faint">Actualizando…</span> : null}
          >
            <DataGrid
              rows={data.rows}
              columns={columns}
              rowKey={(row, index) => `${row.dimension}||${row.page ?? ""}||${index}`}
              label={`Search Console · ${tabTitle(tab)}`}
              searchPlaceholder="Buscar"
              initialSort={{ key: "clicks", direction: "desc" }}
              minWidth={tab === "queries" || tab === "site-url" ? 760 : 560}
              empty="Sin filas para el período y los filtros seleccionados."
            />
          </Section>

          <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-content-faint">
            <p>Fuente: Google Search Console API (live, sin caché).</p>
            {response.generatedAt ? <p>{new Date(response.generatedAt).toLocaleString("es-ES")}</p> : null}
          </footer>
        </>
      )}
    </div>
  );
}

function tabTitle(tab: SearchConsoleWorkspaceTab) {
  return tab === "performance" ? "Detalle por día" : tab === "queries" ? "Consultas y páginas" : tab === "geographic" ? "Países" : tab === "device" ? "Dispositivos" : "Páginas";
}

function tabDetail(tab: SearchConsoleWorkspaceTab) {
  return tab === "queries"
    ? "Consulta + página que posiciona. Máximo 25.000 filas desde GSC."
    : tab === "geographic"
      ? "Códigos de país según Search Console."
      : tab === "device"
        ? "Mobile, desktop y tablet."
        : tab === "site-url"
          ? "URLs con impresiones o clics en el período."
          : "Métricas diarias agregadas.";
}

function buildColumns(tab: SearchConsoleWorkspaceTab, rows: Row[]): Array<GridColumn<Row>> {
  const maxClicks = Math.max(1, ...rows.map((row) => row.clicks));
  const maxImpressions = Math.max(1, ...rows.map((row) => row.impressions));
  const first: GridColumn<Row> =
    tab === "performance"
      ? { key: "dimension", label: "Fecha", value: (row) => row.dimension, render: (row) => <span className="text-content">{formatDay(row.dimension)}</span> }
      : tab === "queries"
        ? { key: "dimension", label: "Consulta", value: (row) => row.dimension, filter: { type: "text" }, render: (row) => <span className="block max-w-[260px] truncate font-medium text-content" title={row.dimension}>{row.dimension}</span> }
        : tab === "geographic"
          ? { key: "dimension", label: "País", value: (row) => row.dimension, filter: { type: "text" }, render: (row) => <span className="font-mono uppercase text-content">{row.dimension}</span> }
          : tab === "device"
            ? { key: "dimension", label: "Dispositivo", value: (row) => row.dimension, render: (row) => <span className="capitalize text-content">{row.dimension.toLowerCase()}</span> }
            : { key: "dimension", label: "Página", value: (row) => row.dimension, filter: { type: "text" }, render: (row) => <span className="block max-w-[320px] truncate font-mono text-[10.5px] text-content" title={row.dimension}>{pathOf(row.dimension)}</span> };

  const columns: Array<GridColumn<Row>> = [first];

  if (tab === "queries") {
    columns.push({
      key: "page",
      label: "Página",
      value: (row) => row.page ?? "",
      filter: { type: "text" },
      hideBelow: "lg",
      render: (row) => <span className="block max-w-[240px] truncate font-mono text-[10.5px] text-content-faint" title={row.page}>{row.page ? pathOf(row.page) : "—"}</span>,
    });
  }

  columns.push(
    { key: "clicks", label: "Clics", value: (row) => row.clicks, align: "right", render: (row) => <Heat value={integer.format(row.clicks)} ratio={row.clicks / maxClicks} /> },
    { key: "impressions", label: "Impresiones", value: (row) => row.impressions, align: "right", hideBelow: "sm", render: (row) => <Heat value={integer.format(row.impressions)} ratio={row.impressions / maxImpressions} tone="muted" /> },
    { key: "ctr", label: "CTR", value: (row) => row.ctr, align: "right", render: (row) => <span className="font-mono tabular-nums text-content-muted">{pct(row.ctr)}</span> },
    { key: "position", label: "Posición", value: (row) => row.position, align: "right", render: (row) => <span className="font-mono tabular-nums text-content-muted">{decimal.format(row.position)}</span> },
  );
  return columns;
}

function Heat({ value, ratio, tone = "accent" }: { value: string; ratio: number; tone?: "accent" | "muted" }) {
  const width = Math.max(0, Math.min(100, ratio * 100));
  return (
    <span className="relative flex items-center justify-end">
      <span className={cn("absolute inset-y-0 right-0 rounded-sm", tone === "accent" ? "bg-accent/15" : "bg-content-faint/10")} style={{ width: `${width}%` }} aria-hidden />
      <span className="relative font-mono tabular-nums text-content">{value}</span>
    </span>
  );
}

function DeviceSummary({ rows }: { rows: Row[] }) {
  const total = Math.max(1, rows.reduce((sum, row) => sum + row.clicks, 0));
  const order = ["mobile", "desktop", "tablet"];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.dimension.toLowerCase()) - order.indexOf(b.dimension.toLowerCase()));
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {sorted.map((row) => {
        const share = row.clicks / total;
        return (
          <article key={row.dimension} className="rounded-xl border border-edge bg-surface-1 p-3.5">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-content-muted">{row.dimension.toLowerCase()}</p>
            <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-content">{integer.format(row.clicks)}</p>
            <p className="text-[10px] text-content-faint">clics · {(share * 100).toFixed(1).replace(".", ",")}% del total</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-4/70">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, share * 100)}%` }} />
            </div>
            <p className="mt-2 text-[10.5px] text-content-faint">
              {integer.format(row.impressions)} impresiones · CTR {pct(row.ctr)}
            </p>
          </article>
        );
      })}
    </div>
  );
}

