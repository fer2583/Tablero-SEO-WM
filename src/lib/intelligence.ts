import "server-only";

import { SITE_URL } from "@/lib/site";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { dates, type IntegrationFilters } from "@/lib/integrations";
import { fetchKeywords } from "@/lib/keywords";
import { fetchAiSearch, type AiSearchData } from "@/lib/ai-search";
import { buildMentionsPayload } from "@/lib/ai-mentions";
import { evaluateAlerts, type AlertEvaluation } from "@/lib/alerts";
import { getLatestAuditIssueCounts, getLatestAuditSnapshot, getLatestAuditVitals } from "@/db/queries";
import type { IntelligencePayload, IntelligenceSignal, SignalConfidence, SignalEffort } from "@/lib/intelligence-types";

const CONFIDENCE_WEIGHT: Record<SignalConfidence, number> = { alta: 1, media: 0.7, baja: 0.4 };
const EFFORT_WEIGHT: Record<SignalEffort, number> = { bajo: 1, medio: 0.7, alto: 0.45 };

const scoreOf = (impact: number, confidence: SignalConfidence, effort: SignalEffort) =>
  Math.max(1, Math.min(100, Math.round(impact * CONFIDENCE_WEIGHT[confidence] * EFFORT_WEIGHT[effort] * 10) / 10));

const ALERT_HREF: Record<string, string> = {
  GSC: "/search-console",
  GA4: "/analytics",
  Auditoría: "/auditoria-tecnica",
  CWV: "/auditoria-tecnica",
  Indexación: "/configuracion",
  Integraciones: "/configuracion",
};

const severityWeight: Record<string, number> = { critical: 80, high: 70, medium: 45, low: 20 };

