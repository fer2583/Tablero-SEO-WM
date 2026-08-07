import "server-only";

import { getDb } from "@/db/client";

export type Synchronization = {
  source: string;
  status: "idle" | "running" | "success" | "error";
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lockExpiresAt: string | null;
};

export async function getSynchronization(source: string) {
  const result = await getDb().query<Synchronization>(
    `SELECT source, status, last_started_at AS "lastStartedAt", last_completed_at AS "lastCompletedAt", last_success_at AS "lastSuccessAt", last_error AS "lastError", lock_expires_at AS "lockExpiresAt"
     FROM synchronization WHERE source = $1`,
    [source],
  );
  return result.rows[0] ?? null;
}

export async function saveSynchronization(input: { source: string; status: Synchronization["status"]; error?: string | null }) {
  const result = await getDb().query<Synchronization>(
    `INSERT INTO synchronization (source, status, last_started_at, last_completed_at, last_success_at, last_error, updated_at)
     VALUES ($1, $2, CASE WHEN $2 = 'running' THEN NOW() ELSE NULL END, CASE WHEN $2 IN ('success', 'error') THEN NOW() ELSE NULL END, CASE WHEN $2 = 'success' THEN NOW() ELSE NULL END, $3, NOW())
     ON CONFLICT (source) DO UPDATE SET status = EXCLUDED.status, last_started_at = COALESCE(EXCLUDED.last_started_at, synchronization.last_started_at), last_completed_at = COALESCE(EXCLUDED.last_completed_at, synchronization.last_completed_at), last_success_at = COALESCE(EXCLUDED.last_success_at, synchronization.last_success_at), last_error = EXCLUDED.last_error, updated_at = NOW()
     RETURNING source, status, last_started_at AS "lastStartedAt", last_completed_at AS "lastCompletedAt", last_success_at AS "lastSuccessAt", last_error AS "lastError", lock_expires_at AS "lockExpiresAt"`,
    [input.source, input.status, input.error ?? null],
  );
  return result.rows[0];
}

export async function acquireSynchronizationLock(source: string, token: string, ttlSeconds = 300) {
  const db = getDb();
  await db.query(`INSERT INTO synchronization (source) VALUES ($1) ON CONFLICT (source) DO NOTHING`, [source]);
  const result = await db.query<{ source: string }>(
    `UPDATE synchronization SET lock_token = $2::uuid, lock_expires_at = NOW() + ($3 * INTERVAL '1 second'), status = 'running', last_started_at = NOW(), updated_at = NOW()
     WHERE source = $1 AND (lock_expires_at IS NULL OR lock_expires_at < NOW()) RETURNING source`,
    [source, token, ttlSeconds],
  );
  return result.rowCount === 1;
}

export async function releaseSynchronizationLock(source: string, token: string) {
  await getDb().query(
    `UPDATE synchronization SET lock_token = NULL, lock_expires_at = NULL, updated_at = NOW() WHERE source = $1 AND lock_token = $2::uuid`,
    [source, token],
  );
}

export type AuditSnapshotInput = {
  siteUrl: string;
  snapshotKey: string;
  status: string;
  snapshot: unknown;
  issues?: Array<{ key: string; category: string; severity: string; issue: string; evidence: string; recommendation: string; status: string }>;
};

