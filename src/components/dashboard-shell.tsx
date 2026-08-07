"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Bell, ChevronDown, FileText, LayoutDashboard, Menu, Search, Settings2, ShieldCheck, Target, X } from "lucide-react";
import type { IntegrationFilters } from "@/lib/integrations";
import { FilterContext, type FilterContextValue } from "./filter-context";

const navItems = [{ href: "/", label: "Resumen", icon: LayoutDashboard }, { href: "/search-console", label: "Search Console", icon: Search }, { href: "/analytics", label: "Analytics", icon: BarChart3 }, { href: "/auditoria-tecnica", label: "Auditoría técnica", icon: ShieldCheck }, { href: "/keywords", label: "Keywords", icon: Target }, { href: "/contenido", label: "Contenido", icon: FileText }, { href: "/alertas", label: "Alertas", icon: Bell }, { href: "/configuracion", label: "Configuración", icon: Settings2 }] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) { return <Suspense fallback={<div className="state-box">Cargando dashboard...</div>}><DashboardContent>{children}</DashboardContent></Suspense>; }

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const rawDays = Number(searchParams.get("days"));
  const defaultDays = pathname.startsWith("/search-console") ? 30 : 28;
  const filters: IntegrationFilters = { days: ([7, 28, 30, 60, 90].includes(rawDays) ? rawDays : defaultDays) as IntegrationFilters["days"], language: (searchParams.get("language") ?? "all") as IntegrationFilters["language"], country: searchParams.get("country") ?? "all", device: (searchParams.get("device") ?? "all") as IntegrationFilters["device"], page: searchParams.get("page") ?? undefined, query: searchParams.get("query") ?? undefined };
  const updateFilter = (key: keyof IntegrationFilters, value: string) => { const next = new URLSearchParams(searchParams.toString()); if (!value || value === "all") next.delete(key); else next.set(key, value); router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false }); };
  const context: FilterContextValue = { filters, refreshKey, updateFilter, refresh: () => setRefreshKey((value) => value + 1) };
  return <FilterContext.Provider value={context}><div className="app-shell"><aside className={`sidebar ${open ? "open" : ""}`}><div className="brand"><Image src="/whalemate-logo-header.webp" alt="whalemate" width={195} height={30} priority /><button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="workspace"><span className="workspace-avatar">W</span><span><b>Whalemate</b><small>Fuentes reales</small></span><ChevronDown size={15} /></div><nav aria-label="Navegación principal">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={href === "/" ? pathname === "/" ? "active" : "" : pathname.startsWith(href) ? "active" : ""} onClick={() => setOpen(false)}><Icon size={18} /><span>{label}</span></Link>)}</nav><div className="sidebar-bottom"><div className="sync-note"><span className="live-dot" />Fuentes conectadas<small>Datos reales, sin mocks</small></div><button className="user-menu"><span className="user-avatar">WM</span><span><b>Whalemate</b><small>SEO Team</small></span><ChevronDown size={15} /></button></div></aside><main className="main-content"><header className="topbar"><button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><Image src="/whalemate-logo-header.webp" alt="whalemate" width={142} height={22} className="topbar-logo" /><span>SEO Control Center</span><b>/</b><strong>{pathname === "/" ? "Resumen" : navItems.find((item) => pathname.startsWith(item.href) && item.href !== "/")?.label ?? "Panel"}</strong></div><div className="top-actions"><span className="data-badge"><span className="data-dot" /> Fuentes reales</span><button className="icon-button" aria-label="Buscar"><Search size={17} /></button><button className="notification" aria-label="Notificaciones"><Bell size={17} /><i>3</i></button><span className="top-avatar">WM</span></div></header><div className="page-content">{children}</div></main></div></FilterContext.Provider>;
}
