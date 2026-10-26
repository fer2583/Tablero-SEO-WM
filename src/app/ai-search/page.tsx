"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { AiSearchWorkspace } from "@/components/ai-search/ai-search-workspace";

export default function AiSearchPage() {
  return (
    <DashboardShell>
      <AiSearchWorkspace />
    </DashboardShell>
  );
}
