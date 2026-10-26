import { NextResponse } from "next/server";
import { parseFilters } from "@/lib/integrations";
import { buildIntelligence } from "@/lib/intelligence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let filters;
  try {
    filters = parseFilters(new URL(request.url).searchParams);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 });
  }

  try {
    const payload = await buildIntelligence(filters);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo construir el Intelligence." }, { status: 500 });
  }
}
