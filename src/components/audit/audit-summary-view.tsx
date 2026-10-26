"use client";

import { CircleAlert, FileCode2, Gauge, Layers, ShieldCheck, Timer, Waypoints } from "lucide-react";
import type { AuditData } from "@/lib/audit";
import { PerformanceSummary } from "@/components/performance-panel";
import { Badge } from "@/components/ui/badge";
import { Progress, scoreTone } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

export function AuditSummaryView({ data }: { data: AuditData }) {
  const pages = data.crawler.audited;
  const report = data.report;
  const html = pages.filter((page) => page.outcome === "html");
  const indexable = html.filter((page) => page.indexable).length;
  const avgMs = html.length ? Math.round(html.reduce((total, page) => total + page.durationMs, 0) / html.length) : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Salud técnica interna"
          value={report?.score == null ? "—" : report.score}
          unit="/100"
          bar={report?.score ?? 0}
          tone={scoreTone(report?.score)}
          icon={<ShieldCheck className="size-3.5" />}
          detail={data.sources.crawler === "live" ? "Reglas ponderadas; no predice posiciones" : "Provisional: revisar cobertura"}
        />
        <StatCard
          label="Cobertura HTML"
          value={report ? `${report.coverage}%` : "—"}
          icon={<Layers className="size-3.5" />}
          detail={`${html.length} HTML · ${pages.length} procesadas`}
        />
        <StatCard
          label="Problemas"
          value={integer.format(report?.groups.length ?? 0)}
          icon={<CircleAlert className="size-3.5" />}
          tone={data.crawler.issues.length ? "caution" : "positive"}
          detail={`${data.crawler.issues.length} incidencias · ${new Set(data.crawler.issues.map((item) => item.url)).size} páginas`}
        />
        <StatCard
          label="Indexabilidad HTML"
          value={html.length ? `${indexable}/${html.length}` : "—"}
          icon={<Gauge className="size-3.5" />}
          detail="No equivale a indexación en Google"
        />
      </div>

      {report?.categories.length ? (
        <Section title="Puntuación por categoría" detail="Cada categoría pondera reglas evaluadas sobre páginas elegibles.">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {report.categories.map((category) => (
              <div key={category.category} className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-[11px] text-content-muted">{category.category}</p>
                  <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-content">{category.score == null ? "—" : category.score}</p>
                </div>
                <Progress className="mt-1.5" value={category.score ?? 0} tone={scoreTone(category.score)} label={category.category} />
                <p className="mt-1 text-[9.5px] text-content-faint">{integer.format(category.evaluated)} evaluaciones</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-3">
        <Section title="Contenido principal" action={<FileCode2 className="size-4 text-content-faint" />}>
          <p className="font-mono text-[18px] font-semibold tabular-nums text-content">{integer.format(html.reduce((sum, page) => sum + page.wordCount, 0))}</p>
          <p className="text-[10.5px] text-content-faint">palabras extraídas</p>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge tone={data.schema.audited && data.schema.withJsonLd === data.schema.audited ? "positive" : "caution"}>
              JSON-LD {data.schema.withJsonLd}/{data.schema.audited}
            </Badge>
            {data.schema.coverage != null ? <Badge tone="neutral">cobertura {data.schema.coverage}%</Badge> : null}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-content-faint">JSON válido no garantiza resultados enriquecidos.</p>
        </Section>

        <Section title="Respuesta observada" action={<Timer className="size-4 text-content-faint" />}>
          <p className="font-mono text-[18px] font-semibold tabular-nums text-content">{avgMs == null ? "—" : integer.format(avgMs)}</p>
          <p className="text-[10.5px] text-content-faint">ms promedio de descarga</p>
          <p className="mt-2 text-[10px] leading-relaxed text-content-faint">Tiempo de descarga del crawler; no es un Core Web Vital.</p>
        </Section>

        <Section title="Profundidad desde la home" action={<Waypoints className="size-4 text-content-faint" />}>
          <p className="font-mono text-[18px] font-semibold tabular-nums text-content">{html.filter((page) => page.depth != null).length}</p>
          <p className="text-[10.5px] text-content-faint">páginas alcanzadas</p>
          <p className="mt-1 text-[10.5px] text-content-faint">{html.filter((page) => page.depth == null).length} sin camino detectado</p>
          <p className="mt-2 text-[10px] leading-relaxed text-content-faint">Las posibles huérfanas requieren cobertura completa y revisión.</p>
        </Section>
      </div>

      {report ? (
        <Section title="Comparación con la auditoría anterior" detail="Solo se marcan resueltos los criterios reevaluados.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <CompareStat label="Nuevas" value={report.comparison.new.length} tone="negative" />
            <CompareStat label="Persistentes" value={report.comparison.persistent.length} tone="caution" />
            <CompareStat label="Resueltas" value={report.comparison.resolved.length} tone="positive" />
            <CompareStat label="Sin reevaluar" value={report.comparison.unevaluated.length} tone="muted" />
          </div>
        </Section>
      ) : null}

      {data.indexing.rows.length > 0 ? (
        <Section title="URL Inspection · muestra persistida" detail={data.indexing.message || "Consulta de indexación de una muestra de URLs."}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={data.indexing.indexed ? "positive" : "neutral"}>{data.indexing.indexed ?? 0} indexadas</Badge>
            <span className="text-[10.5px] text-content-faint">de {data.indexing.inspected ?? 0} inspeccionadas</span>
          </div>
          <div className="mt-2 max-h-60 overflow-auto">
            <table className="w-full min-w-[320px]! border-collapse text-left text-[10.5px]">
              <tbody>
                {data.indexing.rows.map((row) => (
                  <tr key={row.url} className="border-b border-edge/60 last:border-0">
                    <td className="max-w-[280px] truncate px-1 py-1 font-mono text-content-muted" title={row.url}>{row.url}</td>
                    <td className="px-1 py-1 text-right">
                      <Badge tone={row.verdict === "indexed" ? "positive" : row.verdict === "error" ? "negative" : "caution"}>{row.verdict}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <PerformanceSummary data={data} />
    </div>
  );
}

function CompareStat({ label, value, tone }: { label: string; value: number; tone: "negative" | "caution" | "positive" | "muted" }) {
  return (
    <div className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
      <p className="text-[9.5px] uppercase tracking-[0.07em] text-content-faint">{label}</p>
      <p
        className={
          tone === "negative"
            ? "font-mono text-[16px] font-semibold tabular-nums text-negative"
            : tone === "caution"
              ? "font-mono text-[16px] font-semibold tabular-nums text-caution"
              : tone === "positive"
                ? "font-mono text-[16px] font-semibold tabular-nums text-positive"
                : "font-mono text-[16px] font-semibold tabular-nums text-content-muted"
        }
      >
        {integer.format(value)}
      </p>
    </div>
  );
}
