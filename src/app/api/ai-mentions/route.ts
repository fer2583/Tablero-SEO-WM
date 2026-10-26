import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { createAiMentionCheck, deleteAiMentionCheck } from "@/db/ai-mentions";
import { buildMentionsPayload } from "@/lib/ai-mentions";
import { MENTION_PLATFORMS } from "@/lib/ai-mentions-types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildMentionsPayload(), { headers: { "Cache-Control": "no-store, max-age=0" } });
}

function urlOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function textOrNull(value: unknown, max = 2000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "Base de datos no configurada. Las menciones manuales requieren DATABASE_URL." }, { status: 503 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const promptId = Number(body.promptId);
    const platform = typeof body.platform === "string" ? body.platform : "";
    if (!Number.isInteger(promptId) || promptId <= 0) return NextResponse.json({ error: "promptId inválido." }, { status: 400 });
    if (!(MENTION_PLATFORMS as readonly string[]).includes(platform)) return NextResponse.json({ error: "Plataforma no válida." }, { status: 400 });

    const rank = Number(body.brandRank);
    const brandRank = body.mentioned === true && Number.isFinite(rank) && rank >= 1 && rank <= 50 ? Math.round(rank) : null;
    const sources = Array.isArray(body.sources)
      ? body.sources.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 12)
      : typeof body.sources === "string"
        ? body.sources.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 12)
        : [];

    const checkedAtRaw = typeof body.checkedAt === "string" && body.checkedAt.trim() ? new Date(body.checkedAt) : null;
    const checkedAt = checkedAtRaw && !Number.isNaN(checkedAtRaw.getTime()) ? checkedAtRaw.toISOString() : null;

    await createAiMentionCheck(SITE_URL, {
      promptId,
      platform,
      mentioned: body.mentioned === true,
      brandRank,
      citationUrl: urlOrNull(body.citationUrl),
      sources,
      excerpt: textOrNull(body.excerpt),
      evidenceUrl: urlOrNull(body.evidenceUrl),
      notes: textOrNull(body.notes, 1000),
      checkedAt,
    });

    return NextResponse.json(await buildMentionsPayload(), { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar el chequeo." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "Base de datos no configurada." }, { status: 503 });
  }
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id inválido." }, { status: 400 });
  try {
    const removed = await deleteAiMentionCheck(SITE_URL, id);
    if (!removed) return NextResponse.json({ error: "Chequeo no encontrado." }, { status: 404 });
    return NextResponse.json(await buildMentionsPayload(), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el chequeo." }, { status: 500 });
  }
}
