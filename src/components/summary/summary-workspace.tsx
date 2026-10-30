"use client";

import Link from "next/link";
import { Activity, ArrowRight, BarChart3, CircleAlert, Gauge, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { MiniSpark } from "@/components/charts/mini-spark";
import { TrendChart } from "@/components/charts/trend-chart";
import { useDashboardFilters } from "@/components/filter-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { scoreTone } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

type Totals = { clicks: number; impressions: number; ctr: number; position: number };
type AnalyticsTotals = { sessions: number; engagedSessions: number; conversions: number; engagementRate: number; aiSessions: number };
type QueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  previousClicks: number;
  previousPosition: number | null;
  clickDelta: number;
  positionDelta: number | null;
  brand: "brand" | "non_brand";
};
type Attention = { id: number; severity: string; title: string; message: string; href: string; source: string; detectedAt: string };

type SummaryData = {
  period: { start: string; end: string; compareStart: string; compareEnd: string; compare: "previous" | "year"; label: string };
  searchConsole: {
    current: Totals;
    previous: Totals;
    series: Array<{ date: string; clicks: number; impressions: number }>;
    brand: { brand: { clicks: number; impressions: number }; nonBrand: { clicks: number; impressions: number } };
    reach: { top3: number; top10: number; top20: number; top30: number; total: number; noPosition: number };
  } | null;
  analytics: {
    current: AnalyticsTotals;
    previous: AnalyticsTotals;
    series: Array<{ date: string; sessions: number; conversions: number }>;
    aiSeries: Array<{ date: string; sessions: number }>;
  } | null;
  keywords: { winners: QueryRow[]; losers: QueryRow[]; status: string };
  overview: { healthScore: number | null; keywordsTop10: number; issues: number; monthlyActions: number | null };
  rankingRows: QueryRow[];
  attention: Attention[];
  audit: { score: number | null; issues: number; severity: Array<{ severity: string; count: number }>; lastAudit: string | null; vitals: { status: string; metrics: Record<string, number | null> } | null };
  indexation: { inspected?: number | null; indexed?: number | null; problemUrls?: string[] } | null;
  sources: Record<string, string>;
  segmentsApplied: boolean;
};

