"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Download, FileSearch, Link2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { useDashboardFilters } from "@/components/filter-context";
import type { ContentData, ContentQuery } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataGrid, type GridColumn } from "@/components/ui/data-grid";
import { FilterPill } from "@/components/ui/filter-pill";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

type Payload = { status: string; data?: ContentData; error?: string; generatedAt?: string };

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number) => percent.format(value).replace(/\s/g, "");

const formatDay = (value: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed).replace(" de ", " ");
};

const pathOf = (value: string) => {
  if (!value) return "Sin URL";
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
};

const statusLabel = (value: string) => (value === "live" ? "Conectada" : value === "no_data" ? "Sin datos" : "No disponible");
const statusTone = (value: string): "positive" | "caution" | "neutral" => (value === "live" ? "positive" : value === "no_data" ? "caution" : "neutral");

const COLUMNS: Array<GridColumn<ContentQuery>> = [
  {
    key: "query",
    label: "Consulta",
    value: (row) => row.query,
    filter: { type: "text" },
    render: (row) => (
      <span className="block max-w-[240px] truncate font-medium text-content" title={row.query}>
        {row.query}
      </span>
    ),
  },
  {
    key: "page",
    label: "Página",
    value: (row) => row.page,
    filter: { type: "text" },
    hideBelow: "lg",
    render: (row) => (
      <span className="block max-w-[240px] truncate font-mono text-[10.5px] text-content-faint" title={row.page}>
        {pathOf(row.page)}
      </span>
    ),
  },
  { key: "position", label: "Pos.", value: (row) => row.position, align: "right", render: (row) => decimal.format(row.position) },
  { key: "clicks", label: "Clics", value: (row) => row.clicks, align: "right", render: (row) => integer.format(row.clicks) },
  { key: "impressions", label: "Impr.", value: (row) => row.impressions, align: "right", hideBelow: "sm", render: (row) => integer.format(row.impressions) },
  { key: "ctr", label: "CTR", value: (row) => row.ctr, align: "right", render: (row) => pct(row.ctr) },
];

