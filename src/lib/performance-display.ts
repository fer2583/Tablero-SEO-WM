export function formatPerformanceMetric(key: string, value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "Sin datos";
  const numeric = Number(value);
  if (key === "cls") return numeric.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return numeric >= 1000 ? `${(numeric / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} s` : `${Math.round(numeric).toLocaleString("es-ES")} ms`;
}
export function webVitalRating(key: string, value: number | null | undefined): "good" | "needs-improvement" | "poor" | "unavailable" {
  const thresholds: Record<string, [number, number]> = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] };
  if (!thresholds[key] || value == null || !Number.isFinite(Number(value))) return "unavailable";
  return Number(value) <= thresholds[key][0] ? "good" : Number(value) <= thresholds[key][1] ? "needs-improvement" : "poor";
}
export function coreWebVitalsAssessment(metrics: Record<string, number | null>) {
  const ratings = ["lcp", "inp", "cls"].map((key) => webVitalRating(key, metrics[key]));
  return ratings.includes("unavailable") ? "incomplete" : ratings.every((rating) => rating === "good") ? "passed" : "needs-attention";
}
export function formatCollectionPeriod(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const period = value as Record<string, unknown>;
  const formatDate = (input: unknown) => {
    if (!input || typeof input !== "object") return null;
    const date = input as Record<string, unknown>;
    if (![date.year, date.month, date.day].every((part) => typeof part === "number" && Number.isFinite(part))) return null;
    return new Date(Date.UTC(date.year as number, (date.month as number) - 1, date.day as number)).toLocaleDateString("es-ES", { timeZone: "UTC" });
  };
  const first = formatDate(period.firstDate), last = formatDate(period.lastDate);
  return first && last ? `${first} – ${last}` : null;
}
