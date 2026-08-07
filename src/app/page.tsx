"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { FilterBar, SectionHeading } from "@/components/ui";
import { SummaryLive } from "@/components/integration-panels";

export default function Home() {
  return (
    <DashboardShell>
      <SummaryHeading />
        <div className="data-banner"><SummaryLive /></div>
      <FilterBar />
       <p className="muted">El resumen usa únicamente respuestas actuales de Search Console y GA4. Si una fuente no está conectada, se muestra No data available.</p>
    </DashboardShell>
  );
}

function SummaryHeading() { return <SectionHeading eyebrow="Resumen ejecutivo" title="Rendimiento orgánico" description="Una lectura rápida basada únicamente en fuentes conectadas." />; }
