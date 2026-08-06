import { NextResponse } from "next/server";
import { fallbackSearchConsole, fetchSearchConsole, parseFilters, type IntegrationResponse } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fallback = fallbackSearchConsole();
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  try {
    if (!process.env.GSC_SITE_URL || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("Configura GSC_SITE_URL y GOOGLE_SERVICE_ACCOUNT_JSON para activar Search Console.");
    const generatedAt = new Date().toISOString();
    const data = await fetchSearchConsole(filters);
    const response: IntegrationResponse<typeof fallback> = { status: "live", data, generatedAt, metadata: { rows: data.queries.length + data.pages.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response);
  } catch (error) {
    const generatedAt = new Date().toISOString();
    const response: IntegrationResponse<typeof fallback> = { status: "fallback", data: fallback, error: error instanceof Error ? error.message : "No se pudo consultar Search Console.", generatedAt, metadata: { rows: fallback.queries.length + fallback.pages.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response);
  }
}
