export const MENTION_PLATFORMS = ["ChatGPT", "Perplexity", "Gemini", "Copilot", "Claude", "DeepSeek", "Google AI Overviews", "Otra"] as const;
export type MentionPlatform = (typeof MENTION_PLATFORMS)[number];

export const PROMPT_INTENTS = ["general", "comparación", "problema", "marca", "local"] as const;

export type AiPromptRecord = {
  id: number;
  prompt: string;
  intent: string;
  language: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type AiMentionCheckRecord = {
  id: number;
  promptId: number;
  platform: string;
  checkedAt: string;
  mentioned: boolean;
  brandRank: number | null;
  citationUrl: string | null;
  sources: string[];
  excerpt: string | null;
  evidenceUrl: string | null;
  notes: string | null;
  prompt: string;
};

export type MentionsSummary = {
  prompts: number;
  checked: number;
  mentioned: number;
  visibility: number;
  averageRank: number | null;
  platforms: Array<{ platform: string; checks: number; mentioned: number; visibility: number }>;
  lastCheckedAt: string | null;
};

export type MentionsPayload = {
  status: "live" | "empty" | "unavailable";
  prompts: AiPromptRecord[];
  checks: AiMentionCheckRecord[];
  summary: MentionsSummary;
  error?: string;
  generatedAt: string;
};
