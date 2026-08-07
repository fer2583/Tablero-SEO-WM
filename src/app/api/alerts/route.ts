import { NextResponse } from "next/server";
import { evaluateAlerts, updateAlertStatus, type AlertStatus } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await evaluateAlerts();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: number; status?: AlertStatus };
    if (!body.id || !body.status) return NextResponse.json({ error: "id y status son obligatorios." }, { status: 400 });
    return NextResponse.json(await updateAlertStatus(body.id, body.status), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la alerta." }, { status: 400 });
  }
}
