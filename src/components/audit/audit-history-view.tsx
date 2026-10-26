"use client";

import { History } from "lucide-react";
import type { AuditHistory } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

const when = (value?: string | null) => (value ? new Date(value).toLocaleString("es-ES") : "Sin fecha");

const statusTone = (status: string) =>
  status === "completed" ? "positive" : status === "running" ? "accent" : status === "paused" ? "caution" : status === "cancelled" ? "negative" : "neutral";

export function AuditHistoryView({ history, active, working, openRun }: { history: AuditHistory[]; active: boolean; working: boolean; openRun: (id: number) => void }) {
  return (
    <Section
      title="Historial de auditorías"
      detail="Las reauditorías selectivas no reemplazan la salud general del sitio."
      action={<History className="size-4 text-content-faint" />}
    >
      {history.length ? (
        <ul className="space-y-1">
          {history.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-2/40 px-2.5 py-1.5">
              <span className="font-mono text-[11px] text-content-faint">#{item.id}</span>
              <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              <span className="text-[10.5px] text-content-faint">{when(item.completedAt)}</span>
              <Button variant="ghost" size="sm" className="ml-auto" disabled={active || working} onClick={() => openRun(item.id)}>
                Ver #{item.id}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-6 text-center text-[11px] text-content-faint">Todavía no hay corridas publicadas en el historial.</p>
      )}
    </Section>
  );
}
