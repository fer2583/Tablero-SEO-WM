"use client";

import { BarChart3, Bot, Database, Gauge, Globe2, Search, Settings2 } from "lucide-react";
import { useDashboardFilters } from "./filter-context";
import { Card, CardHeader, EmptyState, LoadingState, StatusPill } from "./ui";

const icons = { gsc: Search, ga4: BarChart3, psi: Gauge, crux: Globe2, crawler: Bot, neon: Database };
const labels = { connected: "Conectada", configured: "Configurada pero sin datos", unavailable: "No disponible", error: "Error" };
const tones = { connected: "success", configured: "warning", unavailable: "neutral", error: "error" };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No data";

export function ConfigurationPanel() {
  const { configuration } = useDashboardFilters();
  if (configuration.status === "loading") return <LoadingState />;
  if (configuration.status === "error") return <EmptyState title="Error" detail={configuration.error ?? "Error de conexión."} />;
  return <div className="configuration-panel"><Card><CardHeader title="Fuentes de datos" detail="Estados derivados de configuración y respuestas reales. Nunca se muestran secretos." action={<Settings2 size={17} />} /><div className="configuration-list">{configuration.sources.map((source) => { const Icon = icons[source.key as keyof typeof icons] ?? Globe2; return <div className="configuration-source" key={source.key}><span className="configuration-icon"><Icon size={19} /></span><div><b>{source.name}</b><small>{source.detail}</small><small>Última sincronización: {date(source.lastSync)}</small></div><StatusPill tone={tones[source.status]}>{labels[source.status]}</StatusPill></div>; })}</div></Card></div>;
}