export async function buildIntelligence(filters: IntegrationFilters): Promise<IntelligencePayload> {
  const generatedAt = new Date().toISOString();
  const period = dates(filters.days);
  const db = databaseConfigured();

  const [keywords, ai, mentions, alerts, auditData] = await Promise.all([
    fetchKeywords(filters).catch(() => null),
    fetchAiSearch(filters).catch(() => null),
    buildMentionsPayload(),
    db ? evaluateAlerts().catch(() => null) : Promise.resolve(null),
    db
      ? Promise.all([getLatestAuditSnapshot(SITE_URL), getLatestAuditIssueCounts(SITE_URL), getLatestAuditVitals(SITE_URL)]).catch(() => null)
      : Promise.resolve(null),
  ]);

  const signals: IntelligenceSignal[] = [];
  const push = (signal: Omit<IntelligenceSignal, "score">) => {
    signals.push({ ...signal, score: scoreOf(signal.impact, signal.confidence, signal.effort) });
  };

  if (keywords) {
    const seenQueries = new Set<string>();
    for (const row of keywords.opportunities) {
      if (seenQueries.has(row.query)) continue;
      const potential = row.potentialClicks ?? 0;
      if (potential < 5) continue;
      seenQueries.add(row.query);
      push({
        id: `kw-${row.query}`,
        category: "oportunidad",
        title: `Recuperar clics en "${row.query}"`,
        detail: `Posición ${row.position.toFixed(1).replace(".", ",")} con ${row.impressions} impresiones y CTR ${(row.ctr * 100).toFixed(1).replace(".", ",")}%. El potencial estimado es +${potential} clics.`,
        metric: `+${potential} clics potenciales`,
        impact: Math.min(90, 25 + potential * 2),
        confidence: row.impressions >= 300 ? "alta" : "media",
        effort: "medio",
        href: "/keywords",
        evidence: row.expectedCtr == null ? undefined : `CTR esperado en posición ${row.position.toFixed(1).replace(".", ",")}: ${(row.expectedCtr * 100).toFixed(1).replace(".", ",")}%.`,
      });
      if (seenQueries.size >= 3) break;
    }

    for (const row of keywords.cannibalization.filter((item) => item.pages.length > 1).slice(0, 2)) {
      push({
        id: `cannibalization-${row.query}`,
        category: "oportunidad",
        title: `Canibalización en "${row.query}"`,
        detail: `${row.pages.length} URLs compiten por la misma consulta. Ej.: ${row.pages.slice(0, 3).map((page) => pathOf(page)).join(" · ")}${row.pages.length > 3 ? ` y ${row.pages.length - 3} más` : ""}. Requiere revisión editorial.`,
        metric: `${row.impressions} impresiones en juego`,
        impact: Math.min(70, 15 + Math.round(row.impressions / 50)),
        confidence: "media",
        effort: "alto",
        href: "/keywords",
      });
    }
  }

  if (auditData) {
    const [snapshot, counts, vitals] = auditData;
    const report = (snapshot?.snapshot as { report?: { score?: number | null } } | undefined)?.report;
    const score = report?.score ?? null;
    const high = counts.find((item) => item.severity === "Alta")?.count ?? 0;
    const medium = counts.find((item) => item.severity === "Media")?.count ?? 0;

    if (high > 0) {
      push({
        id: "audit-high",
        category: "tecnico",
        title: `${high} issues técnicas de severidad alta`,
        detail: `La última auditoría (${snapshot?.completedAt ? new Date(snapshot.completedAt).toLocaleDateString("es-ES") : "sin fecha"}) detectó ${high} incidencias altas y ${medium} medias. Revisar antes de que afecten rastreo o indexación.`,
        metric: `${high} altas`,
        impact: Math.min(85, 60 + high * 5),
        confidence: "alta",
        effort: "medio",
        href: "/auditoria-tecnica",
      });
    }

    if (score != null && score < 80) {
      push({
        id: "audit-score",
        category: "tecnico",
        title: `Salud técnica en ${score}/100`,
        detail: "La puntuación ponderada del crawler está por debajo de 80. Priorizar categorías con peor score y mayor cantidad de evaluaciones.",
        metric: `${score}/100`,
        impact: 100 - score,
        confidence: "alta",
        effort: "alto",
        href: "/auditoria-tecnica",
      });
    }

    const crux = vitals.find((item) => item.kind === "crux" && item.device === "mobile" && item.status === "live") ?? vitals.find((item) => item.kind === "crux" && item.status === "live");
    const metrics = (crux?.metrics ?? {}) as Record<string, number | null>;
    const lcp = metrics.lcp;
    const inp = metrics.inp;
    const cls = metrics.cls;
    const worst =
      lcp != null && lcp > 4000
        ? { label: "LCP", value: `${(lcp / 1000).toFixed(1).replace(".", ",")} s`, impact: 85, limit: "≤ 2,5 s" }
        : inp != null && inp > 500
          ? { label: "INP", value: `${Math.round(inp)} ms`, impact: 80, limit: "≤ 200 ms" }
          : cls != null && cls > 0.25
            ? { label: "CLS", value: cls.toFixed(3).replace(".", ","), impact: 70, limit: "≤ 0,1" }
            : null;
    if (worst) {
      push({
        id: `cwv-${worst.label}`,
        category: "tecnico",
        title: `${worst.label} fuera de rango en móvil`,
        detail: `CrUX reporta ${worst.label} ${worst.value} (objetivo ${worst.limit}) en usuarios reales. Revisar el diagnóstico de PageSpeed y las oportunidades de Lighthouse.`,
        metric: `${worst.label} ${worst.value}`,
        impact: worst.impact,
        confidence: "alta",
        effort: "alto",
        href: "/auditoria-tecnica",
      });
    }
  }

  if (alerts) {
    const active = (alerts as AlertEvaluation).alerts.filter((alert) => alert.status !== "resolved");
    for (const alert of active.filter((item) => item.severity === "critical" || item.severity === "high").slice(0, 2)) {
      push({
        id: `alert-${alert.id}`,
        category: "alerta",
        title: alert.title,
        detail: alert.message,
        metric: alert.metric
          ? `${alert.metric}: ${alert.currentValue == null ? "—" : alert.currentValue.toLocaleString("es-ES", { maximumFractionDigits: 2 })} vs ${alert.previousValue == null ? "—" : alert.previousValue.toLocaleString("es-ES", { maximumFractionDigits: 2 })}`
          : undefined,
        impact: severityWeight[alert.severity] ?? 50,
        confidence: "alta",
        effort: "medio",
        href: ALERT_HREF[alert.source] ?? "/alertas",
      });
    }
  }

  if (ai) {
    const data = ai as AiSearchData;
    if (data.previous.sessions >= 5 && data.metrics.sessions < data.previous.sessions * 0.75) {
      const drop = 1 - data.metrics.sessions / data.previous.sessions;
      push({
        id: "ai-traffic-drop",
        category: "ia",
        title: "Caída del tráfico desde asistentes de IA",
        detail: `Las sesiones desde IA pasaron de ${data.previous.sessions} a ${data.metrics.sessions} (${(drop * 100).toFixed(1).replace(".", ",")}% menos). Revisar qué prompts o páginas dejaron de citarse.`,
        metric: `-${(drop * 100).toFixed(0)}% sesiones IA`,
        impact: Math.min(85, 40 + drop * 50),
        confidence: "media",
        effort: "alto",
        href: "/ai-search",
      });
    }
  }

  if (mentions.status === "live") {
    if (mentions.summary.checked > 0 && mentions.summary.visibility < 0.4) {
      push({
        id: "ai-visibility",
        category: "ia",
        title: `Visibilidad de marca en IA en ${(mentions.summary.visibility * 100).toFixed(0)}%`,
        detail: `Whalemate aparece en ${mentions.summary.mentioned} de ${mentions.summary.checked} prompts chequeados. Revisar los prompts sin mención y las fuentes citadas por los asistentes.`,
        metric: `${mentions.summary.mentioned}/${mentions.summary.checked} prompts`,
        impact: 65,
        confidence: "media",
        effort: "medio",
        href: "/ai-search",
      });
    }
    if (mentions.summary.prompts > mentions.summary.checked) {
      push({
        id: "ai-mentions-coverage",
        category: "ia",
        title: "Faltan chequeos de menciones IA",
        detail: `${mentions.summary.prompts - mentions.summary.checked} prompts activos todavía no tienen ningún chequeo registrado.`,
        metric: `${mentions.summary.prompts - mentions.summary.checked} pendientes`,
        impact: 35,
        confidence: "alta",
        effort: "bajo",
        href: "/ai-search",
      });
    }
  } else if (mentions.status === "empty") {
    push({
      id: "ai-mentions-setup",
      category: "datos",
      title: "Configurar monitoreo de menciones IA",
      detail: "No hay prompts cargados. Cargá la librería sugerida para medir si Whalemate aparece en ChatGPT, Perplexity, Gemini, Copilot y Claude.",
      impact: 55,
      confidence: "alta",
      effort: "bajo",
      href: "/ai-search",
    });
  }

  signals.sort((left, right) => right.score - left.score);
  const sources = {
    keywords: keywords ? ("live" as const) : ("unavailable" as const),
    audit: auditData ? ("live" as const) : ("unavailable" as const),
    alerts: alerts ? ("live" as const) : ("unavailable" as const),
    ai: ai ? ("live" as const) : ("unavailable" as const),
    mentions: mentions.status,
  };
  const liveSources = Object.values(sources).filter((value) => value !== "unavailable").length;

  const brief = signals.slice(0, 3).map((signal, index) => `${index + 1}. ${signal.title}${signal.metric ? ` — ${signal.metric}` : ""} (confianza ${signal.confidence}, esfuerzo ${signal.effort})`);

  return {
    status: liveSources === 0 ? "unavailable" : liveSources >= 4 ? "live" : "partial",
    generatedAt,
    period,
    sources,
    summary: {
      signals: signals.length,
      opportunities: signals.filter((signal) => signal.category === "oportunidad").length,
      risks: signals.filter((signal) => signal.category === "tecnico" || signal.category === "alerta").length,
      topScore: signals[0]?.score ?? 0,
    },
    signals,
    brief,
  };
}

function pathOf(value: string) {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}
