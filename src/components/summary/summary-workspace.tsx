"use client";

import Link from "next/link";
import { Activity, ArrowRight, BarChart3, CircleAlert, Gauge, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useDashboardFilters } from "@/components/filter-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress, scoreTone } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

type SourceMetrics = { clicks: number | null; impressions: number | null; ctr: number | null; position: number };
type AnalyticsMetrics = { users: number | null; sessions: number | null; organicSessions: number | null; aiSessions: number | null; engagementRate: number | null; conversions: number | null };
type RankingRow = { query: string; position: number | null; previousPosition: number | null; impressions: number | null };
type SummaryPayload = {
  period: { start: string; end: string; previousStart: string; previousEnd: string };
  metrics: { searchConsole: SourceMetrics | null; analytics: AnalyticsMetrics | null };
  previous: { searchConsole: SourceMetrics | null; analytics: Partial<AnalyticsMetrics> | null };
  keywords: { winning: RankingRow[]; losing: RankingRow[]; status?: string };
  overview: { healthScore: number | null; keywordsTop10: number; monthlyActions: number | null; issues: number };
  rankings: { top3: number; top10: number; top30: number; noPosition: number; rows: RankingRow[] };
  audit: { score: number | null; issues: number; severity: Array<{ severity: string; count: number }>; lastAudit: string | null; vitals: { status: string; metrics: Record<string, number | null> } | null };
  indexation: { inspected?: number | null; indexed?: number | null; problemUrls?: string[] } | null;
  technical: { status?: string } | null;
  sources: Record<string, string>;
  periodLabel?: string;
};
type Payload = { status: string; error?: string; data?: SummaryPayload; metadata?: { snapshotAt?: Record<string, string | null> } };

const EMPTY: SummaryPayload = {
  period: { start: "", end: "", previousStart: "", previousEnd: "" },
  metrics: { searchConsole: null, analytics: null },
  previous: { searchConsole: null, analytics: null },
  keywords: { winning: [], losing: [] },
  overview: { healthScore: null, keywordsTop10: 0, monthlyActions: null, issues: 0 },
  rankings: { top3: 0, top10: 0, top30: 0, noPosition: 0, rows: [] },
  audit: { score: null, issues: 0, severity: [], lastAudit: null, vitals: null },
  indexation: null,
  technical: null,
  sources: {},
};

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number) => percent.format(value).replace(/\s/g, "");

const day = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";

const delta = (current: number | null | undefined, previous: number | null | undefined) =>
  current == null || previous == null || previous === 0 ? null : (current - previous) / Math.abs(previous);

const normalize = (value: Partial<SummaryPayload> | undefined): SummaryPayload => ({
  ...EMPTY,
  ...value,
  period: { ...EMPTY.period, ...value?.period },
  metrics: { searchConsole: value?.metrics?.searchConsole ?? null, analytics: value?.metrics?.analytics ?? null },
  previous: { searchConsole: value?.previous?.searchConsole ?? null, analytics: value?.previous?.analytics ?? null },
  keywords: { winning: value?.keywords?.winning ?? [], losing: value?.keywords?.losing ?? [], status: value?.keywords?.status },
  overview: { ...EMPTY.overview, ...value?.overview },
  rankings: { ...EMPTY.rankings, ...value?.rankings, rows: value?.rankings?.rows ?? [] },
  audit: { ...EMPTY.audit, ...value?.audit, severity: value?.audit?.severity ?? [] },
  sources: value?.sources ?? {},
});

function severityOf(data: SummaryPayload, label: string) {
  return data.audit.severity.find((item) => item.severity.toLowerCase() === label.toLowerCase())?.count ?? 0;
}

