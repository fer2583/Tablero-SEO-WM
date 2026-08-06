"use client";

import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { LineChart, Donut } from "@/components/charts";
import { Card, CardHeader, Change, FilterBar, SectionHeading, StatusPill } from "@/components/ui";
import { DataTable, type TableColumn } from "@/components/data-table";
import { alerts, clicks, conversions, impressions, landingPages, traffic } from "@/lib/mock-data";
import { SummaryLive } from "@/components/integration-panels";

export default function Home() {
  return (
    <DashboardShell>
      <SectionHeading eyebrow="Resumen ejecutivo" title="Buenos días, Javier" description="Una lectura rápida del rendimiento orgánico de Whalemate." action={<button className="outline-button"><CalendarDays size={16} /> 01 jun — 30 jun 2026 <ChevronRight size={14} /></button>} />
      <div className="demo-banner"><SummaryLive /></div>
      <FilterBar />
       <div className="dashboard-grid">
         <Card className="wide-card"><CardHeader title="Tráfico orgánico" detail="Demo visual · conectar GA4 para series live" action={<div className="legend"><span className="legend-aqua" /> Demo actual <span className="legend-muted" /> Demo anterior</div>} /><LineChart values={traffic} secondary={clicks} /></Card>
        <Card><CardHeader title="Health score" detail="Estado técnico del proyecto" /><div className="score-layout"><Donut /><div><strong className="score-number">87<span>/100</span></strong><p>Muy buen estado</p><Change value="+3 pts vs. periodo anterior" /></div></div><div className="score-footer"><span><i className="dot good" /> Saludable <b>82%</b></span><span><i className="dot warning" /> A revisar <b>18%</b></span></div></Card>
      </div>
      <div className="dashboard-grid second-row">
         <Card className="wide-card"><CardHeader title="Clicks e impresiones" detail="Demo visual · rendimiento en búsquedas" action={<button className="text-button">Ver Search Console <ArrowRight size={14} /></button>} /><LineChart values={clicks} secondary={impressions} color="#002DF0" /></Card>
         <Card><CardHeader title="Conversiones" detail="Demo visual · atribución orgánica" /><LineChart values={conversions} color="#0266F2" height={150} /><div className="conversion-total"><strong>846</strong><Change value="+9,2%" /><span>conversiones demo</span></div></Card>
      </div>
       <div className="dashboard-grid tables-row">
         <Card className="table-card"><CardHeader title="Top organic paths" detail="Search Console · datos demo hasta activar la conexión" action={<button className="text-button">Ver todas <ArrowRight size={14} /></button>} /><DataTable rows={landingPages} columns={landingColumns} rowKey={(row) => row.page} label="organic paths" pageSize={5} demo /></Card>
        <Card><CardHeader title="Alertas recientes" detail="Lo que requiere atención" action={<button className="text-button">Ver todas <ArrowRight size={14} /></button>} /><div className="alert-list">{alerts.slice(0, 3).map((alert) => <div className="alert-item" key={alert.title}><div className={`severity ${alert.severity.toLowerCase()}`} /><div><b>{alert.title}</b><span>{alert.detail}</span></div><StatusPill tone={alert.severity.toLowerCase()}>{alert.severity}</StatusPill></div>)}</div><div className="all-clear"><CheckCircle2 size={16} /> 2 tareas completadas esta semana</div></Card>
      </div>
    </DashboardShell>
  );
}

const landingColumns: TableColumn<typeof landingPages[number]>[] = [
  { key: "page", label: "Página", sortValue: (row) => row.page, filter: "text", render: (row) => <><b>{row.page}</b><small>whalemate.com</small></> },
  { key: "clicks", label: "Clicks", sortValue: (row) => Number(row.clicks.replaceAll(".", "")), filter: "number", render: (row) => row.clicks },
  { key: "impressions", label: "Impresiones", sortValue: (row) => Number(row.impressions.replace("K", "000")), filter: "number", render: (row) => row.impressions },
  { key: "ctr", label: "CTR", sortValue: (row) => Number(row.ctr.replace(",", ".").replace("%", "")), filter: "number", render: (row) => row.ctr },
  { key: "position", label: "Posición", sortValue: (row) => Number(row.position.replace(",", ".")), filter: "number", render: (row) => row.position },
  { key: "language", label: "Idioma", sortValue: (row) => row.language, filter: "select", options: ["ES", "EN", "PT"], render: (row) => <span className="language">{row.language}</span> },
  { key: "trend", label: "Tendencia", sortValue: (row) => Number(row.trend.replace("%", "")), filter: "number", render: (row) => <span className="trend-up">↗ {row.trend}</span> },
];
