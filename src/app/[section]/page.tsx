"use client";

import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, EmptyState, FilterBar, SectionHeading } from "@/components/ui";
import { AnalyticsLive, KeywordsLive, SearchConsoleLive } from "@/components/integration-panels";
import { AuditPanel } from "@/components/audit-panel";
import { notFound } from "next/navigation";
import { ContentPanel } from "@/components/content-panel";
import { ConfigurationPanel } from "@/components/configuration-panel";

const titles: Record<string, [string, string, string]> = { "search-console": ["Search Console", "Rendimiento de búsqueda orgánica", "Consulta datos reales de Search Console."], analytics: ["Analytics", "El tráfico que mueve el negocio", "Consulta datos reales de GA4."], "auditoria-tecnica": ["Auditoría técnica", "La salud detrás del ranking", "Resultados reales de crawler, PageSpeed y CrUX."], keywords: ["Keywords", "El lenguaje de tu audiencia", "Las keywords se mostrarán cuando exista una fuente conectada."], contenido: ["Contenido", "Contenido que encuentra a las personas", "GSC y GA4 para entender qué demanda tu audiencia."], alertas: ["Alertas", "Señales para actuar a tiempo", "Las alertas se mostrarán cuando exista una fuente conectada."], configuracion: ["Configuración", "Fuentes de datos", "Estado real de las conexiones disponibles."] };
export default function SectionPage() { const { section } = useParams<{ section: string }>(); if (section === "indexacion") notFound(); const [label, title, description] = titles[section] ?? titles.configuracion; const compactSection = section === "keywords" || section === "contenido" || section === "configuracion"; return <DashboardShell>{section === "analytics" ? <AnalyticsLive /> : section === "search-console" ? <SearchConsoleLive /> : section === "auditoria-tecnica" ? <AuditPanel /> : compactSection ? <div className="analytics-workspace compact-workspace"><SectionHeading eyebrow={label} title={title} description={description} />{section === "keywords" ? <><FilterBar /><KeywordsLive /></> : section === "contenido" ? <ContentPanel /> : <ConfigurationPanel />}</div> : <><SectionHeading eyebrow={label} title={title} description={description} /><NotConnected section={label} /></>}</DashboardShell>; }
function NotConnected({ section }: { section: string }) { return <Card><EmptyState title="No data available" detail={`${section}: fuente no conectada. Conecta el backend o la API correspondiente para mostrar datos reales.`} /></Card>; }
