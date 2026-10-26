"use client";

import { ChevronRight, Download, RotateCw } from "lucide-react";
import type { AuditIssue } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };

export function AuditIssuesView({ issues, disabled, recheck }: { issues: AuditIssue[]; disabled: boolean; recheck: (urls: string[]) => void }) {
  const groups = new Map<string, AuditIssue[]>();
  issues.forEach((issue) => {
    const key = issue.rule || issue.issue;
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  });
  const sorted = [...groups.entries()].sort((left, right) => {
    const severity = (SEVERITY_ORDER[left[1][0].severity] ?? 3) - (SEVERITY_ORDER[right[1][0].severity] ?? 3);
    return severity !== 0 ? severity : right[1].length - left[1].length;
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(issues, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "audit-issues.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Section
      title={`${groups.size} tipos de problemas · ${issues.length} incidencias`}
      detail="Agrupadas por regla. La severidad es orientativa y no reemplaza la revisión humana."
      action={
        <Button variant="outline" size="sm" onClick={exportJson} className="gap-1.5">
          <Download className="size-3.5" /> Exportar JSON
        </Button>
      }
    >
      {sorted.length ? (
        <div className="space-y-1.5">
          {sorted.map(([key, values]) => {
            const first = values[0];
            const tone = first.severity === "Alta" ? "negative" : first.severity === "Media" ? "caution" : "neutral";
            return (
              <details key={key} className="group rounded-lg border border-edge bg-surface-2/40 px-3 py-2 open:border-edge-strong">
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <ChevronRight className="size-3.5 shrink-0 text-content-faint transition-transform group-open:rotate-90" />
                  <Badge tone={tone}>{first.severity}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-content">{first.issue}</span>
                  <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-content-faint">{values.length} URLs</span>
                  {first.evaluation === "review" ? <Badge tone="accent">revisión humana</Badge> : null}
                </summary>
                <div className="mt-2 space-y-2 pl-5">
                  <p className="text-[10.5px] leading-relaxed text-content-muted">{first.recommendation}</p>
                  <Button variant="secondary" size="sm" disabled={disabled} onClick={() => void recheck(values.slice(0, 100).map((item) => item.url))} className="gap-1.5">
                    <RotateCw className="size-3" /> Reauditar hasta 100 URLs
                  </Button>
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {values.map((issue) => (
                      <div key={issue.id} className="rounded-md border border-edge/70 bg-surface-1/60 px-2.5 py-1.5">
                        <a href={issue.url} target="_blank" rel="noreferrer" className={cn("break-all font-mono text-[10px] text-accent hover:underline")}>
                          {issue.url || issue.id}
                        </a>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-content-faint">{issue.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="grid place-items-center rounded-lg border border-dashed border-edge/70 px-4 py-10 text-center">
          <p className="text-[12px] font-medium text-content">Sin incidencias detectadas</p>
          <p className="mt-1 max-w-sm text-[10.5px] text-content-faint">Consultar la cobertura del crawl antes de interpretar el resultado.</p>
        </div>
      )}
    </Section>
  );
}
