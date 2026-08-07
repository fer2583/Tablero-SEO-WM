import { NextResponse } from "next/server";
import { getLatestAuditSnapshot, getLatestSourceSnapshot, getSynchronization } from "@/db/queries";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { loadSitemap, SITE_URL } from "@/lib/site";
import { runAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Source = { key: string; name: string; status: "connected" | "configured" | "unavailable" | "error"; detail: string; lastSync: string | null };
const configuredGoogle = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);

export async function GET() {
  const sources: Source[] = [];
  const gscConfig = Boolean(process.env.GSC_SITE_URL && configuredGoogle);
  const gaConfig = Boolean(process.env.GA4_PROPERTY_ID && configuredGoogle);
  let databaseError = false;
  let gscSnapshot = null; let gaSnapshot = null; let gscSync = null; let gaSync = null;
  if (databaseConfigured()) {
    try { [gscSnapshot, gaSnapshot, gscSync, gaSync] = await Promise.all([getLatestSourceSnapshot(SITE_URL, "search-console"), getLatestSourceSnapshot(SITE_URL, "analytics"), getSynchronization("search-console"), getSynchronization("analytics")]); } catch { databaseError = true; }
  }
  const syncDate = (snapshot: { completedAt?: string | null } | null, sync: { lastSuccessAt?: string | null } | null) => snapshot?.completedAt ?? sync?.lastSuccessAt ?? null;
  if (!gscConfig) sources.push({ key: "gsc", name: "Google Search Console", status: "unavailable", detail: "Falta configuración de propiedad o credenciales.", lastSync: syncDate(gscSnapshot, gscSync) });
  else { try { const audit = await (await import("@/lib/integrations")).fetchSearchConsoleWorkspace({ days: 30, language: "all", country: "all", device: "all" }, "queries"); sources.push({ key: "gsc", name: "Google Search Console", status: audit.rows.length ? "connected" : "configured", detail: audit.rows.length ? `${audit.rows.length} filas reales en últimos 30 días.` : "Credenciales válidas, sin filas en últimos 30 días.", lastSync: syncDate(gscSnapshot, gscSync) }); } catch { sources.push({ key: "gsc", name: "Google Search Console", status: "error", detail: "La consulta real a Search Console falló.", lastSync: syncDate(gscSnapshot, gscSync) }); } }
  if (!gaConfig) sources.push({ key: "ga4", name: "Google Analytics / GA4", status: "unavailable", detail: "Falta GA4_PROPERTY_ID o credenciales.", lastSync: syncDate(gaSnapshot, gaSync) });
  else { try { const { fetchAnalytics } = await import("@/lib/integrations"); const data = await fetchAnalytics({ days: 30, language: "all", country: "all", device: "all" }); sources.push({ key: "ga4", name: "Google Analytics / GA4", status: data.landingPages.length ? "connected" : "configured", detail: data.landingPages.length ? `${data.landingPages.length} landing pages orgánicas reales.` : "Credenciales válidas, sin landing pages en últimos 30 días.", lastSync: syncDate(gaSnapshot, gaSync) }); } catch { sources.push({ key: "ga4", name: "Google Analytics / GA4", status: "error", detail: "La consulta real a GA4 falló.", lastSync: syncDate(gaSnapshot, gaSync) }); } }
  const [audit, sitemap] = await Promise.all([runAudit().catch(() => null), loadSitemap().catch(() => null)]);
  const psi = Boolean(process.env.PAGESPEED_API_KEY); const crux = Boolean(process.env.CRUX_API_KEY);
  for (const item of [{ key: "psi", name: "PageSpeed Insights", configured: psi, live: audit?.devices.mobile.psi.status === "live" }, { key: "crux", name: "Chrome UX Report / CrUX", configured: crux, live: audit?.devices.mobile.crux.status === "live" }]) sources.push({ key: item.key, name: item.name, status: !item.configured ? "unavailable" : item.live ? "connected" : audit ? "error" : "configured", detail: !item.configured ? "Falta la configuración de la fuente." : item.live ? "Respuesta real disponible." : audit ? "La fuente respondió con error." : "Configurada, sin snapshot disponible.", lastSync: null });
  sources.push({ key: "crawler", name: "Crawler / Auditoría", status: sitemap?.urls.length ? "connected" : sitemap ? "configured" : "error", detail: sitemap?.urls.length ? `${sitemap.urls.length} URLs reales disponibles en sitemap.` : sitemap ? "SITE_URL configurado, sin URLs de sitemap." : "Falló la consulta del sitio.", lastSync: audit?.generatedAt ?? null });
  if (!databaseConfigured()) sources.push({ key: "neon", name: "Neon / Base de datos", status: "unavailable", detail: "Falta configuración de base de datos.", lastSync: null });
  else if (databaseError) sources.push({ key: "neon", name: "Neon / Base de datos", status: "error", detail: "La conexión real a la base de datos falló.", lastSync: null });
  else { try { const snapshot = await getLatestAuditSnapshot(SITE_URL); sources.push({ key: "neon", name: "Neon / Base de datos", status: snapshot ? "connected" : "configured", detail: snapshot ? "Base conectada con snapshot de auditoría." : "Base configurada, sin snapshots persistidos.", lastSync: snapshot?.completedAt ?? null }); } catch { sources.push({ key: "neon", name: "Neon / Base de datos", status: "error", detail: "La consulta real a la base de datos falló.", lastSync: null }); } }
  return NextResponse.json({ sources, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
