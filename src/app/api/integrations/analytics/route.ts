import { NextResponse } from "next/server";
import { fallbackAnalytics, fetchAnalytics, parseFilters, type IntegrationResponse } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  const fallback = fallbackAnalytics(filters.days);
  try {
    if (!process.env.GA4_PROPERTY_ID || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("Configura GA4_PROPERTY_ID y GOOGLE_APPLICATION_CREDENTIALS (o GOOGLE_SERVICE_ACCOUNT_JSON) para activar Analytics.");
    const generatedAt = new Date().toISOString();
    const data = await fetchAnalytics(filters);
    if (!data.metrics.users && !data.metrics.sessions && data.warnings.length) throw new Error("GA4 no devolvió las métricas principales. Revisa los avisos de compatibilidad.");
    const response: IntegrationResponse<typeof fallback> = { status: "live", data, generatedAt, metadata: { rows: data.landingPages.length + data.sources.length + data.countries.length + data.devices.length + data.dailySessions.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const generatedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "No se pudo consultar GA4.";
    const safeMessage = /private.?key|client.?email|access.?token|credential|service account/i.test(message) ? "No se pudo autenticar contra GA4. Revisa las credenciales del servidor." : message;
    const response: IntegrationResponse<typeof fallback> = { status: "fallback", data: fallback, error: safeMessage, generatedAt, metadata: { rows: fallback.landingPages.length + fallback.sources.length + fallback.countries.length + fallback.devices.length + fallback.dailySessions.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
