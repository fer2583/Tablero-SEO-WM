"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { IntelligenceWorkspace } from "@/components/intelligence/intelligence-workspace";

export default function IntelligencePage() {
  return (
    <DashboardShell>
      <IntelligenceWorkspace />
    </DashboardShell>
  );
}
