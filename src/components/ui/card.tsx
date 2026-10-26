import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-edge bg-surface-2/80 shadow-[0_1px_0_rgba(255,255,255,.03)_inset,0_24px_48px_-32px_rgba(0,0,0,.8)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  detail,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-content">{title}</h2>
          {detail ? <p className="mt-1 text-[11px] leading-relaxed text-content-faint">{detail}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
