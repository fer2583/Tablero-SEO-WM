import "server-only";

import { getDb } from "@/db/client";
import type { AiMentionCheckRecord, AiPromptRecord } from "@/lib/ai-mentions-types";

export type { AiMentionCheckRecord, AiPromptRecord } from "@/lib/ai-mentions-types";

const PROMPT_COLUMNS = `id, prompt, intent, language, status, created_at AS "createdAt", updated_at AS "updatedAt"`;

/**
 * Idempotent bootstrap for the additive AI mention tables. The production
 * secrets are write-only, so the normal migration step cannot always be run
 * from a workstation. This runs at most once per server process.
 */
let ensured: Promise<void> | null = null;
async function ensureAiMentionTables() {
  ensured ??= (async () => {
    const db = getDb();
    const exists = await db.query<{ name: string | null }>("SELECT to_regclass('public.ai_prompts')::text AS name");
    if (exists.rows[0]?.name) return;
    await db.query(`CREATE TABLE IF NOT EXISTS ai_prompts (
      id BIGSERIAL PRIMARY KEY,
      site_url TEXT NOT NULL,
      prompt TEXT NOT NULL,
      intent TEXT NOT NULL DEFAULT 'general',
      language TEXT NOT NULL DEFAULT 'es',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (site_url, prompt, language)
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS ai_mention_checks (
      id BIGSERIAL PRIMARY KEY,
      prompt_id BIGINT NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      mentioned BOOLEAN NOT NULL DEFAULT FALSE,
      brand_rank INTEGER,
      citation_url TEXT,
      sources JSONB NOT NULL DEFAULT '[]'::JSONB,
      excerpt TEXT,
      evidence_url TEXT,
      notes TEXT
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS ai_prompts_site_idx ON ai_prompts (site_url, status, created_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS ai_mention_checks_prompt_idx ON ai_mention_checks (prompt_id, checked_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS ai_mention_checks_platform_idx ON ai_mention_checks (platform, checked_at DESC)`);
  })().catch((error) => {
    ensured = null;
    throw error;
  });
  return ensured;
}

export async function listAiPrompts(siteUrl: string) {
  await ensureAiMentionTables();
  const result = await getDb().query<AiPromptRecord>(`SELECT ${PROMPT_COLUMNS} FROM ai_prompts WHERE site_url = $1 ORDER BY status ASC, created_at DESC`, [siteUrl]);
  return result.rows;
}

export async function createAiPrompt(siteUrl: string, input: { prompt: string; intent: string; language: string }) {
  await ensureAiMentionTables();
  const result = await getDb().query<AiPromptRecord>(
    `INSERT INTO ai_prompts (site_url, prompt, intent, language) VALUES ($1, $2, $3, $4)
     ON CONFLICT (site_url, prompt, language) DO UPDATE SET intent = EXCLUDED.intent, status = 'active', updated_at = NOW()
     RETURNING ${PROMPT_COLUMNS}`,
    [siteUrl, input.prompt, input.intent, input.language],
  );
  return result.rows[0];
}

export async function archiveAiPrompt(siteUrl: string, id: number) {
  await ensureAiMentionTables();
  const result = await getDb().query(`UPDATE ai_prompts SET status = 'archived', updated_at = NOW() WHERE site_url = $1 AND id = $2 RETURNING id`, [siteUrl, id]);
  return Boolean(result.rowCount);
}

export async function listAiMentionChecks(siteUrl: string, limit = 200) {
  await ensureAiMentionTables();
  const result = await getDb().query<AiMentionCheckRecord>(
    `SELECT c.id, c.prompt_id AS "promptId", c.platform, c.checked_at AS "checkedAt", c.mentioned,
            c.brand_rank AS "brandRank", c.citation_url AS "citationUrl", c.sources, c.excerpt,
            c.evidence_url AS "evidenceUrl", c.notes, p.prompt
     FROM ai_mention_checks c
     JOIN ai_prompts p ON p.id = c.prompt_id
     WHERE p.site_url = $1
     ORDER BY c.checked_at DESC
     LIMIT $2`,
    [siteUrl, limit],
  );
  return result.rows;
}

export async function createAiMentionCheck(
  siteUrl: string,
  input: {
    promptId: number;
    platform: string;
    mentioned: boolean;
    brandRank: number | null;
    citationUrl: string | null;
    sources: string[];
    excerpt: string | null;
    evidenceUrl: string | null;
    notes: string | null;
    checkedAt?: string | null;
  },
) {
  await ensureAiMentionTables();
  const prompt = await getDb().query<{ id: number }>("SELECT id FROM ai_prompts WHERE site_url = $1 AND id = $2", [siteUrl, input.promptId]);
  if (!prompt.rows[0]) throw new Error("Prompt no encontrado.");

  const result = await getDb().query<{ id: number }>(
    `INSERT INTO ai_mention_checks (prompt_id, platform, checked_at, mentioned, brand_rank, citation_url, sources, excerpt, evidence_url, notes)
     VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4, $5, $6, $7::jsonb, $8, $9, $10) RETURNING id`,
    [input.promptId, input.platform, input.checkedAt || null, input.mentioned, input.brandRank, input.citationUrl, JSON.stringify(input.sources), input.excerpt, input.evidenceUrl, input.notes],
  );
  return result.rows[0];
}

export async function deleteAiMentionCheck(siteUrl: string, id: number) {
  await ensureAiMentionTables();
  const result = await getDb().query("DELETE FROM ai_mention_checks c USING ai_prompts p WHERE c.prompt_id = p.id AND c.id = $1 AND p.site_url = $2", [id, siteUrl]);
  return Boolean(result.rowCount);
}
