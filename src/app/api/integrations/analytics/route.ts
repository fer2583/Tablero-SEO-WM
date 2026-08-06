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
    const response: IntegrationResponse<typeof fallback> = { status: "live", data, generatedAt, metadata: { rows: data.landingPages.length + data.dailySessions.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const generatedAt = new Date().toISOString();
    const response: IntegrationResponse<typeof fallback> = { status: "fallback", data: fallback, error: error instanceof Error ? error.message : "No se pudo consultar GA4.", generatedAt, metadata: { rows: fallback.landingPages.length + fallback.dailySessions.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
