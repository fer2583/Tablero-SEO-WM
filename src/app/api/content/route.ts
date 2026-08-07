import { NextResponse } from "next/server";
import { fetchContent } from "@/lib/content";
import { parseFilters, type IntegrationResponse } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  const generatedAt = new Date().toISOString();
  try {
    if (!process.env.GSC_SITE_URL || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("Search Console no está configurada.");
    const data = await fetchContent(filters);
    const response: IntegrationResponse<typeof data> = { status: data.queries.length ? "live" : "no_data", data, generatedAt, metadata: { rows: data.queries.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ status: "unavailable", error: error instanceof Error ? error.message : "Contenido no está disponible.", generatedAt }, { status: 503 });
  }
}
