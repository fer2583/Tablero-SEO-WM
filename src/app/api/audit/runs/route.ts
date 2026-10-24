import { auditHttp, AuditInputError, json, readInput } from "@/lib/crawler/http";
import { createRun, runView } from "@/lib/crawler/service";
import { crawlConfig } from "@/lib/crawler/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  return auditHttp(async () => {
    const input = await readInput(request);
    if (input.urls != null && (!Array.isArray(input.urls) || !input.urls.length || input.urls.length > 100 || input.urls.some((value) => typeof value !== "string" || !value.startsWith("https://www.whalemate.com/")))) throw new AuditInputError("urls debe contener entre 1 y 100 URLs de https://www.whalemate.com/.");
    if (input.maxUrls != null && (!Number.isInteger(input.maxUrls) || Number(input.maxUrls) < 1 || Number(input.maxUrls) > crawlConfig().maxUrls)) throw new AuditInputError(`maxUrls debe ser un entero entre 1 y ${crawlConfig().maxUrls}.`);
    return json(await runView(await createRun({ urls: input.urls as string[] | undefined, maxUrls: input.maxUrls as number | undefined })), 201);
  });
}
