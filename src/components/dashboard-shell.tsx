"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu, X, Moon } from "lucide-react";
import * as Icons from "lucide-react";
import { navItems } from "@/lib/mock-data";
import { DemoBadge } from "./ui";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <Image src="/whalemate-logo-header.webp" alt="Whalemate" width={195} height={28} priority />
          <span><small>SEO Control Center</small></span>
          <button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace"><span className="workspace-avatar">W</span><span><b>Whalemate global</b><small>Proyecto principal</small></span><ChevronDown size={15} /></div>
        <nav aria-label="Navegación principal">
          {navItems.map((item) => {
            const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[item.icon];
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}><Icon size={18} /><span>{item.label}</span>{item.href === "/alertas" && <i>4</i>}</Link>;
          })}
        </nav>
        <div className="sidebar-bottom"><div className="sync-note"><span className="live-dot" /> Demo local <small>Sin conexiones activas</small></div><button className="user-menu"><span className="user-avatar">JM</span><span><b>Javier M.</b><small>Administrador</small></span><ChevronDown size={14} /></button></div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <Image className="topbar-logo" src="/whalemate-logo-header.webp" alt="Whalemate" width={195} height={28} priority />
          <div className="breadcrumb"><span>Whalemate</span><b>/</b><strong>{navItems.find((item) => item.href === pathname)?.label ?? "Resumen"}</strong></div>
          <div className="top-actions"><DemoBadge /><button className="icon-button" aria-label="Cambiar tema"><Moon size={18} /></button><button className="notification" aria-label="Ver alertas"><Bell size={18} /><i>4</i></button><div className="top-avatar">JM</div></div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