export async function saveAuditSnapshot(input: AuditSnapshotInput) {
  const db = getDb();
  const run = await db.query<{ id: number }>(
    `INSERT INTO audit_runs (site_url, snapshot_key, status, completed_at, snapshot) VALUES ($1, $2, $3, NOW(), $4::jsonb)
     ON CONFLICT (site_url, snapshot_key) DO UPDATE SET status = EXCLUDED.status, completed_at = NOW(), snapshot = EXCLUDED.snapshot RETURNING id`,
    [input.siteUrl, input.snapshotKey, input.status, JSON.stringify(input.snapshot)],
  );
  const runId = run.rows[0].id;
  for (const issue of input.issues ?? []) {
    await db.query(
      `INSERT INTO audit_issues (audit_run_id, issue_key, category, severity, issue, evidence, recommendation, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (audit_run_id, issue_key) DO UPDATE SET category = EXCLUDED.category, severity = EXCLUDED.severity, issue = EXCLUDED.issue, evidence = EXCLUDED.evidence, recommendation = EXCLUDED.recommendation, status = EXCLUDED.status`,
      [runId, issue.key, issue.category, issue.severity, issue.issue, issue.evidence, issue.recommendation, issue.status],
    );
  }
  const snapshot = input.snapshot as { crawler?: { audited?: Array<Record<string, unknown>> }; devices?: Record<string, { psi?: Record<string, unknown>; crux?: Record<string, unknown> }> };
  for (const page of snapshot.crawler?.audited ?? []) await db.query(`INSERT INTO schema_coverage (audit_run_id, page_url, language, schema_types, json_ld_count, parse_errors) VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb) ON CONFLICT (audit_run_id, page_url) DO UPDATE SET language = EXCLUDED.language, schema_types = EXCLUDED.schema_types, json_ld_count = EXCLUDED.json_ld_count, parse_errors = EXCLUDED.parse_errors`, [runId, page.url, page.language ?? null, JSON.stringify(page.schemaTypes ?? []), page.jsonLd ?? 0, JSON.stringify(page.parseErrors ?? [])]);
  for (const [device, result] of Object.entries(snapshot.devices ?? {})) if (result.psi) await db.query(`INSERT INTO pagespeed_results (audit_run_id, site_url, device, status, scores, metrics, opportunities) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb) ON CONFLICT (audit_run_id, device) DO UPDATE SET status = EXCLUDED.status, scores = EXCLUDED.scores, metrics = EXCLUDED.metrics, opportunities = EXCLUDED.opportunities`, [runId, input.siteUrl, device, result.psi.status ?? "unavailable", JSON.stringify(result.psi.scores ?? {}), JSON.stringify(result.psi.metrics ?? {}), JSON.stringify(result.psi.opportunities ?? [])]);
  for (const [device, result] of Object.entries(snapshot.devices ?? {})) if (result.crux) await db.query(`INSERT INTO crux_results (audit_run_id, site_url, form_factor, origin, status, metrics) VALUES ($1, $2, $3, $4, $5, $6::jsonb) ON CONFLICT (audit_run_id, form_factor) DO UPDATE SET status = EXCLUDED.status, origin = EXCLUDED.origin, metrics = EXCLUDED.metrics`, [runId, input.siteUrl, device, result.crux.origin ?? input.siteUrl, result.crux.status ?? "unavailable", JSON.stringify(result.crux.metrics ?? {})]);
  return runId;
}

