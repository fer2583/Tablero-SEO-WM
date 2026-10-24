import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { initializeCrawl, processBatch } from "../src/lib/crawler/engine";
import { crawlConfig } from "../src/lib/crawler/types";
import { buildAuditSnapshot } from "../src/lib/audit";

async function main() {
  loadEnvConfig(process.cwd());
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const config = crawlConfig();
  if (limitArg) {
    const limit = Number(limitArg.split("=")[1]);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("--limit debe estar entre 1 y 10000.");
    config.maxUrls = limit;
  }
  const state = await initializeCrawl(config);
  while (state.queue.length && state.robots.status !== "unavailable") {
    await processBatch(state);
    console.log(`${state.pages.length} procesadas; ${state.queue.length} pendientes`);
    if (state.retryAt) break;
  }
  const output = path.join(process.cwd(), ".audit-artifacts", "dry-run");
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "report.json"), JSON.stringify(buildAuditSnapshot(state), null, 2));
  console.log(`Reporte sin persistencia: ${output}/report.json`);
  if (state.retryAt || state.robots.status === "unavailable") process.exitCode = 2;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "No se pudo ejecutar el crawl."); process.exitCode = 1; });
