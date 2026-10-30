-- Fase 1: persistence primitives for the SEO dashboard.
-- Safe to run repeatedly. Run this file against the target Neon/Vercel Postgres database.

CREATE TABLE IF NOT EXISTS synchronization (
  source TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'success', 'error')),
  last_started_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  lock_token UUID,
  lock_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gsc_performance_daily (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  day DATE NOT NULL,
  country TEXT NOT NULL DEFAULT 'all',
  device TEXT NOT NULL DEFAULT 'all',
  language TEXT NOT NULL DEFAULT 'all',
  clicks NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  position NUMERIC NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, day, country, device, language)
);

CREATE TABLE IF NOT EXISTS gsc_queries_daily (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  day DATE NOT NULL,
  query TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'all',
  device TEXT NOT NULL DEFAULT 'all',
  clicks NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  position NUMERIC NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, day, query, country, device)
);

CREATE TABLE IF NOT EXISTS gsc_pages_daily (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  day DATE NOT NULL,
  page_url TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'all',
  device TEXT NOT NULL DEFAULT 'all',
  clicks NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  position NUMERIC NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, day, page_url, country, device)
);

CREATE TABLE IF NOT EXISTS ga4_daily (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  day DATE NOT NULL,
  country TEXT NOT NULL DEFAULT 'all',
  device TEXT NOT NULL DEFAULT 'all',
  channel TEXT NOT NULL DEFAULT 'all',
  users NUMERIC NOT NULL DEFAULT 0,
  sessions NUMERIC NOT NULL DEFAULT 0,
  engaged_sessions NUMERIC NOT NULL DEFAULT 0,
  conversions NUMERIC NOT NULL DEFAULT 0,
  engagement_rate NUMERIC NOT NULL DEFAULT 0,
  engagement_duration NUMERIC NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, day, country, device, channel)
);

CREATE TABLE IF NOT EXISTS ga4_landing_pages (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  day DATE NOT NULL,
  landing_page TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'all',
  device TEXT NOT NULL DEFAULT 'all',
  users NUMERIC NOT NULL DEFAULT 0,
  sessions NUMERIC NOT NULL DEFAULT 0,
  conversions NUMERIC NOT NULL DEFAULT 0,
  engagement_rate NUMERIC NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, day, landing_page, country, device)
);

CREATE TABLE IF NOT EXISTS audit_runs (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  snapshot_key TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (site_url, snapshot_key)
);

CREATE TABLE IF NOT EXISTS audit_issues (
  id BIGSERIAL PRIMARY KEY,
  audit_run_id BIGINT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  issue_key TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  issue TEXT NOT NULL,
  evidence TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL,
  UNIQUE (audit_run_id, issue_key)
);

CREATE TABLE IF NOT EXISTS schema_coverage (
  id BIGSERIAL PRIMARY KEY,
  audit_run_id BIGINT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  language TEXT,
  schema_types JSONB NOT NULL DEFAULT '[]'::JSONB,
  json_ld_count INTEGER NOT NULL DEFAULT 0,
  parse_errors JSONB NOT NULL DEFAULT '[]'::JSONB,
  UNIQUE (audit_run_id, page_url)
);

CREATE TABLE IF NOT EXISTS pagespeed_results (
  id BIGSERIAL PRIMARY KEY,
  audit_run_id BIGINT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  device TEXT NOT NULL,
  status TEXT NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}'::JSONB,
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  opportunities JSONB NOT NULL DEFAULT '[]'::JSONB,
  UNIQUE (audit_run_id, device)
);

CREATE TABLE IF NOT EXISTS crux_results (
  id BIGSERIAL PRIMARY KEY,
  audit_run_id BIGINT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  form_factor TEXT NOT NULL,
  origin TEXT NOT NULL,
  status TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (audit_run_id, form_factor)
);

CREATE TABLE IF NOT EXISTS url_index_status (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  snapshot_key TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  verdict TEXT,
  last_crawl TIMESTAMPTZ,
  user_canonical TEXT,
  google_canonical TEXT,
  robots_txt_state TEXT,
  coverage_state TEXT,
  indexing_state TEXT,
  sitemap TEXT,
  last_inspection TIMESTAMPTZ,
  error TEXT,
  crawler JSONB,
  UNIQUE (site_url, snapshot_key, url)
);

CREATE TABLE IF NOT EXISTS sitemaps (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  snapshot_key TEXT NOT NULL,
  path TEXT NOT NULL,
  is_pending BOOLEAN,
  is_sitemaps_index BOOLEAN,
  last_submitted TIMESTAMPTZ,
  last_downloaded TIMESTAMPTZ,
  warnings JSONB NOT NULL DEFAULT '[]'::JSONB,
  errors JSONB NOT NULL DEFAULT '[]'::JSONB,
  UNIQUE (site_url, snapshot_key, path)
);

CREATE TABLE IF NOT EXISTS indexation_runs (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  snapshot_key TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (site_url, snapshot_key)
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  source TEXT NOT NULL,
  snapshot_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (site_url, source, snapshot_key)
);

CREATE TABLE IF NOT EXISTS keyword_targets (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  keyword TEXT NOT NULL,
  target_url TEXT,
  language TEXT NOT NULL DEFAULT 'all',
  country TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, keyword, language, country)
);

