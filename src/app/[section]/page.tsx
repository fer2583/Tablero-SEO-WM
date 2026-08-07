"use client";

import { ArrowRight, CheckCircle2, LayoutGrid, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Donut } from "@/components/charts";
import { alerts, contentItems, keywords } from "@/lib/mock-data";
import { Card, CardHeader, Change, DemoBadge, EmptyState, FilterBar, SectionHeading, StatusPill } from "@/components/ui";
import { DataTable, type TableColumn } from "@/components/data-table";
import { AnalyticsLive, SearchConsoleLive } from "@/components/integration-panels";
import { AuditPanel } from "@/components/audit-panel";

const titles: Record<string, [string, string, string]> = {
  "search-console": ["Search Console", "Rendimiento de búsqueda orgánica", "Consulta clicks, impresiones y oportunidades de visibilidad."],
  analytics: ["Analytics", "El tráfico que mueve el negocio", "Sesiones, engagement y conversiones atribuidas al canal orgánico."],
  indexacion: ["Indexación", "Cobertura del sitio", "Entiende qué URLs puede descubrir y servir Google."],
  "auditoria-tecnica": ["Auditoría técnica", "La salud detrás del ranking", "Issues priorizados para mantener una base técnica sólida."],
  keywords: ["Keywords", "El lenguaje de tu audiencia", "Keywords prioritarias por idioma y oportunidad de crecimiento."],
  contenido: ["Contenido", "Contenido que encuentra a las personas", "Una vista editorial de las piezas que sostienen tu estrategia SEO."],
  alertas: ["Alertas", "Señales para actuar a tiempo", "Un centro de control para cambios relevantes y tareas SEO."],
  configuracion: ["Configuración", "Personaliza tu centro de control", "Conexiones y preferencias estarán disponibles en la siguiente fase."],
};

export default function SectionPage() {
  const params = useParams<{ section: string }>(); const section = params.section; const [label, title, description] = titles[section] ?? titles.configuracion;
  return <DashboardShell><SectionHeading eyebrow={label} title={title} description={description} action={<DemoBadge />} />{section === "search-console" && <SearchConsole />}{section === "analytics" && <Analytics />}{section === "indexacion" && <Indexing />}{section === "auditoria-tecnica" && <TechnicalAudit />}{section === "keywords" && <Keywords />}{section === "contenido" && <Content />}{section === "alertas" && <Alerts />}{section === "configuracion" && <Configuration />}</DashboardShell>;
}

function SearchConsole() { return <><FilterBar /><SearchConsoleLive /></>; }

function Analytics() { return <><FilterBar /><AnalyticsLive /></>; }

function Indexing() { return <><div className="indexing-hero"><Card><div className="index-score"><Donut value={84} label="URLs válidas" /><div><span className="eyebrow">Cobertura demo</span><strong>1.284 <small>URLs válidas</small></strong><Change value="+4,6% vs. periodo anterior" /></div></div></Card><div className="index-stat-grid"><Metric label="Indexadas" value="1.284" change="+4,6%" /><Metric label="No indexadas" value="164" change="-8,2%" /><Metric label="Redirecciones" value="48" change="+2,1%" /><Metric label="Errores" value="12" change="-14,3%" /></div></div><Card><CardHeader title="Distribución de cobertura" detail="Estado de URLs detectadas en el sitemap" /><div className="coverage-list"><Coverage label="Indexadas" value="84%" count="1.284" tone="aqua" /><Coverage label="Excluidas correctamente" value="9%" count="136" tone="violet" /><Coverage label="Pendientes de revisión" value="5%" count="76" tone="orange" /><Coverage label="Errores" value="2%" count="12" tone="pink" /></div></Card><Card><EmptyState title="Integración de inspección pendiente" detail="Conecta Search Console para revisar cobertura URL a URL en la siguiente fase." /></Card></>; }

function TechnicalAudit() { return <AuditPanel />; }

function Keywords() { return <><div className="keyword-callout"><div className="callout-icon"><Search size={20} /></div><div><strong>Oportunidades detectadas</strong><p>12 keywords demo están a menos de 3 posiciones del Top 10.</p></div><button className="text-button">Ver oportunidades <ArrowRight size={14} /></button></div><Card><CardHeader title="Keywords prioritarias" detail="Términos reales de Whalemate · métricas de demostración" /><DataTable rows={keywords} columns={keywordColumns} rowKey={(row) => row.keyword} label="keywords" demo /></Card></>; }

function Content() { return <><div className="content-summary"><Metric label="Piezas publicadas" value="48" change="+6 este mes" /><Metric label="Optimización media" value="83/100" change="+5 pts" /><Metric label="Oportunidades" value="9" change="-2" /></div><Card><CardHeader title="Biblioteca de contenido" detail="Demo · Blog, podcast y casos de éxito" action={<button className="outline-button small"><LayoutGrid size={14} /> Vista tabla</button>} /><DataTable rows={contentItems} columns={contentColumns} rowKey={(row) => row.title} label="contenido" demo /></Card></>; }

function Alerts() { return <><div className="alert-overview"><Metric label="Alertas abiertas" value="4" change="-2 esta semana" /><Metric label="Alta prioridad" value="1" change="-1" /><Metric label="Resueltas" value="18" change="+6 este mes" /></div><Card><CardHeader title="Todas las alertas" detail="Demo · cambios y eventos SEO relevantes" action={<span className="demo-label">Demo</span>} /><DataTable rows={alerts} columns={alertColumns} rowKey={(row) => row.title} label="alertas" demo /></Card></>; }

