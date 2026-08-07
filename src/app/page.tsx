"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { FilterBar, SectionHeading } from "@/components/ui";
import { SummaryPanel } from "@/components/summary-panel";

export default function Home() {
  return (
    <DashboardShell>
      <SummaryHeading />
        <SummaryPanel />
      <FilterBar />
    </DashboardShell>
  );
}

function SummaryHeading() { return <SectionHeading eyebrow="Resumen ejecutivo" title="Rendimiento orgánico" description="Últimos 30 días vs. 30 días anteriores" />; }