export function ContentPanel() {
  const { filters, updateFilter, refresh, refreshKey } = useDashboardFilters();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [showAllCannibalization, setShowAllCannibalization] = useState(false);

  const params = useMemo(() => {
    const next = new URLSearchParams({ days: String(filters.days), language: filters.language, country: filters.country, device: filters.device });
    return next.toString();
  }, [filters.country, filters.days, filters.device, filters.language]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/content?${params}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: Payload) => setPayload(value))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPayload({ status: "error", error: "Contenido no pudo responder." });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [params, refreshKey]);

  const data = payload?.data;
  const available = Boolean(data);

  if (loading && !payload) {
    return (
      <div className="space-y-4">
        <div className="wm-skeleton h-16 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="wm-skeleton h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="wm-skeleton h-[260px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="wm-rise space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <FileSearch className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">Contenido</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Contenido que encuentra a las personas</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
            <span>
              {data?.period.start ? `${formatDay(data.period.start)} – ${formatDay(data.period.end)}` : "Período no disponible"}
            </span>
            {data ? (
              <>
                <Badge tone={statusTone(data.gscStatus)}>GSC · {statusLabel(data.gscStatus)}</Badge>
                <Badge tone={statusTone(data.ga4Status)}>GA4 · {statusLabel(data.ga4Status)}</Badge>
              </>
            ) : null}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Actualizar
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill label="Periodo" value={String(filters.days)} onChange={(value) => updateFilter("days", value)} options={[["7", "7 días"], ["28", "28 días"], ["30", "30 días"], ["60", "60 días"], ["90", "90 días"]]} />
        <FilterPill label="Idioma" value={filters.language} onChange={(value) => updateFilter("language", value)} options={[["all", "Todos"], ["es", "Español"], ["en", "Inglés"], ["pt", "Portugués"]]} />
        <FilterPill label="País" value={filters.country} onChange={(value) => updateFilter("country", value)} options={[["all", "Todos"], ["ES", "España"], ["MX", "México"], ["US", "EE. UU."], ["GB", "Reino Unido"], ["PT", "Portugal"], ["AR", "Argentina"]]} />
        <FilterPill label="Dispositivo" value={filters.device} onChange={(value) => updateFilter("device", value)} options={[["all", "Todos"], ["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]]} />
      </div>

      {!available ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
          <FileSearch className="size-6 text-content-faint" />
          <p className="mt-3 text-[13px] font-medium text-content">
            {payload?.status === "no_data" ? "Search Console no devolvió consultas" : "Contenido no está disponible"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-content-faint">
            {payload?.error ?? "Conectá Search Console y volvé a intentar. El análisis de contenido usa consultas y páginas reales."}
          </p>
          <Button variant="secondary" size="sm" onClick={refresh} className="mt-4 gap-1.5">
            <RefreshCw className="size-3.5" /> Reintentar
          </Button>
        </div>
      ) : (
        <>
          {data?.ga4Warning ? (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-[11px] text-caution">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">GA4</strong> {data.ga4Warning}
              </span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Consultas" value={integer.format(data?.queries.length ?? 0)} icon={<Search className="size-3.5" />} detail="Consultas reales del período" />
            <StatCard label="Oportunidades" value={integer.format(data?.opportunities.length ?? 0)} icon={<ArrowRight className="size-3.5" />} tone="accent" detail="Posición 4–15 · CTR bajo · ≥50 impresiones" />
            <StatCard label="Páginas con demanda" value={integer.format(data?.pages.length ?? 0)} icon={<FileSearch className="size-3.5" />} detail="Con clics o impresiones en GSC" />
            <StatCard label="Canibalizaciones" value={integer.format(data?.cannibalization.length ?? 0)} icon={<ShieldAlert className="size-3.5" />} tone={(data?.cannibalization.length ?? 0) > 0 ? "caution" : "positive"} detail="Misma consulta en varias URLs" />
          </div>

          <Section
            title={`Consultas más buscadas · ${integer.format(data?.queries.length ?? 0)}`}
            detail="Fuente: GSC. Búsqueda, filtros y ordenamiento sobre la respuesta real."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(data?.queries ?? [], null, 2)], { type: "application/json" });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = "content-queries.json";
                  link.click();
                  URL.revokeObjectURL(link.href);
                }}
                className="gap-1.5"
              >
                <Download className="size-3.5" /> Exportar
              </Button>
            }
          >
            <DataGrid
              rows={data?.queries ?? []}
              columns={COLUMNS}
              rowKey={(row, index) => `${row.query}-${row.page}-${index}`}
              label="consultas de contenido"
              searchPlaceholder="Buscar consulta o página"
              initialSort={{ key: "clicks", direction: "desc" }}
              minWidth={720}
            />
          </Section>

          <div className="grid items-start gap-3 xl:grid-cols-2">
            <Section title="Oportunidades de contenido" detail="Posición media 4–15, al menos 50 impresiones y CTR menor a 3%.">
              {(data?.opportunities.length ?? 0) > 0 ? (
                <ul className="space-y-1">
                  {data?.opportunities.slice(0, 10).map((row, index) => (
                    <li key={`${row.query}-${index}`} className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] font-medium text-content" title={row.query}>
                            {row.query}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-content-faint" title={row.page}>
                            {pathOf(row.page)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-[11px] tabular-nums text-content">pos. {decimal.format(row.position)}</span>
                          <span className="block font-mono text-[10px] tabular-nums text-content-faint">
                            {integer.format(row.impressions)} impr. · {pct(row.ctr)}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="No hay consultas reales que cumplan la regla." />
              )}
            </Section>

            <Section title="Contenidos con mayor demanda" detail="GSC por defecto; sesiones y engagement solo desde GA4.">
              {(data?.pages.length ?? 0) > 0 ? (
                <ul className="space-y-1">
                  {data?.pages.slice(0, 10).map((row) => (
                    <li key={row.page} className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-2">
                      <span className="block truncate font-mono text-[10.5px] text-content-muted" title={row.page}>
                        {pathOf(row.page)}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-content-faint">
                        <span className="font-mono tabular-nums text-content">{integer.format(row.clicks)} clics</span>
                        <span className="font-mono tabular-nums">{integer.format(row.impressions)} impr.</span>
                        <span className="font-mono tabular-nums">{row.sessions == null ? "sesiones: —" : `${integer.format(row.sessions)} sesiones`}</span>
                        <span className="font-mono tabular-nums">{row.engagementRate == null ? "engagement: —" : `engagement ${pct(row.engagementRate)}`}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="No hay páginas reales disponibles." />
              )}
            </Section>
          </div>

          <div className="grid items-start gap-3 xl:grid-cols-2">
            <Section title="Sugerencias relacionadas" detail="Cluster simple por términos compartidos; una URL solo se asocia cuando es única.">
              {(data?.related.length ?? 0) > 0 ? (
                <>
                  <ul className="space-y-1">
                    {(data?.related ?? []).slice(0, showAllRelated ? undefined : 8).map((row) => (
                      <li key={row.cluster} className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[11.5px] font-medium text-content">{row.cluster}</span>
                          <span className="shrink-0 font-mono text-[10px] text-content-faint">{row.queries.length} consultas</span>
                        </div>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-content-faint">
                          {row.queries.slice(0, 6).join(" · ")}
                          {row.queries.length > 6 ? ` · +${row.queries.length - 6} más` : ""}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-accent">{row.page ? pathOf(row.page) : "Sin URL asociada"}</p>
                      </li>
                    ))}
                  </ul>
                  {(data?.related.length ?? 0) > 8 ? (
                    <Button variant="ghost" size="sm" className="mt-1.5" onClick={() => setShowAllRelated((value) => !value)}>
                      {showAllRelated ? "Ver menos" : `Ver ${(data?.related.length ?? 0) - 8} más`}
                    </Button>
                  ) : null}
                </>
              ) : (
                <Empty text="No se puede inferir un cluster seguro con estas consultas." />
              )}
            </Section>

            <Section title="Señales de cobertura" detail="Separación explícita entre señal observada y recomendación.">
              <div className="space-y-1.5">
                <Signal icon={<FileSearch className="size-3.5" />} label="Consultas sin URL clara" value={data?.withoutPage.length ?? 0} hint="Requieren revisión de mapeo" />
                <Signal icon={<ShieldAlert className="size-3.5" />} label="Posibles canibalizaciones" value={data?.cannibalization.length ?? 0} hint="Requieren revisión editorial" />
                <p className="pt-1 text-[10px] leading-relaxed text-content-faint">
                  La señal de canibalización proviene de GSC cuando una misma consulta aparece con más de una página. Requiere revisión editorial antes de actuar.
                </p>
              </div>
            </Section>
          </div>

          <Section title="Posibles canibalizaciones" detail="Señal GSC: misma consulta asociada a varias páginas.">
            {(data?.cannibalization.length ?? 0) > 0 ? (
              <>
                <ul className="space-y-1">
                  {(data?.cannibalization ?? []).slice(0, showAllCannibalization ? undefined : 10).map((row) => (
                    <li key={row.query} className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11.5px] font-medium text-content">{row.query}</span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-content-faint">
                          {integer.format(row.clicks)} clics · {integer.format(row.impressions)} impr.
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-content-faint">{row.pages.map(pathOf).join(" · ")}</p>
                    </li>
                  ))}
                </ul>
                {(data?.cannibalization.length ?? 0) > 10 ? (
                  <Button variant="ghost" size="sm" className="mt-1.5" onClick={() => setShowAllCannibalization((value) => !value)}>
                    {showAllCannibalization ? "Ver menos" : `Ver ${(data?.cannibalization.length ?? 0) - 10} más`}
                  </Button>
                ) : null}
              </>
            ) : (
              <Empty text="GSC no muestra consultas con más de una página asociada." />
            )}
          </Section>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/search-console" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5")}>
              <Search className="size-3.5" /> Ver Search Console
            </Link>
            <Link href="/keywords" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}>
              <Link2 className="size-3.5" /> Ver Keywords
            </Link>
            <span className="ml-auto text-[10px] text-content-faint">
              Fuente: GSC{data?.ga4Status === "live" ? " + GA4" : ""} · sin caché
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Signal({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface-2/40 px-2.5 py-2">
      <span className="text-content-faint">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-content-muted">{label}</span>
        <span className="block text-[9.5px] text-content-faint">{hint}</span>
      </span>
      <span className="font-mono text-[13px] font-semibold tabular-nums text-content">{integer.format(value)}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="grid place-items-center rounded-lg border border-dashed border-edge/70 px-4 py-8 text-center text-[11px] text-content-faint">{text}</div>;
}
