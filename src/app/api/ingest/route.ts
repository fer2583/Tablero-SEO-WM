import { NextResponse } from "next/server";
import { ingestSources, type IngestSource } from "@/lib/ingest";
import { databaseConfigured } from "@/lib/snapshot-refresh";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "unavailable", error: "La ingesta sólo se ejecuta mediante POST." }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return NextResponse.json({ status: "unavailable", error: "DATABASE_URL no está configurada." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const requested = (params.get("sources") ?? "gsc,ga4").split(",").map((source) => source.trim()).filter((source): source is IngestSource => source === "gsc" || source === "ga4");
  const sources = requested.length ? requested : ["gsc", "ga4"] as IngestSource[];
  const results = await ingestSources(sources, params.get("refresh") === "1");
  const failed = results.some((result) => result.status === "error");
  return NextResponse.json({ status: failed ? "partial" : "success", results }, { status: failed ? 207 : 200, headers: { "Cache-Control": "no-store, max-age=0" } });
}
