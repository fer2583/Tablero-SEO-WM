import { NextResponse } from "next/server";
import { getLatestAuditSnapshot, getLatestSourceSnapshot, getSynchronization } from "@/db/queries";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { SITE_URL } from "@/lib/site";
import type { AuditData } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const google = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  let error = false;
  let audit: Awaited<ReturnType<typeof getLatestAuditSnapshot>> | null = null;
  let gsc: Awaited<ReturnType<typeof getLatestSourceSnapshot>> | null = null;
  let ga: Awaited<ReturnType<typeof getLatestSourceSnapshot>> | null = null;
  let gscSync: Awaited<ReturnType<typeof getSynchronization>> | null = null;
  let gaSync: Awaited<ReturnType<typeof getSynchronization>> | null = null;
  if (databaseConfigured()) {
    try { [audit, gsc, ga, gscSync, gaSync] = await Promise.all([getLatestAuditSnapshot(SITE_URL), getLatestSourceSnapshot(SITE_URL, "search-console"), getLatestSourceSnapshot(SITE_URL, "analytics"), getSynchronization("search-console"), getSynchronization("analytics")]); }
    catch { error = true; }
  }
  const snapshot = audit?.snapshot as AuditData | undefined;
  const source = (key: string, name: string, configured: boolean, live: boolean, lastSync: string | null, failed = false) => ({ key, name, status: failed ? "error" : !configured ? "unavailable" : live ? "connected" : "configured", detail: failed ? "No se pudo consultar el estado persistido." : !configured ? "Falta configuración de la fuente." : live ? "Hay un snapshot persistido. Esta consulta no ejecuta la fuente." : "Configurada; sin snapshot disponible.", lastSync });
  const sources = [
    source("gsc", "Google Search Console", Boolean(process.env.GSC_SITE_URL && google), !!gsc, gsc?.completedAt || gscSync?.lastSuccessAt || null, error),
    source("ga4", "Google Analytics / GA4", Boolean(process.env.GA4_PROPERTY_ID && google), !!ga, ga?.completedAt || gaSync?.lastSuccessAt || null, error),
    source("psi", "PageSpeed Insights", !!process.env.PAGESPEED_API_KEY, snapshot?.devices.mobile.psi.status === "live", snapshot?.devices.mobile.psi.fetchedAt || null),
    source("crux", "Chrome UX Report / CrUX", !!process.env.CRUX_API_KEY, snapshot?.devices.mobile.crux.status === "live", snapshot?.devices.mobile.crux.fetchedAt || null),
    source("crawler", "Crawler / Auditoría", true, !!snapshot?.crawler.audited.length, audit?.completedAt || null, error),
    source("neon", "Neon / Base de datos", databaseConfigured(), !!audit || !!gsc || !!ga, audit?.completedAt || null, error),
  ];
  return NextResponse.json({ sources, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
