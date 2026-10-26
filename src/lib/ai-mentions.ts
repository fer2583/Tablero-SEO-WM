import "server-only";

import { SITE_URL } from "@/lib/site";
import { databaseConfigured } from "@/lib/snapshot-refresh";
import { listAiMentionChecks, listAiPrompts } from "@/db/ai-mentions";
import type { AiMentionCheckRecord, MentionsPayload, MentionsSummary } from "@/lib/ai-mentions-types";

export type { MentionsPayload } from "@/lib/ai-mentions-types";

const EMPTY_SUMMARY: MentionsSummary = { prompts: 0, checked: 0, mentioned: 0, visibility: 0, averageRank: null, platforms: [], lastCheckedAt: null };

export async function buildMentionsPayload(): Promise<MentionsPayload> {
  const generatedAt = new Date().toISOString();
  if (!databaseConfigured()) {
    return { status: "unavailable", prompts: [], checks: [], summary: EMPTY_SUMMARY, error: "Base de datos no configurada. Las menciones manuales requieren DATABASE_URL.", generatedAt };
  }

  try {
    const [prompts, checks] = await Promise.all([listAiPrompts(SITE_URL), listAiMentionChecks(SITE_URL, 500)]);
    const active = prompts.filter((prompt) => prompt.status === "active");
    const latestByPrompt = new Map<number, AiMentionCheckRecord>();
    for (const check of checks) {
      if (!latestByPrompt.has(check.promptId)) latestByPrompt.set(check.promptId, check);
    }

    const latest = active.map((prompt) => latestByPrompt.get(prompt.id)).filter((check): check is AiMentionCheckRecord => Boolean(check));
    const mentioned = latest.filter((check) => check.mentioned);
    const ranks = mentioned.map((check) => check.brandRank).filter((rank): rank is number => rank != null);

    const platformMap = new Map<string, { checks: number; mentioned: number }>();
    for (const check of checks) {
      const bucket = platformMap.get(check.platform) ?? { checks: 0, mentioned: 0 };
      bucket.checks += 1;
      if (check.mentioned) bucket.mentioned += 1;
      platformMap.set(check.platform, bucket);
    }

    return {
      status: prompts.length ? "live" : "empty",
      prompts,
      checks,
      summary: {
        prompts: active.length,
        checked: latest.length,
        mentioned: mentioned.length,
        visibility: latest.length ? mentioned.length / latest.length : 0,
        averageRank: ranks.length ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : null,
        platforms: [...platformMap.entries()]
          .map(([platform, value]) => ({ platform, checks: value.checks, mentioned: value.mentioned, visibility: value.checks ? value.mentioned / value.checks : 0 }))
          .sort((left, right) => right.checks - left.checks),
        lastCheckedAt: checks[0]?.checkedAt ?? null,
      },
      generatedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron leer las menciones.";
    const hint = /relation .* does not exist/i.test(message) ? " Ejecutá la migración de base de datos para crear las tablas de menciones." : "";
    return { status: "unavailable", prompts: [], checks: [], summary: EMPTY_SUMMARY, error: `${message}${hint}`, generatedAt };
  }
}
