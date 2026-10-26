import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { archiveAiPrompt, createAiPrompt, listAiPrompts } from "@/db/ai-mentions";

export const dynamic = "force-dynamic";

const unavailable = () =>
  NextResponse.json({ error: "Base de datos no configurada. Las menciones manuales requieren DATABASE_URL." }, { status: 503 });

export async function GET() {
  if (!databaseConfigured()) return unavailable();
  try {
    return NextResponse.json({ prompts: await listAiPrompts(SITE_URL) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron leer los prompts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return unavailable();
  try {
    const body = (await request.json()) as { prompt?: unknown; intent?: unknown; language?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const intent = typeof body.intent === "string" && body.intent.trim() ? body.intent.trim().slice(0, 40) : "general";
    const language = typeof body.language === "string" && ["es", "en", "pt"].includes(body.language) ? body.language : "es";
    if (prompt.length < 5 || prompt.length > 300) return NextResponse.json({ error: "El prompt debe tener entre 5 y 300 caracteres." }, { status: 400 });
    const created = await createAiPrompt(SITE_URL, { prompt, intent, language });
    return NextResponse.json({ prompt: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el prompt." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!databaseConfigured()) return unavailable();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id inválido." }, { status: 400 });
  try {
    const archived = await archiveAiPrompt(SITE_URL, id);
    if (!archived) return NextResponse.json({ error: "Prompt no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo archivar el prompt." }, { status: 500 });
  }
}
