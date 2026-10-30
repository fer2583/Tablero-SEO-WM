import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress, type ProgressTone } from "./progress";

export function StatCard({
  label,
  value,
  unit,
  detail,
  delta,
  deltaMode = "percent",
  lowerIsBetter = false,
  icon,
  tone = "neutral",
  bar,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  delta?: number | null;
  deltaMode?: "percent" | "points";
  lowerIsBetter?: boolean;
  icon?: ReactNode;
  tone?: ProgressTone | "neutral";
  bar?: number | null;
}) {
  const improving = delta == null ? false : lowerIsBetter ? delta < 0 : delta > 0;
  const worsening = delta == null ? false : lowerIsBetter ? delta > 0 : delta < 0;
  const deltaText =
    delta == null
      ? "—"
      : deltaMode === "points"
        ? `${delta > 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")}`
        : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1).replace(".", ",")}%`;

  return (
    <article className="relative min-w-0 overflow-hidden rounded-xl border border-edge bg-surface-1 p-3.5 transition-colors hover:border-edge-strong">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-content-muted">
          {icon ? <span className="text-content-faint">{icon}</span> : null}
          {label}
        </p>
        {delta !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
              improving && "border-positive/30 bg-positive/10 text-positive",
              worsening && "border-negative/30 bg-negative/10 text-negative",
              !improving && !worsening && "border-edge bg-surface-2 text-content-faint",
            )}
            title="Variación vs. período anterior"
          >
            {delta == null || delta === 0 ? <Minus className="size-2.5" /> : delta > 0 ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
            {deltaText}
          </span>
        ) : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1 font-semibold leading-none tracking-tight text-content">
        <span className="tnum text-[24px]">{value}</span>
        {unit ? <span className="text-[12px] font-medium text-content-muted">{unit}</span> : null}
      </p>

      {bar != null ? (
        <div className="mt-2.5">
          <Progress value={bar} tone={tone === "neutral" ? "accent" : tone} />
        </div>
      ) : null}

      {detail ? <div className="mt-2 text-[10.5px] leading-relaxed text-content-faint">{detail}</div> : null}
    </article>
  );
}
