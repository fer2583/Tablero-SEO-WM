import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  detail,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-edge bg-surface-1", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-edge/70 px-3.5 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[12.5px] font-semibold text-content">{title}</h2>
          {detail ? <p className="mt-0.5 text-[10.5px] text-content-faint">{detail}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}
