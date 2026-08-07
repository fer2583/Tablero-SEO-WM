import { NextResponse } from "next/server";
import { getLatestAuditIssueCounts, getLatestAuditSnapshot, getLatestAuditVitals, getLatestIndexationSnapshot, getLatestSourceSnapshot, getSummaryRankingRows, getSynchronization } from "@/db/queries";
import { dates, parseFilters, type AnalyticsData, type SearchConsoleData } from "@/lib/integrations";
import { databaseConfigured, snapshotState } from "@/lib/snapshot-refresh";
import { startOpportunisticIngest } from "@/lib/ingest";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

type SnapshotResult<T> = { value: T | null; state: string; completedAt: string | null };

export async function GET(request: Request) {
  if (!databaseConfigured()) return NextResponse.json({ status: "unavailable", error: "DATABASE_URL no está configurada. El resumen requiere snapshots persistidos." }, { status: 503 });
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); } catch (error) { return NextResponse.json({ status: "unavailable", error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  const summaryFilters = { ...filters, days: 30 as const };
  const period = dates(summaryFilters.days);
  const gsc = await snapshot<SearchConsoleData>("search-console", period);
  const ga4 = await snapshot<AnalyticsData>("analytics", period);
  const [audit, auditIssues, auditVitals, rankingRows] = await Promise.all([
    getLatestAuditSnapshot(SITE_URL),
    getLatestAuditIssueCounts(SITE_URL),
    getLatestAuditVitals(SITE_URL),
    getSummaryRankingRows(SITE_URL, period.start, period.end, period.previousStart, period.previousEnd),
  ]);
  const indexation = await getLatestIndexationSnapshot(SITE_URL);
  const search = gsc.value;
  const analytics = ga4.value;
  const unavailable = !search && !analytics;
  const queryRows = search?.queries ?? [];
  const inspection = indexation?.snapshot && typeof indexation.snapshot === "object" ? ((indexation.snapshot as { inspection?: { rows?: Array<{ url?: string; status?: string; error?: string }> } }).inspection ?? null) : null;
  const auditSnapshot = audit?.snapshot && typeof audit.snapshot === "object" ? audit.snapshot as { crawler?: { audited?: unknown[]; issues?: unknown[] }; devices?: Record<string, { psi?: { scores?: Record<string, number | null>; metrics?: Record<string, number | null>; status?: string }; crux?: { metrics?: Record<string, number | null>; status?: string } }> } : null;
  const auditPages = auditSnapshot?.crawler?.audited?.length ?? 0;
  const auditIssueTotal = auditIssues.reduce((total, item) => total + item.count, 0);
  const auditScore = auditPages ? Math.max(0, Math.round(100 - auditIssueTotal / auditPages * 10)) : null;
  const rankings = (rankingRows.length ? rankingRows : queryRows.map((row) => ({ query: row.query, position: row.position ?? null, previousPosition: null, impressions: row.impressions ?? null }))).map((row) => ({ query: row.query, position: row.position == null ? null : Number(row.position), previousPosition: row.previousPosition == null ? null : Number(row.previousPosition), impressions: row.impressions == null ? null : Number(row.impressions) }));
  const withPosition = rankings.filter((row) => row.position != null && Number.isFinite(row.position));
  const positionCount = (max: number) => withPosition.filter((row) => (row.position as number) <= max).length;
  const vitals = auditVitals.filter((row) => row.kind === "crux").find((row) => row.device === "mobile") ?? auditVitals.find((row) => row.kind === "crux");
  const data = {
    period: search?.period ?? analytics?.period ?? period,
    metrics: { searchConsole: search?.metrics ?? null, analytics: analytics?.metrics ?? null },
    previous: { searchConsole: search?.previous ?? null, analytics: analytics?.previous ?? null },
    keywords: { winning: [...queryRows].sort((a, b) => b.clicks - a.clicks).slice(0, 5), losing: [...queryRows].sort((a, b) => a.clicks - b.clicks).slice(0, 5), status: search ? "available" : "unavailable" },
    overview: { healthScore: auditScore, keywordsTop10: positionCount(10), monthlyActions: null, issues: auditIssueTotal },
    rankings: { top3: positionCount(3), top10: positionCount(10), top30: positionCount(30), noPosition: rankings.filter((row) => row.position == null).length, rows: rankings.slice(0, 10) },
    audit: { score: auditScore, issues: auditIssueTotal, severity: auditIssues, lastAudit: audit?.completedAt ?? null, vitals: vitals ? { status: vitals.status, metrics: vitals.metrics } : null },
    indexation: inspection ? { ...inspection, problemUrls: inspection.rows?.filter((row) => row.status !== "indexed").map((row) => row.url).filter(Boolean) ?? [] } : null,
    technical: audit ? { status: audit.status } : null,
    sources: { searchConsole: gsc.state, analytics: ga4.state, audit: audit ? "available" : "unavailable", indexation: indexation ? "available" : "unavailable" },
    periodLabel: "Últimos 30 días vs. 30 días anteriores",
  };
  const status = unavailable ? "unavailable" : gsc.state === "available" && ga4.state === "available" ? "live" : "partial";
  return NextResponse.json({ status, data, metadata: { filters: summaryFilters, snapshotAt: { searchConsole: gsc.completedAt, analytics: ga4.completedAt, audit: audit?.completedAt ?? null, indexation: indexation?.completedAt ?? null }, states: { searchConsole: gsc.state, analytics: ga4.state } } }, { status: unavailable ? 503 : 200, headers: { "Cache-Control": "no-store, max-age=0" } });
}

async function snapshot<T extends { period?: { start: string; end: string; previousStart: string; previousEnd: string } }>(source: string, expectedPeriod: { start: string; end: string; previousStart: string; previousEnd: string }): Promise<SnapshotResult<T>> {
  try {
    void expectedPeriod;
    const latest = await getLatestSourceSnapshot(SITE_URL, source);
    const value = latest?.snapshot as T | undefined;
    const sync = await getSynchronization(source === "search-console" ? "search-console" : "analytics");
    const state = snapshotState(latest?.completedAt ?? null, sync);
    if (state === "stale" || state === "unavailable") void startOpportunisticIngest([source === "search-console" ? "gsc" : "ga4"]);
    return { value: value ?? null, state: state === "fresh" ? "available" : state, completedAt: latest?.completedAt ?? null };
  } catch { return { value: null, state: "unavailable", completedAt: null }; }
}