CREATE TABLE IF NOT EXISTS keyword_history (
  id BIGSERIAL PRIMARY KEY,
  keyword_target_id BIGINT NOT NULL REFERENCES keyword_targets(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  position NUMERIC,
  clicks NUMERIC,
  impressions NUMERIC,
  ctr NUMERIC,
  UNIQUE (keyword_target_id, day)
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  source TEXT NOT NULL,
  rule TEXT NOT NULL,
  entity TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metric TEXT,
  current_value NUMERIC,
  previous_value NUMERIC,
  variation NUMERIC,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  related_url TEXT,
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  UNIQUE (site_url, fingerprint)
);

CREATE INDEX IF NOT EXISTS synchronization_lock_idx ON synchronization (lock_expires_at);
CREATE INDEX IF NOT EXISTS gsc_performance_daily_lookup_idx ON gsc_performance_daily (site_url, day);
CREATE INDEX IF NOT EXISTS gsc_queries_daily_lookup_idx ON gsc_queries_daily (site_url, day);
CREATE INDEX IF NOT EXISTS gsc_pages_daily_lookup_idx ON gsc_pages_daily (site_url, day);
CREATE INDEX IF NOT EXISTS ga4_daily_lookup_idx ON ga4_daily (site_url, day);
CREATE INDEX IF NOT EXISTS ga4_landing_pages_lookup_idx ON ga4_landing_pages (site_url, day);
CREATE INDEX IF NOT EXISTS audit_runs_latest_idx ON audit_runs (site_url, completed_at DESC);
CREATE INDEX IF NOT EXISTS audit_issues_run_idx ON audit_issues (audit_run_id);
CREATE INDEX IF NOT EXISTS schema_coverage_run_idx ON schema_coverage (audit_run_id);
CREATE INDEX IF NOT EXISTS url_index_status_latest_idx ON url_index_status (site_url, snapshot_key);
CREATE INDEX IF NOT EXISTS sitemaps_latest_idx ON sitemaps (site_url, snapshot_key);
CREATE INDEX IF NOT EXISTS indexation_runs_latest_idx ON indexation_runs (site_url, completed_at DESC);
CREATE INDEX IF NOT EXISTS source_snapshots_latest_idx ON source_snapshots (site_url, source, completed_at DESC);
CREATE INDEX IF NOT EXISTS keyword_history_day_idx ON keyword_history (keyword_target_id, day DESC);
CREATE INDEX IF NOT EXISTS alerts_site_status_idx ON alerts (site_url, status, detected_at DESC);

-- Crawler v2: additive migration; legacy snapshots remain readable.
ALTER TABLE audit_runs ADD COLUMN IF NOT EXISTS crawl_state JSONB;
ALTER TABLE audit_runs ADD COLUMN IF NOT EXISTS lock_token UUID;
ALTER TABLE audit_runs ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;
ALTER TABLE audit_runs ADD COLUMN IF NOT EXISTS rules_version TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS audit_runs_one_active_idx ON audit_runs (site_url)
  WHERE status IN ('queued', 'running', 'paused');

CREATE TABLE IF NOT EXISTS audit_pages (
  audit_run_id BIGINT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  result JSONB NOT NULL,
  PRIMARY KEY (audit_run_id, url)
);
CREATE TABLE IF NOT EXISTS audit_links (
  audit_run_id BIGINT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor TEXT NOT NULL DEFAULT '',
  nofollow BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (audit_run_id, source_url, target_url)
);
CREATE INDEX IF NOT EXISTS audit_links_target_idx ON audit_links (audit_run_id, target_url);

CREATE TABLE IF NOT EXISTS audit_browser_reports (
  id UUID PRIMARY KEY,
  audit_run_id BIGINT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criteria_version TEXT NOT NULL,
  report JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_browser_reports_run_idx ON audit_browser_reports (audit_run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_browser_artifacts (
  report_id UUID NOT NULL REFERENCES audit_browser_reports(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content BYTEA NOT NULL CHECK (octet_length(content) <= 3000000),
  PRIMARY KEY (report_id, name)
);

-- AI Search: manual mention registry (GEO/AEO). Zero external API cost.
CREATE TABLE IF NOT EXISTS ai_prompts (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'general',
  language TEXT NOT NULL DEFAULT 'es',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, prompt, language)
);

CREATE TABLE IF NOT EXISTS ai_mention_checks (
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
);

CREATE INDEX IF NOT EXISTS ai_prompts_site_idx ON ai_prompts (site_url, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_mention_checks_prompt_idx ON ai_mention_checks (prompt_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS ai_mention_checks_platform_idx ON ai_mention_checks (platform, checked_at DESC);


-- Histórico conjunto consulta + página (relación que GSC entrega en vivo y
-- antes se descartaba al guardar queries y pages por separado).
CREATE TABLE IF NOT EXISTS gsc_query_pages_daily (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  day DATE NOT NULL,
  query TEXT NOT NULL,
  page_url TEXT NOT NULL,
  clicks NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  position NUMERIC NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, day, query, page_url)
);

CREATE INDEX IF NOT EXISTS gsc_query_pages_daily_range_idx ON gsc_query_pages_daily (site_url, day);

-- Tráfico IA persistido para no consultar GA4 en vivo en cada carga.
CREATE TABLE IF NOT EXISTS ga4_ai_daily (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  day DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'all',
  users NUMERIC NOT NULL DEFAULT 0,
  sessions NUMERIC NOT NULL DEFAULT 0,
  conversions NUMERIC NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_url, day, source)
);

CREATE INDEX IF NOT EXISTS ga4_ai_daily_range_idx ON ga4_ai_daily (site_url, day);
