import { NextResponse } from "next/server";
import {
  getGa4AiDailySeries,
  getGa4AiTotals,
  getGa4DailySeries,
  getGa4Totals,
  getGscDailySeries,
  getGscQueryRows,
  getGscTotals,
  getLatestAuditIssueCounts,
  getLatestAuditSnapshot,
  getLatestAuditVitals,
  getLatestIndexationSnapshot,
  getSynchronization,
} from "@/db/queries";
import { getOpenAlerts } from "@/lib/alerts";
import { parseFilters, periodFromFilters } from "@/lib/integrations";
import { isBrandQuery } from "@/lib/keywords";
import { startOpportunisticIngest } from "@/lib/ingest";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { SITE_URL } from "@/lib/site";
import type { AuditData } from "@/lib/audit";

export const dynamic = "force-dynamic";

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function GET(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ status: "unavailable", error: "DATABASE_URL no está configurada. El resumen requiere snapshots persistidos." }, { status: 503 });
  }
  let filters;
  try {
    filters = parseFilters(new URL(request.url).searchParams);
  } catch (error) {
    return NextResponse.json({ status: "unavailable", error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 });
  }

  const window = periodFromFilters(filters);
  const emptyAi = { sessions: 0, conversions: 0 };
  const [gscTotals, gscPrevious, gscRowsRaw, gscSeries, ga4Totals, ga4Previous, ga4Series, aiTotals, aiPrevious, aiSeries, audit, auditIssues, auditVitals, indexation, alerts, gscSync, ga4Sync] = await Promise.all([
    getGscTotals(SITE_URL, window.start, window.end),
    getGscTotals(SITE_URL, window.compareStart, window.compareEnd),
    getGscQueryRows(SITE_URL, window.start, window.end, window.compareStart, window.compareEnd),
    getGscDailySeries(SITE_URL, window.start, window.end),
    getGa4Totals(SITE_URL, window.start, window.end),
    getGa4Totals(SITE_URL, window.compareStart, window.compareEnd),
    getGa4DailySeries(SITE_URL, window.start, window.end),
    getGa4AiTotals(SITE_URL, window.start, window.end).catch(() => emptyAi),
    getGa4AiTotals(SITE_URL, window.compareStart, window.compareEnd).catch(() => emptyAi),
    getGa4AiDailySeries(SITE_URL, window.start, window.end).catch(() => []),
    getLatestAuditSnapshot(SITE_URL),
    getLatestAuditIssueCounts(SITE_URL),
    getLatestAuditVitals(SITE_URL),
    getLatestIndexationSnapshot(SITE_URL),
    getOpenAlerts(6),
    getSynchronization("search-console"),
    getSynchronization("analytics"),
  ]);

  const gscRows = gscRowsRaw.map((row) => {
    const position = row.position == null ? null : num(row.position);
    const previousPosition = row.previousPosition == null ? null : num(row.previousPosition);
    return {
      query: row.query,
      clicks: num(row.clicks),
      impressions: num(row.impressions),
      ctr: num(row.ctr),
      position,
      previousClicks: num(row.previousClicks),
      previousPosition,
      clickDelta: num(row.clicks) - num(row.previousClicks),
      positionDelta: position == null || previousPosition == null ? null : previousPosition - position,
      brand: isBrandQuery(row.query) ? ("brand" as const) : ("non_brand" as const),
    };
  });

  const brand = { clicks: 0, impressions: 0 };
  const nonBrand = { clicks: 0, impressions: 0 };
  for (const row of gscRows) {
    const target = row.brand === "brand" ? brand : nonBrand;
    target.clicks += row.clicks;
    target.impressions += row.impressions;
  }
  const withPosition = gscRows.filter((row) => row.position != null);
  const reach = {
    top3: withPosition.filter((row) => (row.position as number) <= 3).length,
    top10: withPosition.filter((row) => (row.position as number) <= 10).length,
    top20: withPosition.filter((row) => (row.position as number) <= 20).length,
    top30: withPosition.filter((row) => (row.position as number) <= 30).length,
    total: gscRows.length,
    noPosition: gscRows.length - withPosition.length,
  };

  const hasPreviousQueryData = gscRows.some((row) => row.previousClicks > 0 || row.previousPosition != null);
  const winners = hasPreviousQueryData ? gscRows.filter((row) => row.clickDelta > 0).sort((a, b) => b.clickDelta - a.clickDelta).slice(0, 5) : [];
  const losers = hasPreviousQueryData ? gscRows.filter((row) => row.clickDelta < 0).sort((a, b) => a.clickDelta - b.clickDelta).slice(0, 5) : [];

  const auditScore = (audit?.snapshot as AuditData | undefined)?.report?.score ?? null;
  const auditIssueTotal = auditIssues.reduce((total, item) => total + item.count, 0);
  const vitalsRow = auditVitals.filter((row) => row.kind === "crux").find((row) => row.device === "mobile") ?? auditVitals.find((row) => row.kind === "crux");
  const vitals = vitalsRow
    ? { status: vitalsRow.status, metrics: Object.fromEntries(Object.entries((vitalsRow.metrics ?? {}) as Record<string, unknown>).map(([key, value]) => [key, value == null ? null : num(value)])) }
    : null;

  const inspection = indexation?.snapshot && typeof indexation.snapshot === "object"
    ? ((indexation.snapshot as { inspection?: { rows?: Array<{ url?: string; status?: string; error?: string }> } }).inspection ?? null)
    : null;
  const indexationData = inspection
    ? { ...inspection, problemUrls: inspection.rows?.filter((row) => row.status !== "indexed").map((row) => row.url).filter(Boolean) ?? [] }
    : null;

  const hasGsc = gscSeries.length > 0 || gscRows.length > 0;
  const hasGa4 = ga4Series.length > 0;
  if (!hasGsc || !hasGa4) void startOpportunisticIngest([...(hasGsc ? [] : ["gsc" as const]), ...(hasGa4 ? [] : ["ga4" as const])]);

  const alertHref = (source: string) => {
    if (source === "GSC") return "/search-console";
    if (source === "GA4") return "/analytics";
    if (source === "Auditoría" || source === "CWV" || source === "Indexación") return "/auditoria-tecnica";
    return "/alertas";
  };
  const attention = alerts.map((alert) => ({ id: alert.id, severity: alert.severity, title: alert.title, message: alert.message, href: alertHref(alert.source), source: alert.source, detectedAt: alert.detectedAt }));

  const analyticsCurrent = {
    sessions: ga4Totals.sessions,
    engagedSessions: ga4Totals.engagedSessions,
    conversions: ga4Totals.conversions,
    engagementRate: ga4Totals.engagementRate,
    aiSessions: aiTotals.sessions,
  };
  const analyticsPrevious = {
    sessions: ga4Previous.sessions,
    engagedSessions: ga4Previous.engagedSessions,
    conversions: ga4Previous.conversions,
    engagementRate: ga4Previous.engagementRate,
    aiSessions: aiPrevious.sessions,
  };

  const status = !hasGsc && !hasGa4 ? "unavailable" : hasGsc && hasGa4 ? "live" : "partial";
  const data = {
    period: {
      start: window.start,
      end: window.end,
      compareStart: window.compareStart,
      compareEnd: window.compareEnd,
      compare: window.compare,
      label: window.compare === "year" ? "vs. año anterior" : "vs. período anterior",
    },
    searchConsole: hasGsc ? { current: gscTotals, previous: gscPrevious, series: gscSeries, brand: { brand, nonBrand }, reach } : null,
    analytics: hasGa4 ? { current: analyticsCurrent, previous: analyticsPrevious, series: ga4Series, aiSeries } : null,
    keywords: { winners, losers, status: hasGsc ? "available" : "unavailable" },
    overview: { healthScore: auditScore, keywordsTop10: reach.top10, issues: auditIssueTotal, monthlyActions: null },
    rankingRows: gscRows.slice(0, 10),
    attention,
    audit: { score: auditScore, issues: auditIssueTotal, severity: auditIssues, lastAudit: audit?.completedAt ?? null, vitals },
    indexation: indexationData,
    sources: {
      searchConsole: hasGsc ? "available" : "unavailable",
      analytics: hasGa4 ? "available" : "unavailable",
      audit: audit ? "available" : "unavailable",
      indexation: indexation ? "available" : "unavailable",
    },
    segmentsApplied: false,
  };

  return NextResponse.json(
    {
      status,
      data,
      metadata: {
        filters,
        snapshotAt: { searchConsole: gscSync?.lastSuccessAt ?? null, analytics: ga4Sync?.lastSuccessAt ?? null, audit: audit?.completedAt ?? null, indexation: indexation?.completedAt ?? null },
        states: { searchConsole: hasGsc ? "available" : "unavailable", analytics: hasGa4 ? "available" : "unavailable" },
      },
    },
    { status: status === "unavailable" ? 503 : 200, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
