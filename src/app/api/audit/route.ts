import { NextRequest, NextResponse } from "next/server";
import { runAudit, type AuditDevice } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url") || process.env.SITE_URL || "https://www.whalemate.com/";
    const device = request.nextUrl.searchParams.get("device") === "desktop" ? "desktop" : "mobile" as AuditDevice;
    return NextResponse.json(await runAudit(url, device));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la auditoría.";
    return NextResponse.json({ error: /key|token|secret|credential|private/i.test(message) ? "La fuente no está disponible. Revisa la configuración del servidor." : message }, { status: 400 });
  }
}
