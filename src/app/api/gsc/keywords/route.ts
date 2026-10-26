import { NextResponse } from "next/server";
import { fetchKeywords, type KeywordsData } from "@/lib/keywords";
import { parseFilters, type IntegrationResponse } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const emptyKeywords: KeywordsData = {
  period: { start: "", end: "", previousStart: "", previousEnd: "" },
  totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
  previous: null,
  daily: [],
  rows: [],
  winners: [],
  losers: [],
  opportunities: [],
  cannibalization: [],
  truncated: false,
};

export async function GET(request: Request) {
  let filters;
  try {
    filters = parseFilters(new URL(request.url).searchParams);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 });
  }
  const generatedAt = new Date().toISOString();
  try {
    if (!process.env.GSC_SITE_URL || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      throw new Error("Search Console no está conectada.");
    }
    const data = await fetchKeywords(filters);
    const response: IntegrationResponse<KeywordsData> = {
      status: data.rows.length ? "live" : "no_data",
      data,
      generatedAt,
      metadata: { rows: data.rows.length, lastResponseAt: generatedAt, filters },
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json(
      { status: "unavailable", data: emptyKeywords, error: "Search Console no está disponible.", generatedAt },
      { status: 503 },
    );
  }
}
