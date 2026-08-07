import { NextResponse } from "next/server";
import { getLatestIndexationSnapshot } from "@/db/queries";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { SITE_URL } from "@/lib/site";
import { loadIndexation } from "@/lib/indexation";
import { saveIndexationRun } from "@/db/queries";
import { evaluateAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!databaseConfigured()) return NextResponse.json({ status: "unavailable", error: "Indexación requiere un snapshot persistido." }, { status: 503 });
    const params = new URL(request.url).searchParams;
    const force = params.get("refresh") === "1";
    if (force) {
      const snapshot = await loadIndexation(params.get("action") === "inspect-priority");
      await saveIndexationRun(SITE_URL, "manual", snapshot);
      await evaluateAlerts();
      return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const latest = await getLatestIndexationSnapshot(SITE_URL);
    if (!latest) return NextResponse.json({ status: "no_data", error: "No existe un snapshot de indexación." }, { status: 404 });
    return NextResponse.json(latest.snapshot, { headers: { "Cache-Control": "no-store, max-age=0", "X-Snapshot-State": "snapshot" } });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar Indexación." }, { status: 503 }); }
}
