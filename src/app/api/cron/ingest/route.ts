import { NextResponse } from "next/server";
import { ingestSources } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Ingesta diaria para Vercel Cron. Si CRON_SECRET está configurado, exige el
 * bearer que Vercel envía; sin secreto queda abierto solo a la ingesta.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const results = await ingestSources(["gsc", "ga4"], true);
  const failed = results.filter((result) => result.status === "error");
  return NextResponse.json({ status: failed.length ? "partial" : "ok", results }, { status: failed.length ? 207 : 200, headers: { "Cache-Control": "no-store, max-age=0" } });
}