type Payload = { status: string; error?: string; data?: SummaryData; metadata?: { snapshotAt?: Record<string, string | null> } };

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (value: number) => percent.format(value).replace(/\s/g, "");
const day = (value?: string | null) => (value ? new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const delta = (current: number | null | undefined, previous: number | null | undefined) =>
  current == null || previous == null || previous === 0 ? null : (current - previous) / Math.abs(previous);

const EMPTY: SummaryData = {
  period: { start: "", end: "", compareStart: "", compareEnd: "", compare: "previous", label: "vs. período anterior" },
  searchConsole: null,
  analytics: null,
  keywords: { winners: [], losers: [], status: "unavailable" },
  overview: { healthScore: null, keywordsTop10: 0, issues: 0, monthlyActions: null },
  rankingRows: [],
  attention: [],
  audit: { score: null, issues: 0, severity: [], lastAudit: null, vitals: null },
  indexation: null,
  sources: {},
  segmentsApplied: false,
};

function severityOf(data: SummaryData, label: string) {
  return data.audit.severity.find((item) => item.severity.toLowerCase() === label.toLowerCase())?.count ?? 0;
}

export function SummaryPanel() {
  const { filters, updateFilter, refreshKey } = useDashboardFilters();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ days: String(filters.days), compare: filters.compare });
    fetch(`/api/summary?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: Payload) => setPayload(value))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPayload({ status: "unavailable", error: "No se pudo consultar el Resumen." });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey, filters.days, filters.compare]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/ingest?sources=gsc,ga4&refresh=1", { method: "POST" });
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  };

  const data = payload?.data ?? EMPTY;
  const response: Payload = payload ?? { status: "unavailable" };
  const gsc = data.searchConsole;
  const ga = data.analytics;
  const updated = Object.values(response.metadata?.snapshotAt ?? {})
    .filter((item): item is string => Boolean(item))
    .sort()
    .at(-1);
  const indexed = data.indexation?.inspected;
  const aiShare = ga && ga.current.sessions > 0 ? ga.current.aiSessions / ga.current.sessions : null;

  if (loading && !payload) {
    return (
      <div className="space-y-4">
        <div className="wm-skeleton h-16 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="wm-skeleton h-[128px] rounded-xl" />
          ))}
        </div>
        <div className="grid items-start gap-3 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="wm-skeleton h-[220px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="wm-rise space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <Gauge className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">SEO Overview</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Resumen</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
            <span>{day(data.period.start)} – {day(data.period.end)}</span>
            <span className="text-content-faint">·</span>
            <span className="text-content-faint">{data.period.label}: {day(data.period.compareStart)} – {day(data.period.compareEnd)}</span>
            <Badge tone={response.status === "live" ? "positive" : response.status === "partial" ? "caution" : "negative"}>
              {response.status === "live" ? "Datos completos" : response.status === "partial" ? "Datos parciales" : "Sin datos"}
            </Badge>
            <span className="text-content-faint">última actualización: {day(updated)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-edge bg-surface-2 p-0.5">
            {[7, 28, 90].map((days) => (
              <button
                key={days}
                onClick={() => updateFilter("days", String(days))}
                className={cn("rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors", filters.days === days ? "bg-surface-0 text-content shadow-sm" : "text-content-faint hover:text-content-muted")}
              >
                {days} d
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => updateFilter("compare", filters.compare === "year" ? "previous" : "year")} className="gap-1.5">
            {filters.compare === "year" ? "vs año anterior" : "vs período anterior"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> {refreshing ? "Actualizando…" : "Actualizar datos"}
          </Button>
        </div>
      </header>

      {response.error ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-[11.5px] text-caution">
          <CircleAlert className="size-3.5 shrink-0" /> {response.error}
        </div>
      ) : null}

      {!data.segmentsApplied ? (
        <p className="rounded-lg border border-edge bg-surface-2/50 px-3 py-2 text-[10.5px] text-content-faint">
          El Resumen agrega el sitio completo. Los filtros de idioma, país y dispositivo se aplican en Search Console, Analytics, Keywords y Contenido (consultas en vivo).
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Clics"
          value={gsc ? integer.format(gsc.current.clicks) : "—"}
          delta={gsc ? delta(gsc.current.clicks, gsc.previous.clicks) : undefined}
          icon={<Search className="size-3.5" />}
          detail={gsc ? <MiniSpark points={gsc.series.map((point) => point.clicks)} /> : "Sin Search Console"}
        />
        <StatCard
          label="Impresiones"
          value={gsc ? integer.format(gsc.current.impressions) : "—"}
          delta={gsc ? delta(gsc.current.impressions, gsc.previous.impressions) : undefined}
          icon={<BarChart3 className="size-3.5" />}
          detail={gsc ? <MiniSpark points={gsc.series.map((point) => point.impressions)} color="var(--wm-chart-5)" /> : "Sin Search Console"}
        />
        <StatCard
          label="CTR"
          value={gsc ? pct(gsc.current.ctr) : "—"}
          delta={gsc ? (gsc.current.ctr - gsc.previous.ctr) * 100 : undefined}
          deltaMode="points"
          icon={<Activity className="size-3.5" />}
          detail="Puntos porcentuales vs. comparación"
        />
        <StatCard
          label="Posición media"
          value={gsc ? decimal.format(gsc.current.position) : "—"}
          delta={gsc ? gsc.current.position - gsc.previous.position : undefined}
          lowerIsBetter
          icon={<Gauge className="size-3.5" />}
          detail="Menor es mejor"
        />
        <StatCard
          label="Clics sin marca"
          value={gsc ? integer.format(gsc.brand.nonBrand.clicks) : "—"}
          icon={<Search className="size-3.5" />}
          detail={gsc ? `Marca: ${integer.format(gsc.brand.brand.clicks)} clics` : undefined}
        />
        <StatCard
          label="Impresiones sin marca"
          value={gsc ? integer.format(gsc.brand.nonBrand.impressions) : "—"}
          icon={<Search className="size-3.5" />}
          detail={gsc ? `Marca: ${integer.format(gsc.brand.brand.impressions)} impresiones` : undefined}
        />
        <StatCard
          label="Consultas top 10"
          value={gsc ? integer.format(gsc.reach.top10) : "—"}
          icon={<Search className="size-3.5" />}
          detail={gsc ? `Top 3: ${gsc.reach.top3} · Top 30: ${gsc.reach.top30} · ${integer.format(gsc.reach.total)} consultas` : undefined}
        />
        <StatCard
          label="Visibilidad en IA"
          value={aiShare == null ? "—" : pct(aiShare)}
          icon={<Sparkles className="size-3.5" />}
          detail={ga ? `${integer.format(ga.current.aiSessions)} sesiones IA de ${integer.format(ga.current.sessions)} orgánicas` : "Sin GA4"}
        />
        <StatCard
          label="Sesiones orgánicas"
          value={ga ? integer.format(ga.current.sessions) : "—"}
          delta={ga ? delta(ga.current.sessions, ga.previous.sessions) : undefined}
          icon={<Activity className="size-3.5" />}
          detail={ga ? <MiniSpark points={ga.series.map((point) => point.sessions)} color="var(--wm-chart-3)" /> : "Sin GA4"}
        />
        <StatCard
          label="Conversiones orgánicas"
          value={ga ? integer.format(ga.current.conversions) : "—"}
          delta={ga ? delta(ga.current.conversions, ga.previous.conversions) : undefined}
          icon={<Activity className="size-3.5" />}
          detail={ga ? <MiniSpark points={ga.series.map((point) => point.conversions)} color="var(--wm-chart-4)" /> : "Sin GA4"}
        />
        <StatCard
          label="Sesiones desde IA"
          value={ga ? integer.format(ga.current.aiSessions) : "—"}
          delta={ga ? delta(ga.current.aiSessions, ga.previous.aiSessions) : undefined}
          icon={<Sparkles className="size-3.5" />}
          detail={ga ? <MiniSpark points={ga.aiSeries.map((point) => point.sessions)} color="var(--wm-chart-2)" /> : "Sin GA4"}
        />
        <StatCard
          label="Salud técnica"
          value={data.audit.score == null ? "—" : data.audit.score}
          unit="/100"
          bar={data.audit.score}
          tone={scoreTone(data.audit.score)}
          icon={<ShieldCheck className="size-3.5" />}
          detail={data.audit.lastAudit ? `Última auditoría: ${day(data.audit.lastAudit)} · ${integer.format(data.audit.issues)} issues` : "Sin auditoría publicada"}
        />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-3">
        <Section
          title="Search Console"
          detail={`Clics e impresiones · ${data.period.start} a ${data.period.end}`}
          className="xl:col-span-2"
          action={
            <Link href="/search-console" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-[11px]")}>
              Ver búsqueda <ArrowRight className="size-3" />
            </Link>
          }
        >
          {gsc ? (
            <div className="space-y-3">
              <TrendChart data={gsc.series} />
              <div className="grid gap-2 sm:grid-cols-4">
                <MiniStat label="Clics" value={integer.format(gsc.current.clicks)} delta={delta(gsc.current.clicks, gsc.previous.clicks)} />
                <MiniStat label="Impresiones" value={integer.format(gsc.current.impressions)} delta={delta(gsc.current.impressions, gsc.previous.impressions)} />
                <MiniStat label="CTR" value={pct(gsc.current.ctr)} delta={(gsc.current.ctr - gsc.previous.ctr) * 100} deltaMode="points" />
                <MiniStat label="Posición media" value={decimal.format(gsc.current.position)} delta={gsc.current.position - gsc.previous.position} lowerIsBetter />
              </div>
            </div>
          ) : (
            <Empty text="Search Console no tiene datos para el período." />
          )}
        </Section>

        <Section title="Agente y atención" detail="Señales abiertas de alertas y auditoría">
          {data.attention.length ? (
            <ul className="space-y-2">
              {data.attention.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="block rounded-lg border border-edge bg-surface-2/40 px-3 py-2 transition-colors hover:border-edge-strong">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11.5px] font-medium text-content">{item.title}</span>
                      <Badge tone={item.severity === "critical" ? "negative" : item.severity === "high" ? "caution" : "neutral"}>{item.severity}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10.5px] text-content-faint">{item.message}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No hay alertas abiertas. La sección se actualiza al ingerir datos." />
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="Issues técnicas" value={integer.format(data.audit.issues)} note={`Alta ${severityOf(data, "Alta")} · Media ${severityOf(data, "Media")}`} />
            <MiniStat label="Keywords top 10" value={integer.format(data.overview.keywordsTop10)} note="Consultas con posición media ≤ 10" />
          </div>
        </Section>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Section title="Rankings" detail="Consultas con más impresiones del período">
          <div className="overflow-hidden rounded-lg border border-edge">
            <div className="wm-scroll-x overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left text-[11.5px]">
                <colgroup>
                  <col />
                  <col className="w-[52px]" />
                  <col className="w-[52px]" />
                  <col className="w-[58px]" />
                  <col className="w-[62px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-edge bg-surface-2/60 text-[9.5px] uppercase tracking-[0.08em] text-content-faint">
                    <th className="px-2.5 py-1.5 font-semibold">Consulta</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Pos.</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Δ</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Impr.</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Marca</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rankingRows.map((row) => {
                    const change = row.positionDelta;
                    return (
                      <tr key={row.query} className="border-b border-edge/60 last:border-0">
                        <td className="px-2.5 py-1.5">
                          <span className="block max-w-[200px] truncate text-content" title={row.query}>{row.query}</span>
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-content-muted">{row.position == null ? "—" : decimal.format(row.position)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
                          <span className={cn(change == null ? "text-content-faint" : change > 0 ? "text-positive" : change < 0 ? "text-negative" : "text-content-faint")}>
                            {change == null ? "—" : `${change > 0 ? "+" : ""}${decimal.format(change)}`}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-content-muted">{integer.format(row.impressions)}</td>
                        <td className="px-2.5 py-1.5 text-right text-[10px] text-content-faint">{row.brand === "brand" ? "Marca" : "Sin marca"}</td>
                      </tr>
                    );
                  })}
                  {!data.rankingRows.length ? (
                    <tr>
                      <td colSpan={5} className="px-2.5 py-6 text-center text-[11px] text-content-faint">Sin consultas persistidas de Search Console.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        <Section
          title="Analytics"
          detail="Tráfico orgánico, conversiones y referrals de IA · GA4"
          action={
            <Link href="/analytics" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-[11px]")}>
              Ver analytics <ArrowRight className="size-3" />
            </Link>
          }
        >
          {ga ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <MiniStat label="Sesiones orgánicas" value={integer.format(ga.current.sessions)} delta={delta(ga.current.sessions, ga.previous.sessions)} />
              <MiniStat label="Conversiones" value={integer.format(ga.current.conversions)} delta={delta(ga.current.conversions, ga.previous.conversions)} />
              <MiniStat label="Engagement rate" value={pct(ga.current.engagementRate)} delta={(ga.current.engagementRate - ga.previous.engagementRate) * 100} deltaMode="points" />
              <MiniStat label="Sesiones desde IA" value={integer.format(ga.current.aiSessions)} delta={delta(ga.current.aiSessions, ga.previous.aiSessions)} note="Referrals detectados por GA4" />
            </div>
          ) : (
            <Empty text="GA4 no tiene datos para el período." />
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Vital label="LCP" value={data.audit.vitals?.metrics.lcp} kind="ms" />
            <Vital label="INP" value={data.audit.vitals?.metrics.inp} kind="ms" />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-content-faint">
            <Sparkles className="size-3" /> CrUX mobile · p75 · {data.audit.vitals ? data.audit.vitals.status : "sin datos"}
          </p>
        </Section>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Section title="Ganadoras" detail="Mayor crecimiento de clics vs. comparación">
          <QueryList rows={data.keywords.winners} empty="Sin consultas con crecimiento." />
        </Section>
        <Section title="Perdedoras" detail="Mayor caída de clics vs. comparación">
          <QueryList rows={data.keywords.losers} empty="Sin consultas con caída." />
        </Section>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-surface-1 px-3 py-2.5">
        <BarChart3 className="size-3.5 text-content-faint" />
        <span className="text-[10px] uppercase tracking-[0.08em] text-content-faint">Fuentes</span>
        {Object.entries({ searchConsole: "Search Console", analytics: "GA4", audit: "Auditoría", indexation: "Indexación" }).map(([key, label]) => {
          const state = data.sources[key];
          const tone = state === "available" ? "positive" : state ? "caution" : "neutral";
          return (
            <Badge key={key} tone={tone}>{label} · {state ?? "sin snapshot"}</Badge>
          );
        })}
        {indexed != null ? <span className="ml-auto text-[10px] text-content-faint">{indexed} URLs inspeccionadas</span> : null}
      </div>
    </div>
  );
}

function QueryList({ rows, empty }: { rows: QueryRow[]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.query} className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-surface-2/40 px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-content" title={row.query}>{row.query}</span>
          <span className={cn("font-mono text-[10.5px] tabular-nums", row.clickDelta > 0 ? "text-positive" : row.clickDelta < 0 ? "text-negative" : "text-content-faint")}>
            {row.clickDelta > 0 ? "+" : ""}{integer.format(row.clickDelta)} clics
          </span>
        </li>
      ))}
    </ul>
  );
}

function MiniStat({ label, value, delta: change, deltaMode = "percent", lowerIsBetter = false, note }: { label: string; value: string; delta?: number | null; deltaMode?: "percent" | "points"; lowerIsBetter?: boolean; note?: string }) {
  const improving = change == null ? false : lowerIsBetter ? change < 0 : change > 0;
  const worsening = change == null ? false : lowerIsBetter ? change > 0 : change < 0;
  const changeText = change == null ? "" : deltaMode === "points" ? `${change > 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")}` : `${change > 0 ? "+" : ""}${(change * 100).toFixed(1).replace(".", ",")}%`;
  return (
    <div className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-content-faint">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="font-mono text-[16px] font-semibold tabular-nums text-content">{value}</p>
        {change != null ? <span className={cn("font-mono text-[10px] tabular-nums", improving ? "text-positive" : worsening ? "text-negative" : "text-content-faint")}>{changeText}</span> : null}
      </div>
      {note ? <p className="mt-1 text-[10px] leading-relaxed text-content-faint">{note}</p> : null}
    </div>
  );
}

function Vital({ label, value, kind }: { label: string; value?: number | null; kind: "ms" | "cls" }) {
  const display = value == null ? "—" : kind === "cls" ? value.toFixed(3).replace(".", ",") : `${Math.round(value)}`;
  const good = value == null ? false : kind === "cls" ? value <= 0.1 : label === "LCP" ? value <= 2500 : value <= 200;
  return (
    <div className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-2 text-center">
      <p className="text-[9.5px] uppercase tracking-[0.08em] text-content-faint">{label}</p>
      <p className={cn("mt-0.5 font-mono text-[13px] font-semibold tabular-nums", value == null ? "text-content-faint" : good ? "text-positive" : "text-caution")}>
        {display}
        {kind === "ms" && value != null ? <span className="text-[9px] font-normal text-content-faint">ms</span> : null}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="grid place-items-center rounded-lg border border-dashed border-edge/70 px-4 py-8 text-center text-[11px] text-content-faint">{text}</div>;
}
