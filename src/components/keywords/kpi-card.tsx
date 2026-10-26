"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { LazySparkline } from "@/components/charts/lazy";
import type { KeywordDaily } from "@/lib/keywords";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  format,
  suffix,
  previous,
  deltaMode = "percent",
  lowerIsBetter = false,
  daily,
  dataKey,
  color,
  hint,
}: {
  label: string;
  value: number;
  format?: Format;
  suffix?: string;
  previous?: number | null;
  deltaMode?: "percent" | "points";
  lowerIsBetter?: boolean;
  daily: KeywordDaily[];
  dataKey: "clicks" | "impressions" | "position";
  color?: string;
  hint?: string;
}) {
  const delta = previous == null ? null : deltaMode === "points" ? value - previous : previous ? (value - previous) / Math.abs(previous) : null;
  const improving = delta == null ? false : lowerIsBetter ? delta < 0 : delta > 0;
  const worsening = delta == null ? false : lowerIsBetter ? delta > 0 : delta < 0;
  const deltaText =
    delta == null
      ? "—"
      : deltaMode === "points"
        ? `${delta > 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")}`
        : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1).replace(".", ",")}%`;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-edge bg-surface-1 p-3.5 transition-colors hover:border-edge-strong">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-content-muted">{label}</p>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
            improving && "border-positive/30 bg-positive/10 text-positive",
            worsening && "border-negative/30 bg-negative/10 text-negative",
            !improving && !worsening && "border-edge bg-surface-2 text-content-faint",
          )}
          title={previous == null ? "Sin período anterior comparable" : "Variación vs. período anterior"}
        >
          {delta == null ? <Minus className="size-2.5" /> : delta > 0 ? <ArrowUp className="size-2.5" /> : delta < 0 ? <ArrowDown className="size-2.5" /> : <Minus className="size-2.5" />}
          {deltaText}
        </span>
      </div>

      <p className="mt-2 flex items-baseline gap-1 text-[26px] font-semibold leading-none tracking-tight text-content">
        <NumberFlow value={value} locales="es-ES" format={format ?? { useGrouping: true, maximumFractionDigits: 0 }} className="tnum" />
        {suffix ? <span className="text-[13px] font-medium text-content-muted">{suffix}</span> : null}
      </p>

      <div className="mt-2.5 -mb-1">
        <LazySparkline data={daily} dataKey={dataKey} color={color} />
      </div>
      {hint ? <p className="mt-1 text-[10px] text-content-faint">{hint}</p> : null}
    </article>
  );
}
