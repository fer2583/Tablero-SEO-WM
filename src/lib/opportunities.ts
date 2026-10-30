export type OpportunityInput = {
  impressions: number;
  ctr: number;
  position: number;
  clicks?: number;
};

/**
 * Reglas únicas de oportunidad para Keywords, Contenido y Resumen.
 * Antes Keywords y Contenido usaban umbrales distintos y daban resultados
 * incompatibles para la misma consulta.
 */
export const OPPORTUNITY_RULES = {
  minImpressions: 50,
  minPosition: 3,
  maxPosition: 30,
  minPotentialClicks: 5,
} as const;

/**
 * Curva de CTR esperada por posición, basada en benchmarks públicos de búsqueda
 * orgánica. Se usa solo para estimar potencial, nunca como dato observado.
 */
export const CTR_BY_POSITION = [0.284, 0.152, 0.113, 0.081, 0.061, 0.045, 0.035, 0.028, 0.024, 0.019];

export function expectedCtrFor(position: number): number | null {
  if (!Number.isFinite(position) || position <= 0) return null;
  if (position <= 10) return CTR_BY_POSITION[Math.ceil(position) - 1] ?? 0.019;
  return Math.max(0.002, 0.019 * Math.pow(10 / position, 0.7));
}

export function potentialClicksFor(input: OpportunityInput): number | null {
  const expected = expectedCtrFor(input.position);
  if (expected == null) return null;
  const impressions = Math.max(input.impressions, 1);
  const observed = input.clicks != null ? input.clicks / impressions : input.ctr;
  return Math.max(0, Math.round(impressions * Math.max(0, expected - observed)));
}

export function opportunityScoreFor(input: OpportunityInput): number | null {
  const potential = potentialClicksFor(input);
  if (potential == null) return null;
  return Math.min(100, Math.round((potential / Math.max(input.impressions, 1)) * 380));
}

export function isOpportunity(input: OpportunityInput): boolean {
  if (!Number.isFinite(input.position) || input.position < OPPORTUNITY_RULES.minPosition || input.position > OPPORTUNITY_RULES.maxPosition) return false;
  if (input.impressions < OPPORTUNITY_RULES.minImpressions) return false;
  const potential = potentialClicksFor(input);
  return potential != null && potential >= OPPORTUNITY_RULES.minPotentialClicks;
}

/** Una query con varias páginas es una señal a revisar, no un conflicto confirmado. */
export function cannibalizationConfidence(pageCount: number): "possible" | "none" {
  return pageCount > 1 ? "possible" : "none";
}
