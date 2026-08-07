import { NextResponse } from "next/server";
import { loadIndexation } from "@/lib/indexation";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const inspect = new URL(request.url).searchParams.get("action") === "inspect-priority";
  try { return NextResponse.json(await loadIndexation(inspect), { headers: { "Cache-Control": "no-store, max-age=0" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar Indexación." }, { status: 503 }); }
}
