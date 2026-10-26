"use client";

import { Bot, Sparkles } from "lucide-react";
import type { IntegrationResponse } from "@/lib/integrations";
import type { AiSearchData } from "@/lib/ai-search";
import { Badge } from "@/components/ui/badge";
import { DataGrid, type GridColumn } from "@/components/ui/data-grid";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { LazySessionsChart } from "@/components/charts/lazy";
import { cn } from "@/lib/utils";

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

const delta = (current: number | null | undefined, previous: number | null | undefined) =>
  current == null || previous == null || previous === 0 ? null : (current - previous) / Math.abs(previous);

const formatDay = (value: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }).format(parsed).replace(" de ", " ");
};

const pathOf = (value: string) => {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
};

type SourceRow = AiSearchData["sources"][number];
type LandingRow = AiSearchData["landingPages"][number];

const SOURCE_COLUMNS: Array<GridColumn<SourceRow>> = [
  {
    key: "platform",
    label: "Plataforma",
    value: (row) => row.platform,
    filter: { type: "text" },
    render: (row) => <Badge tone="accent">{row.platform}</Badge>,
  },
  {
    key: "source",
    label: "Origen / medio",
    value: (row) => row.source,
    filter: { type: "text" },
    render: (row) => (
      <span className="block max-w-[240px] truncate font-mono text-[10.5px] text-content-muted" title={row.source}>
        {row.source}
      </span>
    ),
  },
  { key: "sessions", label: "Sesiones", value: (row) => row.sessions, align: "right", render: (row) => <span className="font-mono tabular-nums text-content">{integer.format(row.sessions)}</span> },
  { key: "users", label: "Usuarios", value: (row) => row.users, align: "right", hideBelow: "sm", render: (row) => <span className="font-mono tabular-nums text-content-muted">{integer.format(row.users)}</span> },
];

const LANDING_COLUMNS: Array<GridColumn<LandingRow>> = [
  {
    key: "page",
    label: "Landing page",
    value: (row) => row.page,
    filter: { type: "text" },
    render: (row) => (
      <span className="block max-w-[320px] truncate font-mono text-[10.5px] text-content" title={row.page}>
        {pathOf(row.page)}
      </span>
    ),
  },
  { key: "sessions", label: "Sesiones", value: (row) => row.sessions, align: "right", render: (row) => <span className="font-mono tabular-nums text-content">{integer.format(row.sessions)}</span> },
  { key: "users", label: "Usuarios", value: (row) => row.users, align: "right", hideBelow: "sm", render: (row) => <span className="font-mono tabular-nums text-content-muted">{integer.format(row.users)}</span> },
];

export function AiTrafficView({ response, loading }: { response: IntegrationResponse<AiSearchData>; loading: boolean }) {
  const data = response.data;
  const live = response.status === "live";

  if (response.status === "unavailable") {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
        <Bot className="size-6 text-content-faint" />
        <p className="mt-3 text-[13px] font-medium text-content">El tráfico de IA no está disponible</p>
        <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-content-faint">{response.error ?? "GA4 no respondió para los filtros seleccionados."}</p>
      </div>
    );
  }

  const chart = data.daily.map((row) => ({ label: formatDay(row.date), sessions: row.sessions }));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sesiones desde IA" value={integer.format(data.metrics.sessions)} icon={<Sparkles className="size-3.5" />} delta={delta(data.metrics.sessions, data.previous.sessions)} />
        <StatCard
          label="Share del tráfico"
          value={(data.share * 100).toFixed(2).replace(".", ",")}
          unit="%"
          delta={(data.share - data.previousShare) * 100}
          deltaMode="points"
          detail={`${integer.format(data.metrics.sessions)} de ${integer.format(data.totalSessions)} sesiones`}
        />
        <StatCard label="Usuarios" value={integer.format(data.metrics.users)} delta={delta(data.metrics.users, data.previous.users)} />
        <StatCard label="Conversiones" value={integer.format(data.metrics.conversions)} delta={delta(data.metrics.conversions, data.previous.conversions)} />
      </div>

      {!data.metrics.sessions ? (
        <div className="flex items-start gap-2 rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-[11px] text-caution">
          <Bot className="mt-0.5 size-3.5 shrink-0" />
          <span>
            No se detectaron referidos de asistentes de IA en el período. El módulo sigue midiendo: cuando ChatGPT, Perplexity, Gemini, Copilot, Claude o DeepSeek envíen tráfico, aparecerá acá automáticamente.
          </span>
        </div>
      ) : null}

      <Section title="Evolución diaria" detail="Sesiones atribuidas a asistentes de IA." action={loading ? <span className="text-[10px] text-content-faint">Actualizando…</span> : null}>
        {chart.length ? <LazySessionsChart data={chart} /> : <p className="px-1 py-8 text-center text-[11px] text-content-faint">Sin serie diaria para estos filtros.</p>}
      </Section>

      <Section title="Plataformas" detail="Distribución de sesiones por asistente de IA.">
        {data.platforms.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.platforms.map((platform) => (
              <article key={platform.platform} className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11.5px] font-medium text-content">{platform.platform}</p>
                  <span className="font-mono text-[11px] tabular-nums text-content-muted">{(platform.share * 100).toFixed(1).replace(".", ",")}%</span>
                </div>
                <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-content">{integer.format(platform.sessions)}</p>
                <Progress className="mt-1.5" value={platform.share * 100} tone="accent" label={platform.platform} />
                <p className="mt-1.5 text-[10px] text-content-faint">
                  {integer.format(platform.users)} usuarios · {integer.format(platform.conversions)} conversiones
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="px-1 py-8 text-center text-[11px] text-content-faint">Sin plataformas con tráfico en el período.</p>
        )}
      </Section>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Section title="Orígenes detectados" detail="Fuente y medio tal como los reporta GA4.">
          <DataGrid
            rows={data.sources}
            columns={SOURCE_COLUMNS}
            rowKey={(row) => row.source}
            label="orígenes de tráfico IA"
            searchPlaceholder="Buscar origen"
            initialSort={{ key: "sessions", direction: "desc" }}
            minWidth={500}
            dense
            empty="Sin orígenes de IA en el período."
          />
        </Section>
        <Section title="Landing pages" detail="Páginas que reciben visitas desde asistentes de IA.">
          <DataGrid
            rows={data.landingPages}
            columns={LANDING_COLUMNS}
            rowKey={(row, index) => `${row.page}-${index}`}
            label="landing pages de IA"
            searchPlaceholder="Buscar página"
            initialSort={{ key: "sessions", direction: "desc" }}
            minWidth={520}
            dense
            empty="Sin landing pages de IA en el período."
          />
        </Section>
      </div>

      <div className={cn("rounded-xl border border-edge bg-surface-1 px-3 py-2.5", !live && "border-caution/30 bg-caution/[0.06]")}>
        <p className="text-[10.5px] leading-relaxed text-content-faint">
          <strong className="text-content-muted">Cómo se calcula:</strong> se consulta GA4 con un filtro <code className="font-mono text-content-muted">sessionSource</code> contra dominios de asistentes
          (ChatGPT/OpenAI, Perplexity, Gemini, Copilot, Claude, DeepSeek, You, Phind, Poe). Es una métrica derivada, no nativa de GA4. No incluye citas en AI Overviews de Google, que no generan
          referrer y requieren una fuente SERP o registro manual.
        </p>
      </div>
    </div>
  );
}
