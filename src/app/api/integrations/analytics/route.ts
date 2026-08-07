import { NextResponse } from "next/server";
import { fetchAnalytics, parseFilters, type AnalyticsData, type IntegrationResponse } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  try {
    if (!process.env.GA4_PROPERTY_ID || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("GA4 no está conectado. Configura GA4_PROPERTY_ID y credenciales de Google.");
    const generatedAt = new Date().toISOString();
    const data = await fetchAnalytics(filters);
    const rows = data.landingPages.length + data.sources.length + data.countries.length + data.devices.length + data.dailySessions.length;
    if (!rows && data.warnings.length) throw new Error("GA4 no devolvió datos. Revisa la propiedad y sus permisos.");
    const response: IntegrationResponse<AnalyticsData> = { status: rows ? "live" : "no_data", data, generatedAt, metadata: { rows, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const generatedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "No se pudo consultar GA4.";
    const safeMessage = /private.?key|client.?email|access.?token|credential|service account/i.test(message) ? "No se pudo autenticar contra GA4. Revisa las credenciales del servidor." : "GA4 no está disponible. Revisa la conexión del servidor.";
    const period = { start: "", end: "", previousStart: "", previousEnd: "" };
    const empty: AnalyticsData = { period, metrics: { users: null, newUsers: null, sessions: null, organicSessions: null, aiSessions: null, engagedSessions: null, engagementRate: null, engagementDuration: null, eventCount: null, conversions: null }, previous: { users: null, newUsers: null, sessions: null, organicSessions: null, aiSessions: null, engagedSessions: null, engagementRate: null, engagementDuration: null, eventCount: null, conversions: null }, landingPages: [], sources: [], aiSources: [], aiLandingPages: [], countries: [], devices: [], dailySessions: [], aiStatus: "unavailable", warnings: [] };
    const response: IntegrationResponse<AnalyticsData> = { status: "unavailable", data: empty, error: safeMessage, generatedAt, metadata: { rows: 0, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
