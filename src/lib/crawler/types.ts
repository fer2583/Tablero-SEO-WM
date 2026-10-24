import type { SitemapData } from "../site";
import rules from "../../../audit.rules.config";

export const RULES_VERSION = rules.version;
export type Severity = "Alta" | "Media" | "Baja";
export type CrawlOutcome = "html" | "http_error" | "timeout" | "network_error" | "blocked" | "robots_unavailable" | "non_html" | "truncated";
export type Link = { url: string; text: string; nofollow: boolean };
export type CrawlConfig = { maxUrls: number; batchSize: number; concurrency: number; maxQueryUrls: number; maxDepth: number; incremental?: boolean };
export type RobotsPolicy = { status: "live" | "partial" | "unavailable"; text: string; fetchedAt: string; message?: string; retryAt?: string };
export type Traffic = { clicks: number; impressions: number; users: number; start: string; end: string };
export type CrawlPage = {
  url: string; language: string; template: string; httpStatus: number | null;
  title: string | null; metaDescription: string | null; h1: string[]; h2: string[]; h3: string[];
  canonical: string | null; canonicals: string[]; robotsMeta: string | null; xRobotsTag: string | null;
  openGraph: number | null; jsonLd: number; schemaEntities: number; schemaTypes: string[]; parseErrors: string[];
  internalLinks: number | null; imagesWithoutAlt: number | null; redirects: string[];
  status: "live" | "partial" | "unavailable" | "error"; outcome: CrawlOutcome; error?: string;
  finalUrl: string; durationMs: number; bodyTruncated: boolean; links: Link[];
  hreflang: Array<{ language: string; url: string }>; wordCount: number; contentHash: string | null;
  depth: number | null; sources: string[]; indexable: boolean | null; retryAt?: string; attempts: number; traffic?: Traffic;
  etag?: string; lastModified?: string; revalidated?: boolean;
  errorPageHint?: string;
};
export type CrawlIssue = {
  id: string; rule: string; url: string; category: string; issue: string; severity: Severity;
  evidence: string; recommendation: string; status: "open" | "unavailable"; evaluation: "automatic" | "review";
};
export type RuleResult = { rule: string; category: string; weight: number; eligible: number; affected: number; score: number | null };
export type CrawlReport = {
  exceptions: Array<{ rule: string; url: string; reason: string; expiresAt: string }>;
  issues: CrawlIssue[]; rules: RuleResult[]; score: number | null; coverage: number;
  categories: Array<{ category: string; score: number | null; evaluated: number }>;
  groups: Array<{ rule: string; issue: string; severity: Severity; count: number; urls: string[] }>;
  comparison: { new: string[]; resolved: string[]; persistent: string[]; unevaluated: string[] };
};
export type QueueEntry = { url: string; sources: string[]; attempts: number };
export type CrawlState = {
  scope?: "full" | "selective";
  ruleConfig?: typeof rules;
  version: string; config: CrawlConfig; robots: RobotsPolicy; sitemap: SitemapData;
  queue: QueueEntry[]; pages: CrawlPage[]; known: string[]; excluded: { url: string; reason: string }[];
  limitReached: boolean; retryAt?: string; message?: string; previousIssues: CrawlIssue[];
  traffic: Record<string, Traffic>;
  previousPages?: Record<string, CrawlPage>;
};
export type RunStatus = "queued" | "running" | "paused" | "completed" | "cancelled";
export type CrawlRun = { id: number; status: RunStatus; startedAt: string; completedAt: string | null; state: CrawlState; savedSnapshot?: unknown };

export function crawlConfig(): CrawlConfig {
  const bounded = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
  };
  return { maxUrls: bounded("AUDIT_CRAWL_LIMIT", 2000, 1, 10000), batchSize: bounded("AUDIT_BATCH_SIZE", 25, 1, 50), concurrency: bounded("AUDIT_CONCURRENCY", 4, 1, 8), maxQueryUrls: bounded("AUDIT_QUERY_LIMIT", 100, 1, 500), maxDepth: bounded("AUDIT_MAX_DEPTH", 10, 1, 30), incremental: process.env.AUDIT_INCREMENTAL === "true" };
}
