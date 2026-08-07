import { NextResponse } from "next/server";
import { runAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await runAudit(), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la auditoría.";
    return NextResponse.json({ error: /key|token|secret|credential|private/i.test(message) ? "La fuente no está disponible. Revisa la configuración del servidor." : message }, { status: 503 });
  }
}