function Configuration() { return <div className="settings-grid"><Card><CardHeader title="Fuentes de datos" detail="Las conexiones se habilitarán en la próxima fase." /><Setting icon="G" title="Google Search Console" detail="Clicks, impresiones, posición e indexación" /><Setting icon="A" title="Google Analytics 4" detail="Sesiones, engagement y conversiones" /><Setting icon="S" title="Screaming Frog / auditoría" detail="Rastreo técnico del sitio" /></Card><Card><CardHeader title="Preferencias" detail="Configura cómo quieres recibir señales." /><Setting icon="⌁" title="Frecuencia de alertas" detail="Resumen semanal · lunes 09:00" /><Setting icon="◎" title="Mercados monitorizados" detail="ES · EN · PT" /><Setting icon="◐" title="Zona horaria" detail="Europe/Madrid (UTC+2)" /></Card><Card className="settings-note"><CheckCircle2 size={24} /><h3>Todo listo para la siguiente fase</h3><p>El frontend está preparado para conectar fuentes reales sin cambiar la experiencia de navegación.</p><button className="outline-button">Documentación de integración <ArrowRight size={15} /></button></Card></div>; }

function Metric({ label, value, change }: { label: string; value: string; change: string }) { return <Card className="metric-card"><span>{label}</span><strong>{value}</strong><Change value={change} /></Card>; }
function Coverage({ label, value, count, tone }: { label: string; value: string; count: string; tone: string }) { return <div className="coverage"><div><span className={`coverage-dot ${tone}`} /><b>{label}</b><small>{count} URLs</small></div><div className="coverage-bar"><i className={tone} style={{ width: value }} /></div><strong>{value}</strong></div>; }
function Setting({ icon, title, detail }: { icon: string; title: string; detail: string }) { return <div className="setting"><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div><StatusPill>Próximamente</StatusPill></div>; }

const keywordColumns: TableColumn<typeof keywords[number]>[] = [
  { key: "keyword", label: "Keyword", sortValue: (row) => row.keyword, filter: "text" },
  { key: "url", label: "URL", sortValue: (row) => row.url, filter: "text" },
  { key: "language", label: "Idioma", sortValue: (row) => row.language, filter: "select", options: ["ES", "EN", "PT"], render: (row) => <span className="language">{row.language}</span> },
  { key: "position", label: "Posición", sortValue: (row) => Number(row.position.replace(",", ".")), filter: "number", render: (row) => <strong>{row.position}</strong> },
  { key: "clicks", label: "Clicks", sortValue: (row) => Number(row.clicks.replaceAll(".", "")), filter: "number" },
  { key: "impressions", label: "Impresiones", sortValue: (row) => Number(row.impressions.replace("K", "000")), filter: "number" },
  { key: "ctr", label: "CTR", sortValue: (row) => Number(row.ctr.replace(",", ".").replace("%", "")), filter: "number" },
  { key: "status", label: "Estado", sortValue: (row) => row.status, filter: "select", options: ["En crecimiento", "Top 10", "Top 5", "Oportunidad"], render: (row) => <StatusPill tone={row.status === "Top 5" ? "success" : row.status === "Oportunidad" ? "orange" : "violet"}>{row.status}</StatusPill> },
];
const contentColumns: TableColumn<typeof contentItems[number]>[] = [
  { key: "title", label: "Contenido", sortValue: (row) => row.title, filter: "text" },
  { key: "type", label: "Tipo", sortValue: (row) => row.type, filter: "select", options: ["Blog", "Recurso", "Podcast", "Caso de éxito"] },
  { key: "language", label: "Idioma", sortValue: (row) => row.language, filter: "select", options: ["ES", "EN"], render: (row) => <span className="language">{row.language}</span> },
  { key: "status", label: "Estado SEO", sortValue: (row) => row.status, filter: "select", options: ["Optimizado", "En revisión", "Oportunidad"], render: (row) => <StatusPill tone={row.score > 85 ? "success" : row.score > 70 ? "violet" : "orange"}>{row.status}</StatusPill> },
  { key: "score", label: "Score", sortValue: (row) => row.score, filter: "number", render: (row) => <strong className={row.score > 85 ? "score-good" : "score-watch"}>{row.score}</strong> },
  { key: "updated", label: "Actualizado", sortValue: (row) => row.updated, filter: "text" },
];
const alertColumns: TableColumn<typeof alerts[number]>[] = [
  { key: "title", label: "Alerta", sortValue: (row) => row.title, filter: "text", render: (row) => <><b>{row.title}</b><small>{row.detail} · {row.time}</small></> },
  { key: "severity", label: "Severidad", sortValue: (row) => row.severity, filter: "select", options: ["Alta", "Media", "Baja"], render: (row) => <StatusPill tone={row.severity.toLowerCase()}>{row.severity}</StatusPill> },
  { key: "status", label: "Estado", sortValue: (row) => row.status, filter: "select", options: ["Pendiente", "En revisión", "Visto"], render: (row) => <StatusPill tone={row.status === "Visto" ? "success" : "neutral"}>{row.status}</StatusPill> },
];
