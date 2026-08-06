import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { LineChart, Donut } from "@/components/charts";
import { Card, CardHeader, Change, DemoBadge, FilterBar, SectionHeading, StatusPill } from "@/components/ui";
import { alerts, clicks, conversions, impressions, kpis, landingPages, traffic } from "@/lib/mock-data";

export default function Home() {
  return (
    <DashboardShell>
      <SectionHeading eyebrow="Resumen ejecutivo" title="Buenos días, Javier" description="Una lectura rápida del rendimiento orgánico de Whalemate." action={<button className="outline-button"><CalendarDays size={16} /> 01 jun — 30 jun 2026 <ChevronRight size={14} /></button>} />
      <div className="demo-banner"><DemoBadge /><span>Los datos mostrados son una maqueta funcional. No representan métricas reales.</span></div>
      <FilterBar />
      <div className="kpi-grid">{kpis.map((kpi) => <Card key={kpi.label} className="kpi-card"><div className={`kpi-icon ${kpi.color}`}><TrendingUp size={17} /></div><span className="kpi-label">{kpi.label}</span><strong>{kpi.value}</strong><Change value={kpi.change} /></Card>)}</div>
      <div className="dashboard-grid">
        <Card className="wide-card"><CardHeader title="Tráfico orgánico" detail="Sesiones · últimos 30 días" action={<div className="legend"><span className="legend-aqua" /> Este periodo <span className="legend-muted" /> Periodo anterior</div>} /><LineChart values={traffic} secondary={clicks} /></Card>
        <Card><CardHeader title="Health score" detail="Estado técnico del proyecto" /><div className="score-layout"><Donut /><div><strong className="score-number">87<span>/100</span></strong><p>Muy buen estado</p><Change value="+3 pts vs. periodo anterior" /></div></div><div className="score-footer"><span><i className="dot good" /> Saludable <b>82%</b></span><span><i className="dot warning" /> A revisar <b>18%</b></span></div></Card>
      </div>
      <div className="dashboard-grid second-row">
        <Card className="wide-card"><CardHeader title="Clicks e impresiones" detail="Rendimiento en búsquedas" action={<button className="text-button">Ver Search Console <ArrowRight size={14} /></button>} /><LineChart values={clicks} secondary={impressions} color="#002DF0" /></Card>
        <Card><CardHeader title="Conversiones" detail="Atribución orgánica" /><LineChart values={conversions} color="#0266F2" height={150} /><div className="conversion-total"><strong>846</strong><Change value="+9,2%" /><span>conversiones demo</span></div></Card>
      </div>
      <div className="dashboard-grid tables-row">
        <Card className="table-card"><CardHeader title="Landing pages principales" detail="Páginas que más tráfico orgánico generan" action={<button className="text-button">Ver todas <ArrowRight size={14} /></button>} /><div className="table-scroll"><table><thead><tr><th>Página</th><th>Clics</th><th>Impresiones</th><th>CTR</th><th>Posición</th><th>Idioma</th><th>Tendencia</th></tr></thead><tbody>{landingPages.map((page) => <tr key={page.page}><td><b>{page.page}</b><small>whalemate.com</small></td><td>{page.clicks}</td><td>{page.impressions}</td><td>{page.ctr}</td><td>{page.position}</td><td><span className="language">{page.language}</span></td><td><span className="trend-up">↗ {page.trend}</span></td></tr>)}</tbody></table></div></Card>
        <Card><CardHeader title="Alertas recientes" detail="Lo que requiere atención" action={<button className="text-button">Ver todas <ArrowRight size={14} /></button>} /><div className="alert-list">{alerts.slice(0, 3).map((alert) => <div className="alert-item" key={alert.title}><div className={`severity ${alert.severity.toLowerCase()}`} /><div><b>{alert.title}</b><span>{alert.detail}</span></div><StatusPill tone={alert.severity.toLowerCase()}>{alert.severity}</StatusPill></div>)}</div><div className="all-clear"><CheckCircle2 size={16} /> 2 tareas completadas esta semana</div></Card>
      </div>
    </DashboardShell>
  );
}
