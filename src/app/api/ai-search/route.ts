import { NextResponse } from "next/server";
import { parseFilters, type IntegrationResponse } from "@/lib/integrations";
import { emptyAiSearch, fetchAiSearch, type AiSearchData } from "@/lib/ai-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let filters;
  try {
    filters = parseFilters(new URL(request.url).searchParams);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();
  try {
    if (!process.env.GA4_PROPERTY_ID) throw new Error("GA4: falta GA4_PROPERTY_ID en la configuración del servidor.");
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GA4: faltan credenciales de Google en la configuración del servidor.");
    const data = await fetchAiSearch(filters);
    const response: IntegrationResponse<AiSearchData> = {
      status: data.sources.length || data.metrics.sessions ? "live" : "no_data",
      data,
      generatedAt,
      metadata: { rows: data.sources.length, lastResponseAt: generatedAt, filters },
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar el tráfico de IA.";
    return NextResponse.json(
      { status: "unavailable", data: emptyAiSearch(filters), error: `Tráfico IA: ${message}`, generatedAt },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
