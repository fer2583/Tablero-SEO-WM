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

export async function GET(request: Request) {
  let filters;
  const params = new URL(request.url).searchParams;
  const requestedView = params.get("view") ?? "Acquisition";
  if (!ANALYTICS_VIEWS.includes(requestedView as AnalyticsViewData["view"])) return NextResponse.json({ error: "Vista de Analytics no válida." }, { status: 400 });
  const view = requestedView as AnalyticsViewData["view"];
  try { filters = parseFilters(params); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Parámetros inválidos." }, { status: 400 }); }
  const generatedAt = new Date().toISOString();
  try {
    if (!process.env.GA4_PROPERTY_ID || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("GA4 no está conectado. Configura GA4_PROPERTY_ID y credenciales de Google.");
    const data = await fetchAnalyticsView(filters, view);
    const response: IntegrationResponse<AnalyticsViewData> = { status: data.rows.length ? "live" : "no_data", data, generatedAt, metadata: { rows: data.rows.length, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "No se pudo consultar GA4.";
    const errorMessage = /userAgeBracket|userGender|dimension|metric|field/i.test(raw) && view === "Demographic" ? "Unavailable: GA4 no permite o no tiene datos para age/gender en esta propiedad." : /private.?key|client.?email|access.?token|credential|service account/i.test(raw) ? "No se pudo autenticar contra GA4. Revisa las credenciales del servidor." : "GA4 no está disponible. Revisa la conexión, permisos y compatibilidad de la vista.";
    const response: IntegrationResponse<AnalyticsViewData> = { status: "unavailable", data: emptyData(view), error: errorMessage, generatedAt, metadata: { rows: 0, lastResponseAt: generatedAt, filters } };
    return NextResponse.json(response, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
