export const CRITERIA_VERSION = "2026-10-24.1";
export type BrowserFinding = {
  scenario: string; url: string; viewport: string; criterion: string; title: string;
  severity: "Alta" | "Media" | "Baja"; confidence: "alta" | "media";
  evaluation: "automatic" | "review"; evidence: string; recommendation: string; artifact?: string;
};
export type BrowserScenario = { id: string; url: string; language: string; template: string; viewport: "mobile" | "desktop" };
export type ScenarioResult = BrowserScenario & {
  status: "completed" | "error"; error?: string; screenshot?: string; trace?: string;
  initialTitle?: string | null; renderedTitle?: string | null; ctaCount?: number; formCount?: number;
  checks: Array<{ criterion: string; status: "passed" | "failed" | "review" | "not_applicable"; evidence: string }>;
};
export type BrowserReport = {
  persistedArtifacts?: string[];
  id: string; auditRunId?: number; createdAt: string; criteriaVersion: string; browserVersion: string;
  scenarios: ScenarioResult[]; findings: BrowserFinding[];
  summary: { automaticFailures: number; reviewFindings: number; journeys: { evaluated: number; passed: number } };
};
export type JourneyStep =
  | { action: "click"; selector: string; expectedUrl?: string; expectVisible?: string }
  | { action: "expect"; selector: string }
  | { action: "press"; key: "Tab" | "Shift+Tab" | "Escape" | "Enter"; expectFocused?: string };
export type BrowserCriteria = {
  readySelector?: string;
  version: string; ctaSelector: string; ctaRequiredTemplates: string[];
  menu?: { button: string; panel: string; closeButton?: string };
  journeys: Array<{ id: string; description: string; templates: string[]; languages?: string[]; viewport?: "mobile" | "desktop"; steps: JourneyStep[] }>;
  masks: string[]; minBodyFontPx: number; maxScenarios: number; visualDifferenceThreshold: number;
};
