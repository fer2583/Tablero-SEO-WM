"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, ChevronDown, Menu, Moon, X } from "lucide-react";
import * as Icons from "lucide-react";
import { navItems } from "@/lib/mock-data";
import type { IntegrationFilters } from "@/lib/integrations";
import { DemoBadge } from "./ui";
import { FilterContext, type FilterContextValue } from "./filter-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="state-box">Cargando dashboard...</div>}><DashboardContent>{children}</DashboardContent></Suspense>;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const rawDays = Number(searchParams.get("days"));
  const rawLanguage = searchParams.get("language") ?? "all";
  const rawDevice = searchParams.get("device") ?? "all";
  const filters: IntegrationFilters = { days: ([7, 28, 60, 90].includes(rawDays) ? rawDays : 28) as IntegrationFilters["days"], language: (["all", "es", "en", "pt"].includes(rawLanguage) ? rawLanguage : "all") as IntegrationFilters["language"], country: searchParams.get("country") ?? "all", device: (["all", "desktop", "mobile", "tablet"].includes(rawDevice) ? rawDevice : "all") as IntegrationFilters["device"], page: searchParams.get("page") ?? undefined, query: searchParams.get("query") ?? undefined };
  const updateFilter = (key: keyof IntegrationFilters, value: string) => { const next = new URLSearchParams(searchParams.toString()); if (!value || value === "all") next.delete(key); else next.set(key, value); router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false }); };
  const context: FilterContextValue = { filters, refreshKey, updateFilter, refresh: () => setRefreshKey((value) => value + 1) };
  const iconFor = (icon: string) => (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[icon];

  return <FilterContext.Provider value={context}><div className="app-shell"><aside className={`sidebar ${open ? "open" : ""}`}><div className="brand"><Image src="/whalemate-logo-header.webp" alt="Whalemate" width={195} height={28} priority /><span><small>SEO Control Center</small></span><button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="workspace"><span className="workspace-avatar">W</span><span><b>Whalemate global</b><small>Proyecto principal</small></span><ChevronDown size={15} /></div><nav aria-label="Navegación principal">{navItems.map((item) => { const Icon = iconFor(item.icon); const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}><Icon size={18} /><span>{item.label}</span>{item.href === "/alertas" && <i>4</i>}</Link>; })}</nav><div className="sidebar-bottom"><div className="sync-note"><span className="live-dot" /> Datos conectados / demo <small>La fuente se indica en cada panel</small></div><button className="user-menu"><span className="user-avatar">JM</span><span><b>Javier M.</b><small>Administrador</small></span><ChevronDown size={14} /></button></div></aside><main className="main-content"><header className="topbar"><button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={20} /></button><Image className="topbar-logo" src="/whalemate-logo-header.webp" alt="Whalemate" width={195} height={28} priority /><div className="breadcrumb"><span>Whalemate</span><b>/</b><strong>{navItems.find((item) => item.href === pathname)?.label ?? "Resumen"}</strong></div><div className="top-actions"><DemoBadge /><button className="icon-button" aria-label="Cambiar tema"><Moon size={18} /></button><button className="notification" aria-label="Ver alertas"><Bell size={18} /><i>4</i></button><div className="top-avatar">JM</div></div></header><div className="page-content">{children}</div></main></div></FilterContext.Provider>;
}
