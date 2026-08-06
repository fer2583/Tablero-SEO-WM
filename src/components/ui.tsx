import { ArrowDownRight, ArrowUpRight, Info, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

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

export function LoadingState() { return <div className="state-box"><LoaderCircle className="spin" size={20} /><strong>Cargando datos demo</strong><span>Preparando la próxima sincronización.</span></div>; }

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) { return <span className={`status-pill ${tone}`}>{children}</span>; }

export function FilterBar() {
  return <div className="filter-bar"><label>Periodo<select defaultValue="30"><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option></select></label><label>Idioma<select defaultValue="all"><option value="all">Todos los idiomas</option><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select></label><label>Dispositivo<select defaultValue="all"><option value="all">Todos</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label><label>Mercado<select defaultValue="all"><option value="all">Todos los mercados</option><option value="latam">LatAm</option><option value="eu">Europa</option><option value="us">United States</option></select></label></div>;
}
