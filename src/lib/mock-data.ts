export type Trend = "up" | "down" | "steady";
export type Severity = "Alta" | "Media" | "Baja";

export const navItems = [
  { href: "/", label: "Resumen", icon: "LayoutDashboard" },
  { href: "/search-console", label: "Search Console", icon: "Search" },
  { href: "/analytics", label: "Analytics", icon: "BarChart3" },
  { href: "/indexacion", label: "Indexación", icon: "ScanSearch" },
  { href: "/auditoria-tecnica", label: "Auditoría técnica", icon: "ShieldCheck" },
  { href: "/keywords", label: "Keywords", icon: "Target" },
  { href: "/contenido", label: "Contenido", icon: "FileText" },
  { href: "/alertas", label: "Alertas", icon: "Bell" },
  { href: "/configuracion", label: "Configuración", icon: "Settings2" },
] as const;

export const kpis = [
  { label: "Clics orgánicos", value: "24.860", change: "+18,4%", trend: "up" as Trend, icon: "MousePointerClick", color: "aqua" },
  { label: "Impresiones", value: "1,24 M", change: "+12,8%", trend: "up" as Trend, icon: "Eye", color: "violet" },
  { label: "CTR medio", value: "2,01%", change: "+0,24 pp", trend: "up" as Trend, icon: "Percent", color: "orange" },
  { label: "Posición media", value: "11,8", change: "-2,1 posiciones", trend: "up" as Trend, icon: "Crosshair", color: "blue" },
  { label: "Sesiones orgánicas", value: "31.420", change: "+15,6%", trend: "up" as Trend, icon: "Users", color: "green" },
  { label: "Conversiones", value: "846", change: "+9,2%", trend: "up" as Trend, icon: "Sparkles", color: "pink" },
  { label: "URLs indexadas", value: "1.284", change: "+4,6%", trend: "up" as Trend, icon: "Globe2", color: "cyan" },
  { label: "Health score", value: "87/100", change: "+3 pts", trend: "up" as Trend, icon: "HeartPulse", color: "lime" },
];

export const traffic = [42, 48, 44, 57, 54, 63, 61, 72, 68, 78, 73, 86, 81, 94, 91, 108, 102, 119, 115, 130, 126, 143, 139, 156, 151, 166, 163, 178, 174, 191];
export const clicks = [30, 35, 32, 42, 40, 49, 46, 58, 53, 67, 62, 73, 70, 82, 79, 94, 89, 103, 99, 114, 110, 125, 120, 136, 130, 146, 141, 154, 150, 164];
export const impressions = [68, 72, 70, 81, 79, 88, 84, 96, 92, 105, 101, 114, 110, 124, 119, 133, 129, 143, 138, 151, 148, 161, 157, 171, 166, 180, 175, 189, 185, 198];
export const conversions = [18, 20, 18, 24, 22, 27, 26, 32, 29, 36, 34, 39, 37, 44, 42, 49, 46, 53, 50, 57, 55, 61, 59, 65, 62, 69, 67, 73, 71, 78];

export const landingPages = [
  { page: "/servicios/human-risk-management", clicks: "4.820", impressions: "182K", ctr: "2,65%", position: "4,2", language: "ES", trend: "+22%" },
  { page: "/en/services/security-awareness", clicks: "3.940", impressions: "164K", ctr: "2,40%", position: "5,8", language: "EN", trend: "+18%" },
  { page: "/simulacion-de-phishing", clicks: "3.186", impressions: "149K", ctr: "2,14%", position: "7,1", language: "ES", trend: "+11%" },
  { page: "/pt/seguranca-da-informacao", clicks: "2.410", impressions: "98K", ctr: "2,46%", position: "8,4", language: "PT", trend: "+8%" },
  { page: "/recursos/whale-learning", clicks: "1.968", impressions: "91K", ctr: "2,16%", position: "10,2", language: "EN", trend: "+6%" },
];

export const keywords = [
  { keyword: "human risk management", url: "/en/services/human-risk-management", language: "EN", position: "3,4", clicks: "2.840", impressions: "86K", ctr: "3,30%", status: "En crecimiento" },
  { keyword: "security awareness", url: "/en/services/security-awareness", language: "EN", position: "5,8", clicks: "2.410", impressions: "73K", ctr: "3,30%", status: "Top 10" },
  { keyword: "simulación de phishing", url: "/simulacion-de-phishing", language: "ES", position: "4,2", clicks: "2.180", impressions: "68K", ctr: "3,21%", status: "Top 5" },
  { keyword: "concienciación en ciberseguridad", url: "/servicios/awareness", language: "ES", position: "9,6", clicks: "1.320", impressions: "54K", ctr: "2,44%", status: "Oportunidad" },
  { keyword: "gestão de risco humano", url: "/pt/servicos/risco-humano", language: "PT", position: "7,2", clicks: "984", impressions: "31K", ctr: "3,17%", status: "En crecimiento" },
  { keyword: "phishing simulation", url: "/en/phishing-simulation", language: "EN", position: "11,4", clicks: "812", impressions: "29K", ctr: "2,80%", status: "Oportunidad" },
];

export const alerts = [
  { title: "12 URLs han perdido posiciones", detail: "Revisar cambios de contenido en servicios", severity: "Media" as Severity, status: "Pendiente", time: "Hace 2 h" },
  { title: "3 páginas con error 5xx", detail: "Detectadas en el último rastreo técnico", severity: "Alta" as Severity, status: "En revisión", time: "Hace 5 h" },
  { title: "Nuevo grupo de keywords en Top 10", detail: "security culture · awareness training", severity: "Baja" as Severity, status: "Visto", time: "Ayer" },
  { title: "Sitemap actualizado", detail: "18 nuevas URLs encontradas", severity: "Baja" as Severity, status: "Visto", time: "Ayer" },
];

export const technicalIssues = [
  { issue: "Enlaces internos rotos", affected: "14 URLs", category: "Enlaces", severity: "Alta" as Severity, status: "Abierto" },
  { issue: "Meta descriptions duplicadas", affected: "8 URLs", category: "On-page", severity: "Media" as Severity, status: "En progreso" },
  { issue: "Imágenes sin atributo alt", affected: "22 URLs", category: "Accesibilidad", severity: "Baja" as Severity, status: "Abierto" },
  { issue: "Core Web Vitals por mejorar", affected: "6 URLs", category: "Rendimiento", severity: "Media" as Severity, status: "Abierto" },
  { issue: "Cadenas de redirecciones", affected: "3 URLs", category: "Indexación", severity: "Alta" as Severity, status: "Resuelto" },
];

export const contentItems = [
  { title: "Cómo reducir el riesgo humano en tu organización", type: "Blog", language: "ES", status: "Optimizado", score: 94, updated: "12 Jun 2026" },
  { title: "The 2026 Security Awareness Playbook", type: "Recurso", language: "EN", status: "En revisión", score: 78, updated: "08 Jun 2026" },
  { title: "WhaleTalk #18: cultura de seguridad medible", type: "Podcast", language: "ES", status: "Optimizado", score: 91, updated: "02 Jun 2026" },
  { title: "Caso de éxito: Grupo financiero regional", type: "Caso de éxito", language: "ES", status: "Oportunidad", score: 62, updated: "28 May 2026" },
  { title: "Human Risk Management: beyond compliance", type: "Blog", language: "EN", status: "Optimizado", score: 88, updated: "21 May 2026" },
];