export function SummaryPanel() {
  const { refreshKey } = useDashboardFilters();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/summary", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: Payload) => setPayload(value))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPayload({ status: "unavailable", error: "No se pudo consultar el Resumen." });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey]);

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

  const response = payload ?? { status: "unavailable" };
  const data = normalize(payload?.data);
  const gsc = data.metrics.searchConsole;
  const gscPrevious = data.previous.searchConsole;
  const ga = data.metrics.analytics;
  const gaPrevious = data.previous.analytics;
  const updated = Object.values(response.metadata?.snapshotAt ?? {})
    .filter((item): item is string => Boolean(item))
    .sort()
    .at(-1);
  const indexed = data.indexation?.inspected;

  if (loading && !payload) {
    return (
      <div className="space-y-4">
        <div className="wm-skeleton h-16 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="wm-skeleton h-[104px] rounded-xl" />
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
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Vista general del estado SEO</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
            <span>
              {day(data.period.start)} – {day(data.period.end)}
            </span>
            <Badge tone={response.status === "live" ? "positive" : response.status === "partial" ? "caution" : "negative"}>
              {response.status === "live" ? "Snapshot completo" : response.status === "partial" ? "Datos parciales" : "Sin datos"}
            </Badge>
            <span className="text-content-faint">última actualización: {day(updated)}</span>
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> {refreshing ? "Actualizando…" : "Actualizar datos"}
        </Button>
      </header>

      {response.error ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-[11.5px] text-caution">
          <CircleAlert className="size-3.5 shrink-0" /> {response.error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Health Score"
          value={data.overview.healthScore == null ? "—" : data.overview.healthScore}
          unit="/100"
          bar={data.overview.healthScore}
          tone={scoreTone(data.overview.healthScore)}
          icon={<ShieldCheck className="size-3.5" />}
          detail={data.audit.lastAudit ? `Última auditoría: ${day(data.audit.lastAudit)}` : "Sin auditoría publicada"}
        />
        <StatCard
          label="Keywords top 10"
          value={integer.format(data.overview.keywordsTop10)}
          icon={<Search className="size-3.5" />}
          detail={`Top 3: ${data.rankings.top3} · Top 30: ${data.rankings.top30}`}
        />
        <StatCard
          label="Acciones del mes"
          value={data.overview.monthlyActions == null ? "—" : integer.format(data.overview.monthlyActions)}
          icon={<Activity className="size-3.5" />}
          detail="Sin registro de acciones todavía"
        />
        <StatCard
          label="Issues técnicas"
          value={integer.format(data.overview.issues)}
          icon={<CircleAlert className="size-3.5" />}
          tone={data.overview.issues > 0 ? "caution" : "positive"}
          detail={`Alta ${severityOf(data, "Alta")} · Media ${severityOf(data, "Media")} · Baja ${severityOf(data, "Baja")}`}
        />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Section
          title="Search Console"
          detail="Clics, impresiones y posición media · 30 días vs. 30 días anteriores"
          action={
            <Link href="/search-console" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-[11px]")}>
              Ver búsqueda <ArrowRight className="size-3" />
            </Link>
          }
        >
          {gsc ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <MiniStat label="Clics" value={integer.format(gsc.clicks ?? 0)} delta={delta(gsc.clicks, gscPrevious?.clicks)} />
              <MiniStat label="Impresiones" value={integer.format(gsc.impressions ?? 0)} delta={delta(gsc.impressions, gscPrevious?.impressions)} />
              <MiniStat label="CTR" value={gsc.ctr == null ? "—" : pct(gsc.ctr)} delta={delta(gsc.ctr, gscPrevious?.ctr)} />
              <MiniStat label="Posición media" value={gsc.position ? decimal.format(gsc.position) : "—"} delta={delta(gsc.position, gscPrevious?.position)} lowerIsBetter />
            </div>
          ) : (
            <Empty text="Search Console no tiene snapshots para el período." />
          )}
        </Section>

        <Section
          title="Analytics"
          detail="Tráfico orgánico y referrals de IA · GA4"
          action={
            <Link href="/analytics" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-[11px]")}>
              Ver analytics <ArrowRight className="size-3" />
            </Link>
          }
        >
          {ga ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <MiniStat label="Sesiones orgánicas" value={ga.organicSessions == null ? "—" : integer.format(ga.organicSessions)} delta={delta(ga.organicSessions, gaPrevious?.organicSessions)} />
              <MiniStat label="Usuarios orgánicos" value={ga.users == null ? "—" : integer.format(ga.users)} delta={delta(ga.users, gaPrevious?.users)} />
              <MiniStat label="Tasa de interacción" value={ga.engagementRate == null ? "—" : pct(ga.engagementRate)} delta={delta(ga.engagementRate, gaPrevious?.engagementRate)} />
              <MiniStat label="Sesiones desde IA" value={ga.aiSessions == null ? "—" : integer.format(ga.aiSessions)} note="Referrals detectados por GA4" />
            </div>
          ) : (
            <Empty text="GA4 no tiene snapshots para el período." />
          )}
        </Section>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Section title="Rankings" detail="Distribución de posiciones en Search Console">
          <div className="grid grid-cols-2 gap-2">
            <RankBar label="Top 3" value={data.rankings.top3} total={Math.max(1, data.rankings.top30 + data.rankings.noPosition)} tone="positive" />
            <RankBar label="4–10" value={Math.max(0, data.rankings.top10 - data.rankings.top3)} total={Math.max(1, data.rankings.top30 + data.rankings.noPosition)} tone="accent" />
            <RankBar label="11–30" value={Math.max(0, data.rankings.top30 - data.rankings.top10)} total={Math.max(1, data.rankings.top30 + data.rankings.noPosition)} tone="caution" />
            <RankBar label="Sin posición" value={data.rankings.noPosition} total={Math.max(1, data.rankings.top30 + data.rankings.noPosition)} tone="muted" />
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-edge">
            <div className="wm-scroll-x overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-[11.5px]">
              <colgroup>
                <col />
                <col className="w-[54px]" />
                <col className="w-[54px]" />
                <col className="w-[62px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-edge bg-surface-2/60 text-[9.5px] uppercase tracking-[0.08em] text-content-faint">
                  <th className="px-2.5 py-1.5 font-semibold">Consulta</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Pos.</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Δ</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Impr.</th>
                </tr>
              </thead>
              <tbody>
                {data.rankings.rows.slice(0, 8).map((row) => {
                  const change = row.position != null && row.previousPosition != null ? row.previousPosition - row.position : null;
                  const normalized = change != null && Math.abs(change) < 0.05 ? 0 : change;
                  return (
                    <tr key={row.query} className="border-b border-edge/60 last:border-0">
                      <td className="px-2.5 py-1.5">
                        <span className="block max-w-[200px] truncate text-content" title={row.query}>
                          {row.query}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-content-muted">{row.position == null ? "—" : decimal.format(row.position)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
                        <span className={cn(normalized == null ? "text-content-faint" : normalized > 0 ? "text-positive" : normalized < 0 ? "text-negative" : "text-content-faint")}>
                          {normalized == null ? "—" : `${normalized > 0 ? "+" : ""}${decimal.format(normalized)}`}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-content-muted">{row.impressions == null ? "—" : integer.format(row.impressions)}</td>
                    </tr>
                  );
                })}
                {!data.rankings.rows.length ? (
                  <tr>
                    <td colSpan={4} className="px-2.5 py-6 text-center text-[11px] text-content-faint">
                      Sin consultas persistidas de Search Console.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </div>
        </Section>

        <Section
          title="Auditoría técnica"
          detail="Salud del crawler, issues y Core Web Vitals"
          action={
            <Link href="/auditoria-tecnica" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-[11px]")}>
              Ver auditoría <ArrowRight className="size-3" />
            </Link>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-content-faint">Salud técnica</p>
              <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-content">
                {data.audit.score == null ? "—" : `${data.audit.score}`}
                <span className="text-[11px] font-normal text-content-faint">/100</span>
              </p>
              <Progress className="mt-2" value={data.audit.score ?? 0} tone={scoreTone(data.audit.score)} label="Salud técnica" />
            </div>
            <div className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-content-faint">Issues</p>
              <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-content">{integer.format(data.audit.issues)}</p>
              <p className="mt-1.5 text-[10px] text-content-faint">
                Alta {severityOf(data, "Alta")} · Media {severityOf(data, "Media")} · Baja {severityOf(data, "Baja")}
              </p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Vital label="LCP" value={data.audit.vitals?.metrics.lcp} kind="ms" />
            <Vital label="INP" value={data.audit.vitals?.metrics.inp} kind="ms" />
            <Vital label="CLS" value={data.audit.vitals?.metrics.cls} kind="cls" />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-content-faint">
            <Sparkles className="size-3" /> CrUX mobile · p75 · {data.audit.vitals ? data.audit.vitals.status : "sin datos"}
          </p>
        </Section>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-surface-1 px-3 py-2.5">
        <BarChart3 className="size-3.5 text-content-faint" />
        <span className="text-[10px] uppercase tracking-[0.08em] text-content-faint">Fuentes</span>
        {Object.entries({ searchConsole: "Search Console", analytics: "GA4", audit: "Auditoría", indexation: "Indexación" }).map(([key, label]) => {
          const state = data.sources[key];
          const tone = state === "available" ? "positive" : state ? "caution" : "neutral";
          return (
            <Badge key={key} tone={tone}>
              {label} · {state ?? "sin snapshot"}
            </Badge>
          );
        })}
        {indexed != null ? <span className="ml-auto text-[10px] text-content-faint">{indexed} URLs inspeccionadas</span> : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value, delta: change, lowerIsBetter = false, note }: { label: string; value: string; delta?: number | null; lowerIsBetter?: boolean; note?: string }) {
  const improving = change == null ? false : lowerIsBetter ? change < 0 : change > 0;
  const worsening = change == null ? false : lowerIsBetter ? change > 0 : change < 0;
  return (
    <div className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-content-faint">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="font-mono text-[16px] font-semibold tabular-nums text-content">{value}</p>
        {change != null ? (
          <span className={cn("font-mono text-[10px] tabular-nums", improving ? "text-positive" : worsening ? "text-negative" : "text-content-faint")}>
            {change > 0 ? "+" : ""}
            {(change * 100).toFixed(1).replace(".", ",")}%
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-1 text-[10px] leading-relaxed text-content-faint">{note}</p> : null}
    </div>
  );
}

function RankBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: "positive" | "accent" | "caution" | "muted" }) {
  return (
    <div className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.06em] text-content-faint">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-content">{integer.format(value)}</span>
      </div>
      <Progress className="mt-1.5" value={(value / total) * 100} tone={tone === "muted" ? "muted" : tone} label={label} />
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
