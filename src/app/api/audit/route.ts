import { getAuditHistory, getLatestAuditSnapshot } from "@/db/queries";
import { auditStore } from "@/db/audit-store";
import { SITE_URL } from "@/lib/site";
import { auditHttp, json } from "@/lib/crawler/http";
import { runView } from "@/lib/crawler/service";
import { crawlConfig } from "@/lib/crawler/types";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return auditHttp(async () => {
    if (new URL(request.url).searchParams.has("refresh")) return json({ error: "Usar POST /api/audit/runs para iniciar una auditoría." }, 405);
    const [latest, active, history] = await Promise.all([getLatestAuditSnapshot(SITE_URL), auditStore().active(), getAuditHistory(SITE_URL)]);
    return json({ snapshot: latest?.snapshot ?? null, latestRunId: latest?.id ?? null, activeRun: active ? await runView(active) : null, history, config: crawlConfig() });
  });
}
