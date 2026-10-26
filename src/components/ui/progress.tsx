import { cn } from "@/lib/utils";

export type ProgressTone = "accent" | "positive" | "caution" | "negative" | "muted";

const TONES: Record<ProgressTone, string> = {
  accent: "bg-accent",
  positive: "bg-positive",
  caution: "bg-caution",
  negative: "bg-negative",
  muted: "bg-content-faint",
};

export function Progress({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: ProgressTone;
  className?: string;
  label?: string;
}) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-4/70", className)}
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", TONES[tone])} style={{ width: `${safe}%` }} />
    </div>
  );
}

export function scoreTone(score: number | null | undefined): ProgressTone {
  if (score == null) return "muted";
  if (score >= 90) return "positive";
  if (score >= 50) return "caution";
  return "negative";
}
