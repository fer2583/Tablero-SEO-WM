import { NextResponse } from "next/server";
import { fallbackSearchConsole, fetchSearchConsole, type IntegrationResponse } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  const fallback = fallbackSearchConsole();
  try {
    if (!process.env.GSC_SITE_URL || (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("Configura GSC_SITE_URL y GOOGLE_SERVICE_ACCOUNT_JSON para activar Search Console.");
    const response: IntegrationResponse<typeof fallback> = { status: "live", data: await fetchSearchConsole(), generatedAt: new Date().toISOString() };
    return NextResponse.json(response);
  } catch (error) {
    const response: IntegrationResponse<typeof fallback> = { status: "fallback", data: fallback, error: error instanceof Error ? error.message : "No se pudo consultar Search Console.", generatedAt: new Date().toISOString() };
    return NextResponse.json(response);
  }
}
