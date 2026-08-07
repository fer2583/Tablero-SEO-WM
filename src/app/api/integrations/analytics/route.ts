import { NextResponse } from "next/server";
import { ANALYTICS_VIEWS, fetchAnalyticsView, parseFilters, type AnalyticsViewData, type IntegrationResponse } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const emptyData = (view: AnalyticsViewData["view"]): AnalyticsViewData => ({
  view,
  dimension: "",
  period: { start: "", end: "", previousStart: "", previousEnd: "" },
  metrics: { sessions: null, activeUsers: null, newUsers: null, engagementRate: null, conversions: null, keyEvents: null, keyEventsPerSession: null },
  previous: { sessions: null, activeUsers: null, newUsers: null, engagementRate: null, conversions: null, keyEvents: null, keyEventsPerSession: null },
  rows: [],
  warnings: [],
});

type GoogleError = {
  code?: number | string;
  status?: string;
  message?: string;
  errors?: Array<{ reason?: string; message?: string }>;
};

function diagnoseError(error: unknown, view: AnalyticsViewData["view"]) {
  const candidate = error as { code?: number | string; message?: string; response?: { status?: number; data?: { error?: GoogleError } } };
  const apiError = candidate.response?.data?.error;
  const code = apiError?.code ?? candidate.response?.status ?? candidate.code;
  const status = apiError?.status ?? "";
  const raw = apiError?.message ?? candidate.message ?? "No se pudo consultar GA4.";
  const safe = raw
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/gi, "[credencial omitida]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email omitido]")
    .slice(0, 300);
  const text = `${code ?? ""} ${status} ${raw}`.toLowerCase();
  const category = /permission_denied|forbidden|access denied/.test(text)
    ? "permission"
    : /unauthenticated|invalid credential|could not load the default credentials|private key|service account|authentication/.test(text)
      ? "credentials"
      : /not_found|property.*not|resource.*not|unknown property/.test(text)
        ? "property"
        : /invalid_argument|dimension|metric|filter|field|incompatible/.test(text)
          ? "request"
          : /econn|etimedout|enotfound|socket|network|fetch failed|timeout/.test(text)
            ? "network"
            : "google";
  console.error("GA4 diagnostic", { category, code: code ?? null, status: status || null, view, message: safe });
  return { category, message: safe };
}

function configurationError() {
  if (!process.env.GA4_PROPERTY_ID) return "GA4: falta GA4_PROPERTY_ID en la configuración del servidor.";
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) return "GA4: faltan credenciales de Google en la configuración del servidor.";
  return null;
}

export async function GET(request: Request) {
  let filters;
  const params = new URL(request.url).searchParams;
  const requestedView = params.get("view") ?? "Acquisition";
  if (!ANALYTICS_VIEWS.includes(requestedView as AnalyticsViewData["view"])) return NextResponse.json({ error: "Vista de Analytics no válida." }, { status: 400 });
  const view = requestedView as AnalyticsViewData["view"];
  try { filters = parseFilters(params); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  const generatedAt = new Date().toISOString();
  try {
    const missingConfiguration = configurationError();
    if (missingConfiguration) throw new Error(missingConfiguration);
    const data = await fetchAnalyticsView(filters, view);
    const response: IntegrationResponse<AnalyticsViewData> = { status: data.rows.length ? "live" : "no_data", data, generatedAt, metadata: { rows: data.rows.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "No se pudo consultar GA4.";
    const configuration = /falta .*configuración del servidor/i.test(raw);
    const diagnostic = configuration ? { category: "configuration", message: raw } : diagnoseError(error, view);
    const labels: Record<string, string> = { configuration: "configuración", credentials: "credenciales", permission: "permisos", property: "propiedad", request: "request de GA4", network: "red", google: "Google Analytics" };
    const errorMessage = `GA4 (${labels[diagnostic.category] ?? "Google Analytics"}): ${diagnostic.message}`;
    const response: IntegrationResponse<AnalyticsViewData> = { status: "unavailable", data: emptyData(view), error: errorMessage, generatedAt, metadata: { rows: 0, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
