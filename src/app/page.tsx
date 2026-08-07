"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { FilterBar, SectionHeading } from "@/components/ui";
import { SummaryLive } from "@/components/integration-panels";

export default function Home() {
  return (
    <DashboardShell>
      <SummaryHeading />
        <SummaryLive />
      <FilterBar />
    </DashboardShell>
  );
}

function SummaryHeading() { return <SectionHeading eyebrow="Resumen ejecutivo" title="Rendimiento orgánico" description="Una lectura rápida basada únicamente en fuentes conectadas." />; }