export async function getLatestAuditSnapshot(siteUrl: string) {
  const result = await getDb().query<{ id: number; snapshotKey: string; status: string; completedAt: string | null; snapshot: unknown }>(
    `SELECT id, snapshot_key AS "snapshotKey", status, completed_at AS "completedAt", snapshot FROM audit_runs WHERE site_url = $1 ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
    [siteUrl],
  );
  return result.rows[0] ?? null;
}

export async function getAuditHistory(siteUrl: string) {
  const result = await getDb().query<{ id: number; snapshotKey: string; status: string; completedAt: string | null }>(
    `SELECT id, snapshot_key AS "snapshotKey", status, completed_at AS "completedAt"
     FROM audit_runs WHERE site_url = $1 ORDER BY completed_at DESC NULLS LAST LIMIT 30`,
    [siteUrl],
  );
  return result.rows;
}

export type IndexationSnapshotInput = {
  siteUrl: string;
  snapshotKey: string;
  rows?: Array<{ url: string; status: string; verdict?: string | null; lastCrawl?: string | null; userCanonical?: string | null; googleCanonical?: string | null; robotsTxtState?: string | null; coverageState?: string | null; indexingState?: string | null; sitemap?: string | null; lastInspection?: string | null; error?: string; crawler?: unknown }>;
  sitemaps?: Array<{ path: string; isPending?: boolean | null; isSitemapsIndex?: boolean | null; lastSubmitted?: string | null; lastDownloaded?: string | null; warnings?: string[]; errors?: string[] }>;
};

export async function saveIndexationSnapshot(input: IndexationSnapshotInput) {
  const db = getDb();
  for (const row of input.rows ?? []) {
    await db.query(
      `INSERT INTO url_index_status (site_url, snapshot_key, url, status, verdict, last_crawl, user_canonical, google_canonical, robots_txt_state, coverage_state, indexing_state, sitemap, last_inspection, error, crawler)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
       ON CONFLICT (site_url, snapshot_key, url) DO UPDATE SET status = EXCLUDED.status, verdict = EXCLUDED.verdict, last_crawl = EXCLUDED.last_crawl, user_canonical = EXCLUDED.user_canonical, google_canonical = EXCLUDED.google_canonical, robots_txt_state = EXCLUDED.robots_txt_state, coverage_state = EXCLUDED.coverage_state, indexing_state = EXCLUDED.indexing_state, sitemap = EXCLUDED.sitemap, last_inspection = EXCLUDED.last_inspection, error = EXCLUDED.error, crawler = EXCLUDED.crawler`,
      [input.siteUrl, input.snapshotKey, row.url, row.status, row.verdict ?? null, row.lastCrawl ?? null, row.userCanonical ?? null, row.googleCanonical ?? null, row.robotsTxtState ?? null, row.coverageState ?? null, row.indexingState ?? null, row.sitemap ?? null, row.lastInspection ?? null, row.error ?? null, JSON.stringify(row.crawler ?? null)],
    );
  }
  for (const sitemap of input.sitemaps ?? []) {
    await db.query(
      `INSERT INTO sitemaps (site_url, snapshot_key, path, is_pending, is_sitemaps_index, last_submitted, last_downloaded, warnings, errors) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
       ON CONFLICT (site_url, snapshot_key, path) DO UPDATE SET is_pending = EXCLUDED.is_pending, is_sitemaps_index = EXCLUDED.is_sitemaps_index, last_submitted = EXCLUDED.last_submitted, last_downloaded = EXCLUDED.last_downloaded, warnings = EXCLUDED.warnings, errors = EXCLUDED.errors`,
      [input.siteUrl, input.snapshotKey, sitemap.path, sitemap.isPending ?? null, sitemap.isSitemapsIndex ?? null, sitemap.lastSubmitted ?? null, sitemap.lastDownloaded ?? null, JSON.stringify(sitemap.warnings ?? []), JSON.stringify(sitemap.errors ?? [])],
    );
  }
}

export async function getLatestIndexationSnapshot(siteUrl: string) {
  const result = await getDb().query<{ snapshotKey: string; completedAt: string; snapshot: unknown }>(
    `SELECT snapshot_key AS "snapshotKey", completed_at AS "completedAt", snapshot FROM indexation_runs WHERE site_url = $1 ORDER BY completed_at DESC LIMIT 1`,
    [siteUrl],
  );
  return result.rows[0] ?? null;
}

export async function saveIndexationRun(siteUrl: string, snapshotKey: string, snapshot: unknown) {
  await getDb().query(`INSERT INTO indexation_runs (site_url, snapshot_key, status, snapshot) VALUES ($1, $2, 'success', $3::jsonb) ON CONFLICT (site_url, snapshot_key) DO UPDATE SET completed_at = NOW(), snapshot = EXCLUDED.snapshot`, [siteUrl, snapshotKey, JSON.stringify(snapshot)]);
}

export async function saveSourceSnapshot(siteUrl: string, source: string, snapshotKey: string, snapshot: unknown) {
  await getDb().query(`INSERT INTO source_snapshots (site_url, source, snapshot_key, snapshot) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (site_url, source, snapshot_key) DO UPDATE SET completed_at = NOW(), snapshot = EXCLUDED.snapshot`, [siteUrl, source, snapshotKey, JSON.stringify(snapshot)]);
}

export async function getLatestSourceSnapshot(siteUrl: string, source: string) {
  const result = await getDb().query<{ completedAt: string; snapshot: unknown }>(`SELECT completed_at AS "completedAt", snapshot FROM source_snapshots WHERE site_url = $1 AND source = $2 ORDER BY completed_at DESC LIMIT 1`, [siteUrl, source]);
  return result.rows[0] ?? null;
}

export async function getLatestSourceSnapshotByPrefix(siteUrl: string, sourcePrefix: string) {
  const result = await getDb().query<{ source: string; completedAt: string; snapshot: unknown }>(`SELECT source, completed_at AS "completedAt", snapshot FROM source_snapshots WHERE site_url = $1 AND source LIKE $2 ORDER BY completed_at DESC LIMIT 1`, [siteUrl, `${sourcePrefix}%`]);
  return result.rows[0] ?? null;
}

export type SummaryRankingRow = { query: string; position: number | null; previousPosition: number | null; impressions: number | null };

export async function getSummaryRankingRows(siteUrl: string, currentStart: string, currentEnd: string, previousStart: string, previousEnd: string) {
  const result = await getDb().query<SummaryRankingRow>(
    `WITH current_rows AS (
       SELECT query, SUM(impressions)::float AS impressions,
              CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) END AS position
       FROM gsc_queries_daily WHERE site_url = $1 AND day BETWEEN $2 AND $3 GROUP BY query
     ), previous_rows AS (
       SELECT query, CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) END AS "previousPosition"
       FROM gsc_queries_daily WHERE site_url = $1 AND day BETWEEN $4 AND $5 GROUP BY query
     )
     SELECT current_rows.query, current_rows.position, previous_rows."previousPosition", current_rows.impressions
     FROM current_rows LEFT JOIN previous_rows USING (query)
     ORDER BY current_rows.impressions DESC NULLS LAST LIMIT 100`,
    [siteUrl, currentStart, currentEnd, previousStart, previousEnd],
  );
  return result.rows;
}

export type SummaryIssueCounts = { severity: string; count: number };

export async function getLatestAuditIssueCounts(siteUrl: string) {
  const result = await getDb().query<SummaryIssueCounts>(
    `SELECT ai.severity, COUNT(*)::int AS count
     FROM audit_issues ai JOIN audit_runs ar ON ar.id = ai.audit_run_id
     WHERE ar.site_url = $1 AND ar.id = (SELECT id FROM audit_runs WHERE site_url = $1 ORDER BY completed_at DESC NULLS LAST LIMIT 1)
     GROUP BY ai.severity`,
    [siteUrl],
  );
  return result.rows;
}

export async function getLatestAuditVitals(siteUrl: string) {
  const result = await getDb().query<{ device: string; kind: string; status: string; scores: unknown; metrics: unknown }>(
    `SELECT device, 'pagespeed' AS kind, status, scores, metrics FROM pagespeed_results
     WHERE site_url = $1 AND audit_run_id = (SELECT id FROM audit_runs WHERE site_url = $1 ORDER BY completed_at DESC NULLS LAST LIMIT 1)
     UNION ALL
     SELECT form_factor AS device, 'crux' AS kind, status, '{}'::jsonb AS scores, metrics FROM crux_results
     WHERE site_url = $1 AND audit_run_id = (SELECT id FROM audit_runs WHERE site_url = $1 ORDER BY completed_at DESC NULLS LAST LIMIT 1)`,
    [siteUrl],
  );
  return result.rows;
}

export type MetricRow = { day: string; value?: number; siteUrl: string; country?: string; device?: string; language?: string; query?: string; pageUrl?: string; channel?: string; landingPage?: string; clicks?: number; impressions?: number; ctr?: number; position?: number; users?: number; sessions?: number; conversions?: number; engagedSessions?: number; engagementRate?: number; engagementDuration?: number };

export async function saveGscPerformance(rows: MetricRow[]) {
  for (const row of rows) await getDb().query(`INSERT INTO gsc_performance_daily (site_url, day, country, device, language, clicks, impressions, ctr, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (site_url, day, country, device, language) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions, ctr = EXCLUDED.ctr, position = EXCLUDED.position, fetched_at = NOW()`, [row.siteUrl, row.day, row.country ?? "all", row.device ?? "all", row.language ?? "all", row.clicks ?? row.value, row.impressions ?? 0, row.ctr ?? 0, row.position ?? 0]);
}

export async function saveGscQueries(rows: MetricRow[]) {
  for (const row of rows) await getDb().query(`INSERT INTO gsc_queries_daily (site_url, day, query, country, device, clicks, impressions, ctr, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (site_url, day, query, country, device) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions, ctr = EXCLUDED.ctr, position = EXCLUDED.position, fetched_at = NOW()`, [row.siteUrl, row.day, row.query ?? "", row.country ?? "all", row.device ?? "all", row.clicks ?? 0, row.impressions ?? 0, row.ctr ?? 0, row.position ?? 0]);
}

export async function saveGscPages(rows: MetricRow[]) {
  for (const row of rows) await getDb().query(`INSERT INTO gsc_pages_daily (site_url, day, page_url, country, device, clicks, impressions, ctr, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (site_url, day, page_url, country, device) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions, ctr = EXCLUDED.ctr, position = EXCLUDED.position, fetched_at = NOW()`, [row.siteUrl, row.day, row.pageUrl ?? "", row.country ?? "all", row.device ?? "all", row.clicks ?? 0, row.impressions ?? 0, row.ctr ?? 0, row.position ?? 0]);
}

export async function saveGa4Daily(rows: MetricRow[]) {
  for (const row of rows) await getDb().query(`INSERT INTO ga4_daily (site_url, day, country, device, channel, users, sessions, engaged_sessions, conversions, engagement_rate, engagement_duration) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (site_url, day, country, device, channel) DO UPDATE SET users = EXCLUDED.users, sessions = EXCLUDED.sessions, engaged_sessions = EXCLUDED.engaged_sessions, conversions = EXCLUDED.conversions, engagement_rate = EXCLUDED.engagement_rate, engagement_duration = EXCLUDED.engagement_duration, fetched_at = NOW()`, [row.siteUrl, row.day, row.country ?? "all", row.device ?? "all", row.channel ?? "all", row.users ?? 0, row.sessions ?? 0, row.engagedSessions ?? 0, row.conversions ?? 0, row.engagementRate ?? 0, row.engagementDuration ?? 0]);
}

export async function saveGa4LandingPages(rows: MetricRow[]) {
  for (const row of rows) await getDb().query(`INSERT INTO ga4_landing_pages (site_url, day, landing_page, country, device, users, sessions, conversions, engagement_rate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (site_url, day, landing_page, country, device) DO UPDATE SET users = EXCLUDED.users, sessions = EXCLUDED.sessions, conversions = EXCLUDED.conversions, engagement_rate = EXCLUDED.engagement_rate, fetched_at = NOW()`, [row.siteUrl, row.day, row.landingPage ?? "", row.country ?? "all", row.device ?? "all", row.users ?? 0, row.sessions ?? 0, row.conversions ?? 0, row.engagementRate ?? 0]);
}
