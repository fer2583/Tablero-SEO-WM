"use client";

type TooltipEntry = { dataKey?: string | number; name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> };
type TooltipProps = { active?: boolean; payload?: ReadonlyArray<TooltipEntry>; label?: string | number };

const LABELS: Record<string, string> = {
  clicks: "Clics",
  impressions: "Impresiones",
  ctr: "CTR",
  position: "Posición",
  sessions: "Sesiones",
  users: "Usuarios",
  conversions: "Conversiones",
  value: "Valor",
  count: "Keywords",
  potentialClicks: "Potencial",
};

const format = (value: number | string | undefined, key: string | number | undefined) => {
  if (value == null) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (key === "ctr") return `${(numeric * 100).toFixed(2).replace(".", ",")}%`;
  if (key === "position") return numeric.toFixed(1).replace(".", ",");
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: numeric < 10 ? 1 : 0 }).format(numeric);
};

export function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-lg border border-edge-strong bg-surface-1/95 p-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,.85)] backdrop-blur">
      {label != null ? <p className="mb-1.5 text-[10.5px] font-medium text-content-muted">{String(label)}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`${String(entry.dataKey ?? index)}`} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-content-muted">
              <span className="size-1.5 rounded-full" style={{ background: entry.color ?? "var(--wm-accent)" }} />
              {LABELS[String(entry.dataKey)] ?? entry.name ?? String(entry.dataKey ?? "")}
            </span>
            <span className="tnum font-medium text-content">{format(entry.value, entry.dataKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartEmpty({ label = "Sin datos para el período seleccionado." }: { label?: string }) {
  return (
    <div className="grid h-full min-h-[180px] place-items-center rounded-lg border border-dashed border-edge/70 px-6 text-center text-[11.5px] text-content-faint">
      {label}
    </div>
  );
}
