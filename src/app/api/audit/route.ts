import { NextResponse } from "next/server";
import { getAuditHistory, getLatestAuditSnapshot } from "@/db/queries";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { SITE_URL } from "@/lib/site";
import { runAudit } from "@/lib/audit";
import { saveAuditSnapshot } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!databaseConfigured()) return NextResponse.json({ status: "unavailable", error: "La auditoría requiere un snapshot persistido." }, { status: 503 });
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    if (force) {
      const snapshot = await runAudit();
      await saveAuditSnapshot({ siteUrl: SITE_URL, snapshotKey: "manual", status: "success", snapshot, issues: snapshot.crawler.issues.map((issue) => ({ key: issue.id, category: issue.category, severity: issue.severity, issue: issue.issue, evidence: issue.evidence, recommendation: issue.recommendation, status: issue.status })) });
      return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const latest = await getLatestAuditSnapshot(SITE_URL);
    if (!latest) return NextResponse.json({ status: "no_data", error: "No existe un snapshot de auditoría." }, { status: 404 });
    const history = await getAuditHistory(SITE_URL);
    return NextResponse.json({ ...(latest.snapshot as object), history: history.length ? history : "no_data" }, { headers: { "Cache-Control": "no-store, max-age=0", "X-Snapshot-State": "snapshot" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la auditoría.";
    return NextResponse.json({ error: /key|token|secret|credential|private/i.test(message) ? "La fuente no está disponible. Revisa la configuración del servidor." : message }, { status: 503 });
  }
}
