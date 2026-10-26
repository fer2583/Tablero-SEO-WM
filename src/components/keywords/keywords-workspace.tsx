"use client";

import { useEffect, useMemo, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { ArrowUpRight, CalendarDays, RefreshCw, Search, Target } from "lucide-react";
import type { IntegrationFilters, IntegrationResponse } from "@/lib/integrations";
import type { CannibalizationRow, KeywordRow, KeywordsData } from "@/lib/keywords";
import { useDashboardFilters } from "@/components/filter-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LazyOpportunityChart, LazyPositionChart, LazyTrendChart } from "@/components/charts/lazy";
import { KpiCard } from "./kpi-card";
import { KeywordGrid } from "./keyword-grid";
import { KeywordSheet } from "./keyword-sheet";
import { cn } from "@/lib/utils";

const EMPTY: KeywordsData = {
  period: { start: "", end: "", previousStart: "", previousEnd: "" },
  totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
  previous: null,
  daily: [],
  rows: [],
  winners: [],
  losers: [],
  opportunities: [],
  cannibalization: [],
  truncated: false,
};

function normalize(value: Partial<KeywordsData> | undefined): KeywordsData {
  const rows = value?.rows ?? [];
  const clicks = rows.reduce((total, row) => total + row.clicks, 0);
  const impressions = rows.reduce((total, row) => total + row.impressions, 0);
  const weighted = rows.reduce((total, row) => total + row.position * row.impressions, 0);
  const cannibalization = (value?.cannibalization ?? []).map((entry) => {
    const matches = rows.filter((row) => row.query === entry.query);
    const entryClicks = Number.isFinite(entry.clicks) ? entry.clicks : matches.reduce((total, row) => total + row.clicks, 0);
    const entryImpressions = Number.isFinite(entry.impressions) ? entry.impressions : matches.reduce((total, row) => total + row.impressions, 0);
    const topClicks = Math.max(0, ...matches.map((row) => row.clicks));
    return {
      query: entry.query,
      pages: entry.pages ?? [],
      clicks: entryClicks,
      impressions: entryImpressions,
      share: Number.isFinite(entry.share) ? entry.share : entryClicks ? Math.round((topClicks / entryClicks) * 100) : 0,
    };
  });
  return {
    ...EMPTY,
    ...value,
    totals: value?.totals ?? { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? weighted / impressions : 0 },
    rows,
    winners: value?.winners ?? [],
    losers: value?.losers ?? [],
    opportunities: value?.opportunities ?? [],
    cannibalization,
    daily: value?.daily ?? [],
    previous: value?.previous ?? null,
    truncated: value?.truncated ?? false,
  };
}

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number) => percent.format(value).replace(/\s/g, "");

const formatDay = (value: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed).replace(" de ", " ");
};

const VIEWS = [
  { key: "all", label: "Todas" },
  { key: "opportunities", label: "Oportunidades" },
  { key: "winners", label: "Ganadoras" },
  { key: "losers", label: "Perdedoras" },
  { key: "brand", label: "Marca" },
  { key: "non-brand", label: "No marca" },
  { key: "cannibalization", label: "Canibalización" },
] as const;

function useKeywordsData(filters: ReturnType<typeof useDashboardFilters>["filters"], refreshKey: number) {
  const params = new URLSearchParams({ days: String(filters.days), language: filters.language, country: filters.country, device: filters.device });
  if (filters.page) params.set("page", filters.page);
  if (filters.query) params.set("query", filters.query);
  const url = `/api/gsc/keywords?${params.toString()}`;

  const [response, setResponse] = useState<IntegrationResponse<KeywordsData> | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((result) => result.json())
      .then((value: IntegrationResponse<KeywordsData>) => {
        setResponse({ ...value, data: normalize(value.data) });
        setLoadedUrl(url);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResponse({ status: "unavailable", data: EMPTY, error: "No se pudo conectar con Search Console.", generatedAt: "" });
        setLoadedUrl(url);
      });
    return () => controller.abort();
  }, [url, refreshKey]);

  return {
    response: response ?? { status: "unavailable" as const, data: EMPTY, error: "Consultando Search Console.", generatedAt: "" },
    loading: loadedUrl !== url,
  };
}

