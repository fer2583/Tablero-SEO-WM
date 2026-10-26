"use client";

import { notFound, useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { AnalyticsLive, KeywordsLive, SearchConsoleLive } from "@/components/integration-panels";
import { AuditPanel } from "@/components/audit-panel";
import { ContentPanel } from "@/components/content-panel";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { AlertsPanel } from "@/components/alerts-panel";

const SECTIONS = ["search-console", "analytics", "auditoria-tecnica", "keywords", "contenido", "alertas", "configuracion"] as const;
type Section = (typeof SECTIONS)[number];

export default function SectionPage() {
  const { section } = useParams<{ section: string }>();

  if (!SECTIONS.includes(section as Section)) {
    notFound();
  }

  return (
    <DashboardShell>
      {section === "analytics" ? (
        <AnalyticsLive />
      ) : section === "search-console" ? (
        <SearchConsoleLive />
      ) : section === "auditoria-tecnica" ? (
        <AuditPanel />
      ) : section === "alertas" ? (
        <AlertsPanel />
      ) : section === "keywords" ? (
        <KeywordsLive />
      ) : section === "contenido" ? (
        <ContentPanel />
      ) : (
        <ConfigurationPanel />
      )}
    </DashboardShell>
  );
}
