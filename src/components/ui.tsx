"use client";

import { ArrowDownRight, ArrowUpRight, Info, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useDashboardFilters } from "./filter-context";

export function DemoBadge() {
  return <span className="demo-badge"><span className="demo-dot" /> Demo fallback</span>;
}

export function DataSourceBadge({ live, error }: { live: boolean; error?: string }) {
  return <span className={`demo-badge ${live ? "data-live" : ""}`} title={error}><span className="demo-dot" /> {live ? "Live" : "Demo fallback"}</span>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow ?? "SEO Control Center"}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }

export function CardHeader({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) { return <div className="card-header"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>; }

export function Change({ value, trend = "up" }: { value: string; trend?: "up" | "down" | "steady" }) {
  return <span className={`change ${trend}`}>{trend === "up" ? <ArrowUpRight size={13} /> : trend === "down" ? <ArrowDownRight size={13} /> : null}{value}</span>;
}

export function EmptyState({ title = "No hay datos todavía", detail = "Conecta una fuente de datos para empezar a ver resultados." }: { title?: string; detail?: string }) {
  return <div className="state-box"><Info size={18} /><strong>{title}</strong><span>{detail}</span></div>;
}

export function LoadingState() { return <div className="state-box"><LoaderCircle className="spin" size={20} /><strong>Cargando datos</strong><span>Consultando la fuente seleccionada.</span></div>; }

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) { return <span className={`status-pill ${tone}`}>{children}</span>; }

export function FilterBar() {
  const { filters, updateFilter, refresh } = useDashboardFilters();
  return <div className="filter-bar"><label>Periodo<select value={filters.days} onChange={(event) => updateFilter("days", event.target.value)}><option value="7">Últimos 7 días</option><option value="28">Últimos 28 días</option><option value="60">Últimos 60 días</option><option value="90">Últimos 90 días</option></select></label><label>Idioma<select value={filters.language} onChange={(event) => updateFilter("language", event.target.value)}><option value="all">Todos</option><option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option></select></label><label>País<select value={filters.country} onChange={(event) => updateFilter("country", event.target.value)}><option value="all">Todos</option><option value="ES">España</option><option value="MX">México</option><option value="US">Estados Unidos</option><option value="GB">Reino Unido</option><option value="PT">Portugal</option></select></label><label>Dispositivo<select value={filters.device} onChange={(event) => updateFilter("device", event.target.value)}><option value="all">Todos</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option><option value="tablet">Tablet</option></select></label><label>Página<input value={filters.page ?? ""} placeholder="/ruta" onChange={(event) => updateFilter("page", event.target.value)} /></label><label>Query<input value={filters.query ?? ""} placeholder="término" onChange={(event) => updateFilter("query", event.target.value)} /></label><button className="outline-button small" onClick={refresh}><LoaderCircle size={14} /> Actualizar</button></div>;
}