function Section({ title, detail, action, children }: { title: string; detail?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-edge bg-surface-1">
      <header className="flex items-start justify-between gap-3 border-b border-edge/70 px-3.5 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[12.5px] font-semibold text-content">{title}</h2>
          {detail ? <p className="mt-0.5 text-[10.5px] text-content-faint">{detail}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="wm-skeleton h-14 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="wm-skeleton h-[112px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="wm-skeleton h-[300px] rounded-xl xl:col-span-2" />
        <div className="wm-skeleton h-[300px] rounded-xl" />
      </div>
    </div>
  );
}

export function KeywordsWorkspace() {
  const { filters, density, refresh, refreshKey, updateFilter } = useDashboardFilters();
  const { response, loading } = useKeywordsData(filters, refreshKey);
  const [view, setView] = useQueryState("kw", parseAsString.withDefault("all"));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<KeywordRow | null>(null);

  const data = response.data;
  const live = response.status === "live";

  const viewRows = useMemo<KeywordRow[]>(() => {
    const base =
      view === "opportunities" ? data.opportunities
      : view === "winners" ? data.winners
      : view === "losers" ? data.losers
      : view === "brand" ? data.rows.filter((row) => row.brand === "brand")
      : view === "non-brand" ? data.rows.filter((row) => row.brand === "non_brand")
      : data.rows;
    const needle = search.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((row) => row.query.toLowerCase().includes(needle) || row.page.toLowerCase().includes(needle));
  }, [view, search, data]);

  const counts: Record<string, number> = {
    all: data.rows.length,
    opportunities: data.opportunities.length,
    winners: data.winners.length,
    losers: data.losers.length,
    brand: data.rows.filter((row) => row.brand === "brand").length,
    "non-brand": data.rows.filter((row) => row.brand === "non_brand").length,
    cannibalization: data.cannibalization.length,
  };

  if (loading) return <Skeleton />;

  if (!live) {
    return (
      <div className="space-y-4">
      <PageHeader response={response} onRefresh={refresh} />
      <FilterRow filters={filters} updateFilter={updateFilter} />

        <div className="rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
          <Target className="mx-auto size-6 text-content-faint" />
          <p className="mt-3 text-[13px] font-medium text-content">
            {response.status === "no_data" ? "Search Console no devolvió consultas" : "Search Console no está disponible"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-content-faint">
            {response.error ?? "La fuente no está conectada o no devolvió datos para el período seleccionado."}
          </p>
          <Button variant="secondary" size="sm" onClick={refresh} className="mt-4 gap-1.5">
            <RefreshCw className="size-3.5" /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="wm-rise space-y-4">
      <PageHeader response={response} onRefresh={refresh} />
      <FilterRow filters={filters} updateFilter={updateFilter} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Clics orgánicos" value={data.totals.clicks} previous={data.previous?.clicks ?? null} daily={data.daily} dataKey="clicks" />
        <KpiCard label="Impresiones" value={data.totals.impressions} previous={data.previous?.impressions ?? null} daily={data.daily} dataKey="impressions" color="var(--wm-chart-5)" />
        <KpiCard
          label="CTR medio"
          value={data.totals.ctr * 100}
          format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          suffix="%"
          previous={data.previous ? data.previous.ctr * 100 : null}
          daily={data.daily}
          dataKey="impressions"
          color="var(--wm-chart-2)"
        />
        <KpiCard
          label="Posición media"
          value={data.totals.position}
          format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
          previous={data.previous?.position ?? null}
          deltaMode="points"
          lowerIsBetter
          daily={data.daily}
          dataKey="position"
          color="var(--wm-chart-6)"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section title="Evolución diaria" detail="Clics (área) e impresiones (línea punteada) del período.">
            <LazyTrendChart data={data.daily} />
          </Section>
        </div>
        <Section title="Distribución de posiciones" detail="Cuántas consultas hay en cada tramo.">
          <LazyPositionChart rows={data.rows} />
        </Section>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section
            title="Mapa de oportunidades"
            detail="Posición vs. impresiones. Tamaño = clics. Azul = no marca, verde = marca. Zona sombreada: 3–15."
            action={
              <span className="hidden items-center gap-3 text-[10px] text-content-faint sm:flex">
                <span className="flex items-center gap-1"><i className="size-1.5 rounded-full bg-accent/70" /> No marca</span>
                <span className="flex items-center gap-1"><i className="size-1.5 rounded-full bg-chart-2" /> Marca</span>
              </span>
            }
          >
            <LazyOpportunityChart rows={data.rows} />
          </Section>
        </div>
        <Section
          title="Top oportunidades"
          detail="Mayor potencial de clics recuperables."
          action={
            <Button variant="ghost" size="sm" onClick={() => setView("opportunities")} className="gap-1 text-[11px]">
              Ver todas <ArrowUpRight className="size-3" />
            </Button>
          }
        >
          <OpportunityList rows={data.opportunities.slice(0, 5)} onSelect={setSelected} />
        </Section>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div aria-label="Vistas de Keywords" className="flex flex-wrap items-center gap-1 rounded-lg border border-edge bg-surface-1 p-1">
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              aria-pressed={view === item.key}
              className={cn(
                "wm-focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors",
                view === item.key ? "bg-surface-3 text-content shadow-sm" : "text-content-muted hover:text-content",
              )}
            >
              {item.label}
              <span className={cn("tnum text-[10px]", view === item.key ? "text-content-faint" : "text-content-faint/70")}>{integer.format(counts[item.key] ?? 0)}</span>
            </button>
          ))}
        </div>

        <label className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-content-faint" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar consulta o URL"
            aria-label="Buscar consulta o URL"
            className="wm-focus-ring h-8 w-full rounded-lg border border-edge bg-surface-1 pl-8 pr-3 text-[11.5px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none"
          />
        </label>
      </div>

      {view === "cannibalization" ? (
        <CannibalizationTable rows={data.cannibalization} onSelect={setSelected} />
      ) : (
        <KeywordGrid rows={viewRows} density={density} onSelect={setSelected} />
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-content-faint">
        <p>
          Fuente: Google Search Console API (live, sin caché) · {data.rows.length} filas ·{" "}
          {response.generatedAt ? new Date(response.generatedAt).toLocaleString("es-ES") : "—"}
        </p>
        {data.truncated ? <p className="text-caution">Se alcanzó el límite de 1.000 filas de GSC: los totales pueden estar incompletos.</p> : null}
      </footer>

      <KeywordSheet row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PageHeader({ response, onRefresh }: { response: IntegrationResponse<KeywordsData>; onRefresh: () => void }) {
  const { period } = response.data;
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
            <Target className="size-3.5" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">Keywords</p>
        </div>
        <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">El lenguaje de tu audiencia</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-content-faint" />
            {period.start ? `${formatDay(period.start)} – ${formatDay(period.end)}` : "Período no disponible"}
          </span>
          <Badge tone={response.status === "live" ? "positive" : "caution"}>{response.status === "live" ? "Live GSC" : "Sin datos"}</Badge>
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRefresh} className="gap-1.5">
        <RefreshCw className="size-3.5" /> Actualizar
      </Button>
    </header>
  );
}

function FilterRow({ filters, updateFilter }: { filters: IntegrationFilters; updateFilter: (key: keyof IntegrationFilters, value: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterPill label="Periodo" value={String(filters.days)} onChange={(value) => updateFilter("days", value)} options={[["7", "7 días"], ["28", "28 días"], ["30", "30 días"], ["60", "60 días"], ["90", "90 días"]]} />
      <FilterPill label="Idioma" value={filters.language} onChange={(value) => updateFilter("language", value)} options={[["all", "Todos"], ["es", "Español"], ["en", "Inglés"], ["pt", "Portugués"]]} />
      <FilterPill label="País" value={filters.country} onChange={(value) => updateFilter("country", value)} options={[["all", "Todos"], ["ES", "España"], ["MX", "México"], ["US", "EE. UU."], ["GB", "Reino Unido"], ["PT", "Portugal"], ["AR", "Argentina"]]} />
      <FilterPill label="Dispositivo" value={filters.device} onChange={(value) => updateFilter("device", value)} options={[["all", "Todos"], ["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]]} />
      {filters.page || filters.query ? (
        <button
          type="button"
          onClick={() => {
            if (filters.page) updateFilter("page", "");
            if (filters.query) updateFilter("query", "");
          }}
          className="wm-focus-ring rounded-md px-2 py-1 text-[10.5px] text-content-faint underline-offset-2 hover:text-content hover:underline"
        >
          Limpiar página/query
        </button>
      ) : null}
    </div>
  );
}

function FilterPill({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <label className="relative inline-flex h-7 items-center gap-1.5 rounded-md border border-edge bg-surface-1 pl-2 pr-1 text-[11px] text-content-muted transition-colors hover:border-edge-strong focus-within:border-accent/60">
      <span className="text-content-faint">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="wm-focus-ring cursor-pointer appearance-none bg-transparent py-0.5 pr-1 text-[11px] font-medium text-content outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue} className="bg-surface-1 text-content">
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function OpportunityList({ rows, onSelect }: { rows: KeywordRow[]; onSelect: (row: KeywordRow) => void }) {
  if (!rows.length) return <p className="px-1 py-6 text-center text-[11px] text-content-faint">Sin oportunidades por encima del umbral mínimo.</p>;
  return (
    <ul className="space-y-1">
      {rows.map((row, index) => (
        <li key={`${row.query}||${row.page}||${index}`}>
          <button
            type="button"
            onClick={() => onSelect(row)}
            className="wm-focus-ring group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 text-[11.5px] font-medium text-content">{row.query}</span>
              <span className="tnum mt-0.5 block font-mono text-[10px] text-content-faint">
                pos. {decimal.format(row.position)} · {integer.format(row.impressions)} impr.
              </span>
            </span>
            <span className="shrink-0 rounded-md border border-positive/25 bg-positive/10 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-positive">
              +{integer.format(row.potentialClicks ?? 0)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CannibalizationTable({ rows, onSelect }: { rows: CannibalizationRow[]; onSelect: (row: KeywordRow) => void }) {
  if (!rows.length) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-edge/70 px-6 py-14 text-center">
        <p className="text-[12.5px] font-medium text-content">Sin canibalización detectada</p>
        <p className="mt-1 max-w-sm text-[11.5px] text-content-faint">Ninguna consulta del período posiciona con más de una URL.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface-1">
      <div className="wm-scroll-x overflow-x-auto">
        <table className="w-full min-w-[560px]! border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-edge bg-surface-2/50 text-[10px] uppercase tracking-[0.09em] text-content-faint">
              <th className="px-3 py-2 font-semibold">Consulta</th>
              <th className="px-3 py-2 text-right font-semibold">URLs</th>
              <th className="px-3 py-2 text-right font-semibold">Clics</th>
              <th className="px-3 py-2 text-right font-semibold">Impr.</th>
              <th className="px-3 py-2 text-right font-semibold">Peso top URL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.query}
                className="wm-row cursor-pointer border-b border-edge/60 last:border-0"
                onClick={() => onSelect({ query: row.query, page: row.pages[0] ?? "", clicks: row.clicks, impressions: row.impressions, ctr: row.impressions ? row.clicks / row.impressions : 0, position: 0, positionLabel: "Media GSC", keywordTarget: null, intent: "unknown", cluster: "unassigned", status: "unmapped", brand: "non_brand", previousClicks: null, previousPosition: null, clickDelta: null, positionDelta: null, expectedCtr: null, potentialClicks: null, opportunityScore: null })}
              >
                <td className="px-3 py-2.5 font-medium text-content">{row.query}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  <span className="text-caution">{row.pages.length}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-content">{integer.format(row.clicks)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-content-muted">{integer.format(row.impressions)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-content-muted">{pct(row.share / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-edge bg-surface-2/30 px-3 py-2 text-[10px] text-content-faint">
        Una consulta con varias URLs compite consigo misma. Peso = clics de la URL principal sobre el total.
      </p>
    </div>
  );
}
