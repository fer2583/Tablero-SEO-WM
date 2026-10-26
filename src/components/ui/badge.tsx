import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-edge bg-surface-3 text-content-muted",
        accent: "border-accent/35 bg-accent-soft text-accent",
        positive: "border-positive/30 bg-positive/10 text-positive",
        caution: "border-caution/30 bg-caution/10 text-caution",
        negative: "border-negative/30 bg-negative/10 text-negative",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function LiveDot({ tone = "positive" }: { tone?: "positive" | "caution" | "negative" | "accent" }) {
  const color = tone === "positive" ? "bg-positive" : tone === "caution" ? "bg-caution" : tone === "negative" ? "bg-negative" : "bg-accent";
  return (
    <span className="relative flex size-1.5">
      <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", color)} />
      <span className={cn("relative inline-flex size-1.5 rounded-full", color)} />
    </span>
  );
}
