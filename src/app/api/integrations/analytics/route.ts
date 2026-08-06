import { NextResponse } from "next/server";
import { fallbackAnalytics, fetchAnalytics, type IntegrationResponse } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  const fallback = fallbackAnalytics();
  try {
    if (!process.env.GA4_PROPERTY_ID || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("Configura GA4_PROPERTY_ID y GOOGLE_SERVICE_ACCOUNT_JSON para activar Analytics.");
    const response: IntegrationResponse<typeof fallback> = { status: "live", data: await fetchAnalytics(), generatedAt: new Date().toISOString() };
    return NextResponse.json(response);
  } catch (error) {
    const response: IntegrationResponse<typeof fallback> = { status: "fallback", data: fallback, error: error instanceof Error ? error.message : "No se pudo consultar GA4.", generatedAt: new Date().toISOString() };
    return NextResponse.json(response);
  }
}
