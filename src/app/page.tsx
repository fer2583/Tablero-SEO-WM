"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { FilterBar, SectionHeading } from "@/components/ui";
import { SummaryLive } from "@/components/integration-panels";
import { useDashboardFilters } from "@/components/filter-context";

export default function Home() {
  return (
    <DashboardShell>
      <SummaryHeading />
      <div className="demo-banner"><SummaryLive /></div>
      <FilterBar />
      <p className="muted">El resumen usa los mismos datos conectados que las vistas de Search Console y Analytics. Las áreas técnicas siguen marcadas como demo hasta conectar esa fuente.</p>
    </DashboardShell>
  );
}

function SummaryHeading() {
  const { filters } = useDashboardFilters();
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - (filters.days - 1));
  const formatDate = (value: string) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00Z`));
  return <SectionHeading eyebrow="Resumen ejecutivo" title="Buenos días, Javier" description="Una lectura rápida del rendimiento orgánico de Whalemate." action={<div className="outline-button"><CalendarDays size={16} /> {formatDate(start.toISOString().slice(0, 10))} — {formatDate(end.toISOString().slice(0, 10))} <ChevronRight size={14} /></div>} />;
}
