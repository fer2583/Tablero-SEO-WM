import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./client";
import { SITE_URL } from "../lib/site";
import type { AuditData } from "../lib/audit";
import type { CrawlRun, CrawlState, RunStatus, Traffic } from "../lib/crawler/types";

const columns = `id::int, status, started_at AS "startedAt", completed_at AS "completedAt", crawl_state AS state, snapshot AS "savedSnapshot"`;
export class AuditConflict extends Error {}

export function auditStore(db = getDb()) {
  return {
    async active() {
      const result = await db.query<CrawlRun>(`SELECT ${columns} FROM audit_runs WHERE site_url=$1 AND status IN ('queued','running','paused') ORDER BY id DESC LIMIT 1`, [SITE_URL]);
      return result.rows[0] ?? null;
    },
    async get(id: number) {
      const result = await db.query<CrawlRun>(`SELECT ${columns} FROM audit_runs WHERE id=$1 AND site_url=$2 AND crawl_state IS NOT NULL`, [id, SITE_URL]);
      return result.rows[0] ?? null;
    },
    async create(state: CrawlState) {
      const result = await db.query<CrawlRun>(`INSERT INTO audit_runs (site_url,snapshot_key,status,crawl_state,rules_version)
        VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (site_url) WHERE status IN ('queued','running','paused') DO NOTHING RETURNING ${columns}`,
      [SITE_URL, randomUUID(), state.robots.status === "unavailable" ? "paused" : "queued", JSON.stringify(state), state.version]);
      return result.rows[0] ?? await this.active();
    },
    async claim(id: number, token: string) {
      const result = await db.query<CrawlRun>(`UPDATE audit_runs SET lock_token=$2::uuid,lock_expires_at=NOW()+INTERVAL '120 seconds',status='running'
        WHERE id=$1 AND site_url=$3 AND status IN ('queued','running') AND (lock_expires_at IS NULL OR lock_expires_at<NOW()) RETURNING ${columns}`, [id, token, SITE_URL]);
      return result.rows[0] ?? null;
    },
    async release(id: number, token: string) {
      await db.query(`UPDATE audit_runs SET lock_token=NULL,lock_expires_at=NULL WHERE id=$1 AND lock_token=$2::uuid`, [id, token]);
    },
    async action(id: number, action: "pause" | "resume" | "cancel") {
      const next: RunStatus = action === "pause" ? "paused" : action === "resume" ? "queued" : "cancelled";
      // Never change the status underneath an owned batch. Expired leases are recoverable.
      const result = await db.query<CrawlRun>(`UPDATE audit_runs SET status=$2,lock_token=NULL,lock_expires_at=NULL WHERE id=$1 AND site_url=$3
        AND status IN ('queued','running','paused') AND (lock_expires_at IS NULL OR lock_expires_at<NOW()) RETURNING ${columns}`, [id, next, SITE_URL]);
      if (!result.rows[0]) throw new AuditConflict("Hay un lote activo o la corrida ya terminó. Reintentar al finalizar el lote.");
      return result.rows[0];
    },
    async checkpoint(id: number, token: string, state: CrawlState, snapshot: AuditData) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const owned = await client.query(`SELECT id FROM audit_runs WHERE id=$1 AND site_url=$3 AND lock_token=$2::uuid AND lock_expires_at>NOW() AND status='running' FOR UPDATE`, [id, token, SITE_URL]);
        if (!owned.rowCount) throw new AuditConflict("El lote perdió su bloqueo; no se guardaron resultados obsoletos.");
        const completed = !state.queue.length;
        const status: RunStatus = state.retryAt || state.robots.status === "unavailable" ? "paused" : completed ? "completed" : "running";
        await client.query(`INSERT INTO audit_pages (audit_run_id,url,result) SELECT $1,p->>'url',p FROM jsonb_array_elements($2::jsonb) p
          ON CONFLICT (audit_run_id,url) DO UPDATE SET result=EXCLUDED.result`, [id, JSON.stringify(state.pages)]);
        const links = state.pages.flatMap((page) => page.links.map((link) => ({ source: page.url, target: link.url, anchor: link.text, nofollow: link.nofollow })));
        await client.query(`INSERT INTO audit_links (audit_run_id,source_url,target_url,anchor,nofollow)
          SELECT $1,source,target,anchor,nofollow FROM jsonb_to_recordset($2::jsonb) AS x(source text,target text,anchor text,nofollow boolean)
          ON CONFLICT (audit_run_id,source_url,target_url) DO NOTHING`, [id, JSON.stringify(links)]);
        if (status === "completed") {
          await client.query(`DELETE FROM audit_issues WHERE audit_run_id=$1`, [id]);
          await client.query(`INSERT INTO audit_issues (audit_run_id,issue_key,category,severity,issue,evidence,recommendation,status)
            SELECT $1,id,category,severity,issue,evidence,recommendation,status FROM jsonb_to_recordset($2::jsonb)
            AS x(id text,category text,severity text,issue text,evidence text,recommendation text,status text)`, [id, JSON.stringify(snapshot.crawler.issues)]);
          await client.query(`INSERT INTO schema_coverage (audit_run_id,page_url,language,schema_types,json_ld_count,parse_errors)
            SELECT $1,p->>'url',p->>'language',p->'schemaTypes',(p->>'jsonLd')::int,p->'parseErrors' FROM jsonb_array_elements($2::jsonb) p
            ON CONFLICT (audit_run_id,page_url) DO UPDATE SET language=EXCLUDED.language,schema_types=EXCLUDED.schema_types,json_ld_count=EXCLUDED.json_ld_count,parse_errors=EXCLUDED.parse_errors`, [id, JSON.stringify(state.pages.filter((page) => page.outcome === "html"))]);
        }
        await client.query(`UPDATE audit_runs SET crawl_state=$3::jsonb,snapshot=$4::jsonb,status=$5,
          completed_at=CASE WHEN $5='completed' THEN NOW() ELSE NULL END,lock_token=NULL,lock_expires_at=NULL WHERE id=$1 AND lock_token=$2::uuid`, [id, token, JSON.stringify(state), JSON.stringify(snapshot), status]);
        await client.query("COMMIT");
        return status;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async seeds(): Promise<{ urls: string[]; traffic: Record<string, Traffic> }> {
      // Each source is aggregated separately before joining to avoid multiplying metrics.
      const result = await db.query<{ url: string; clicks: number; impressions: number; users: number; start: string; end: string }>(`
        WITH gsc AS (SELECT page_url AS url,SUM(clicks)::float clicks,SUM(impressions)::float impressions FROM gsc_pages_daily
          WHERE site_url=$1 AND day BETWEEN CURRENT_DATE-INTERVAL '30 days' AND CURRENT_DATE-INTERVAL '1 day' GROUP BY page_url),
        ga AS (SELECT CASE WHEN landing_page LIKE 'http%' THEN landing_page ELSE $1 || ltrim(landing_page,'/') END AS url,SUM(users)::float users FROM ga4_landing_pages
          WHERE site_url=$1 AND day BETWEEN CURRENT_DATE-INTERVAL '30 days' AND CURRENT_DATE-INTERVAL '1 day' GROUP BY 1)
        SELECT COALESCE(gsc.url,ga.url) url,COALESCE(clicks,0) clicks,COALESCE(impressions,0) impressions,COALESCE(users,0) users,
          (CURRENT_DATE-INTERVAL '30 days')::date::text start,(CURRENT_DATE-INTERVAL '1 day')::date::text end FROM gsc FULL JOIN ga USING(url)
        ORDER BY COALESCE(impressions,0)+COALESCE(users,0) DESC LIMIT 2000`, [SITE_URL]);
      return { urls: result.rows.map((row) => row.url), traffic: Object.fromEntries(result.rows.map(({ url, ...traffic }) => [url, traffic])) };
    },
    async browserReports(id: number) {
      const result = await db.query<{ report: unknown }>(`SELECT report FROM audit_browser_reports WHERE audit_run_id=$1 ORDER BY created_at DESC LIMIT 5`, [id]);
      return result.rows.map((row) => row.report);
    },
  };
}
