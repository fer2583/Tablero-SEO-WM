import { NextResponse } from "next/server";
import { fetchSearchConsole, fetchSearchConsoleWorkspace, parseFilters, type IntegrationResponse, type SearchConsoleData, type SearchConsoleWorkspaceTab, type SearchConsoleWorkspaceData } from "@/lib/integrations";
import { fetchSearchGlobal } from "@/lib/search-global";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  try {
    if (!process.env.GSC_SITE_URL || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("Search Console no está conectada. Configura GSC_SITE_URL y credenciales de Google.");
    const params = new URL(request.url).searchParams;
    const tab = params.get("tab");
    if (tab && ["performance", "queries", "geographic", "device", "site-url"].includes(tab)) {
      const generatedAt = new Date().toISOString();
      const workspaceData = await fetchSearchConsoleWorkspace(filters, tab as SearchConsoleWorkspaceTab);
      const response: IntegrationResponse<SearchConsoleWorkspaceData> = { status: workspaceData.rows.length ? "live" : "no_data", data: workspaceData, generatedAt, metadata: { rows: workspaceData.rows.length, lastResponseAt: generatedAt, filters } };
      return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const generatedAt = new Date().toISOString();
    const data = await fetchSearchConsole(filters);
    if (params.get("view") === "global") data.dimensions = await fetchSearchGlobal(filters, params.get("segment") ?? undefined);
    const rows = data.queries.length + data.pages.length;
    const response: IntegrationResponse<SearchConsoleData> = { status: rows ? "live" : "no_data", data, generatedAt, metadata: { rows, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    const generatedAt = new Date().toISOString();
    const tab = new URL(request.url).searchParams.get("tab");
    if (tab && ["performance", "queries", "geographic", "device", "site-url"].includes(tab)) {
      const period = { start: "", end: "", previousStart: "", previousEnd: "" };
      const data: SearchConsoleWorkspaceData = { tab: tab as SearchConsoleWorkspaceTab, period, metrics: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, previous: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, rows: [] };
      const response: IntegrationResponse<SearchConsoleWorkspaceData> = { status: "unavailable", data, error: "Search Console no está disponible. Revisa la conexión del servidor.", generatedAt, metadata: { rows: 0, lastResponseAt: generatedAt, filters } };
      return NextResponse.json(response, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const period = { start: "", end: "", previousStart: "", previousEnd: "" };
    const data: SearchConsoleData = { period, metrics: { clicks: null, impressions: null, ctr: null, position: 0 }, previous: { clicks: null, impressions: null, ctr: null, position: 0 }, queries: [], pages: [], opportunities: { positions4to10: [], positions11to20: [] } };
    const response: IntegrationResponse<SearchConsoleData> = { status: "unavailable", data, error: "Search Console no está disponible. Revisa la conexión del servidor.", generatedAt, metadata: { rows: 0, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
