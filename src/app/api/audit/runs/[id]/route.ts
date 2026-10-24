import { auditStore } from "@/db/audit-store";
import { auditHttp, json, runId } from "@/lib/crawler/http";
import { runView } from "@/lib/crawler/service";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return auditHttp(async () => {
    const run = await auditStore().get(runId((await context.params).id));
    return run ? json(await runView(run)) : json({ error: "Corrida no encontrada." }, 404);
  });
}
