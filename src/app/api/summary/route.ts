import { NextResponse } from "next/server";
import { getLatestAuditSnapshot, getLatestIndexationSnapshot, getLatestSourceSnapshotByPrefix } from "@/db/queries";
import { parseFilters, type AnalyticsData, type SearchConsoleData } from "@/lib/integrations";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

type SnapshotResult<T> = { value: T | null; state: string; completedAt: string | null };

export async function GET(request: Request) {
  if (!databaseConfigured()) return NextResponse.json({ status: "unavailable", error: "DATABASE_URL no está configurada. El resumen requiere snapshots persistidos." }, { status: 503 });
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); } catch (error) { return NextResponse.json({ status: "unavailable", error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  const gsc = await snapshot<SearchConsoleData>(`gsc-summary:${filters.days}:${filters.language}:${filters.country}:${filters.device}`);
  const ga4 = await snapshot<AnalyticsData>(`ga4-summary:${filters.days}:${filters.language}:${filters.country}:${filters.device}`);
  const audit = await getLatestAuditSnapshot(SITE_URL);
  const indexation = await getLatestIndexationSnapshot(SITE_URL);
  const search = gsc.value;
  const analytics = ga4.value;
  const unavailable = !search && !analytics;
  const queryRows = search?.queries ?? [];
  const inspection = indexation?.snapshot && typeof indexation.snapshot === "object" ? ((indexation.snapshot as { inspection?: { rows?: Array<{ url?: string; status?: string; error?: string }> } }).inspection ?? null) : null;
  const technical = audit?.snapshot && typeof audit.snapshot === "object" ? ((audit.snapshot as { crawler?: { issues?: unknown[]; robots?: string; sitemap?: string }; schema?: { status?: string } }).crawler ?? null) : null;
  const data = {
    period: search?.period ?? analytics?.period ?? { start: "", end: "", previousStart: "", previousEnd: "" },
    metrics: { searchConsole: search?.metrics ?? null, analytics: analytics?.metrics ?? null },
    previous: { searchConsole: search?.previous ?? null, analytics: analytics?.previous ?? null },
    keywords: { winning: [...queryRows].sort((a, b) => b.clicks - a.clicks).slice(0, 5), losing: [...queryRows].sort((a, b) => a.clicks - b.clicks).slice(0, 5), status: search ? "available" : "unavailable" },
    indexation: inspection ? { ...inspection, problemUrls: inspection.rows?.filter((row) => row.status !== "indexed").map((row) => row.url).filter(Boolean) ?? [] } : null,
    technical: technical ? { ...technical, status: technical.issues ? "available" : "no_data" } : null,
    sources: { searchConsole: gsc.state, analytics: ga4.state, audit: audit ? "available" : "unavailable", indexation: indexation ? "available" : "unavailable" },
  };
  const status = unavailable ? "unavailable" : "live";
  return NextResponse.json({ status, data, metadata: { filters, snapshotAt: { searchConsole: gsc.completedAt, analytics: ga4.completedAt, audit: audit?.completedAt ?? null, indexation: indexation?.completedAt ?? null }, states: { searchConsole: gsc.state, analytics: ga4.state } } }, { status: unavailable ? 503 : 200, headers: { "Cache-Control": "no-store, max-age=0" } });
}

async function snapshot<T>(source: string): Promise<SnapshotResult<T>> {
  try { const latest = await getLatestSourceSnapshotByPrefix(SITE_URL, source); return { value: latest?.snapshot as T ?? null, state: latest ? "available" : "no_data", completedAt: latest?.completedAt ?? null }; } catch { return { value: null, state: "unavailable", completedAt: null }; }
}
