export type SignalCategory = "oportunidad" | "tecnico" | "ia" | "alerta" | "datos";
export type SignalConfidence = "alta" | "media" | "baja";
export type SignalEffort = "bajo" | "medio" | "alto";

export type IntelligenceSignal = {
  id: string;
  category: SignalCategory;
  title: string;
  detail: string;
  metric?: string;
  impact: number;
  confidence: SignalConfidence;
  effort: SignalEffort;
  score: number;
  href: string;
  evidence?: string;
};

export type IntelligenceSources = {
  keywords: "live" | "unavailable";
  audit: "live" | "unavailable";
  alerts: "live" | "unavailable";
  ai: "live" | "unavailable";
  mentions: "live" | "empty" | "unavailable";
};

export type IntelligencePayload = {
  status: "live" | "partial" | "unavailable";
  generatedAt: string;
  period: { start: string; end: string; previousStart: string; previousEnd: string };
  sources: IntelligenceSources;
  summary: { signals: number; opportunities: number; risks: number; topScore: number };
  signals: IntelligenceSignal[];
  brief: string[];
};
