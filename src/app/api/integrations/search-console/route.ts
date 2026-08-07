import { NextResponse } from "next/server";
import { fetchSearchConsole, parseFilters, type IntegrationResponse, type SearchConsoleData } from "@/lib/integrations";
import { fetchSearchGlobal } from "@/lib/search-global";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  try {
    if (!process.env.GSC_SITE_URL || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("Search Console no está conectada. Configura GSC_SITE_URL y credenciales de Google.");
    const generatedAt = new Date().toISOString();
    const data = await fetchSearchConsole(filters);
    const params = new URL(request.url).searchParams;
    if (params.get("view") === "global") data.dimensions = await fetchSearchGlobal(filters, params.get("segment") ?? undefined);
    const rows = data.queries.length + data.pages.length;
    const response: IntegrationResponse<SearchConsoleData> = { status: rows ? "live" : "no_data", data, generatedAt, metadata: { rows, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    const generatedAt = new Date().toISOString();
    const period = { start: "", end: "", previousStart: "", previousEnd: "" };
    const data: SearchConsoleData = { period, metrics: { clicks: null, impressions: null, ctr: null, position: 0 }, previous: { clicks: null, impressions: null, ctr: null, position: 0 }, queries: [], pages: [], opportunities: { positions4to10: [], positions11to20: [] } };
    const response: IntegrationResponse<SearchConsoleData> = { status: "unavailable", data, error: "Search Console no está disponible. Revisa la conexión del servidor.", generatedAt, metadata: { rows: 0, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
