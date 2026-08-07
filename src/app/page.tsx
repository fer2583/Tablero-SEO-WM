"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { SummaryPanel } from "@/components/summary-panel";

export default function Home() {
  return (
    <DashboardShell>
      <SummaryPanel />
    </DashboardShell>
  );
}
