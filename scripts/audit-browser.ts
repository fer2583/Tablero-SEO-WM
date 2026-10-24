import { loadEnvConfig } from "@next/env";
import { readFile, readdir, mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import criteria from "../audit.browser.config";
import { getDb } from "../src/db/client";
import { auditStore } from "../src/db/audit-store";
import { runBrowserAudit, selectScenarios } from "../src/lib/browser-audit/runner";
import { emptyPage, normalizeUrl } from "../src/lib/crawler/engine";
import type { AuditData } from "../src/lib/audit";

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  loadEnvConfig(process.cwd());
  const id = argument("run") ? Number(argument("run")) : undefined;
  if (id != null && (!Number.isSafeInteger(id) || id < 1)) throw new Error("--run debe ser un ID positivo.");
  let pages: AuditData["crawler"]["audited"];
  if (id) {
    const run = await auditStore().get(id);
    if (!run || run.status !== "completed") throw new Error("Se requiere una corrida v2 completada.");
    pages = run.state.pages;
  } else if (argument("input")) {
    const report = JSON.parse(await readFile(path.resolve(argument("input")!), "utf8")) as AuditData;
    pages = report.crawler.audited;
    pages.forEach((page) => normalizeUrl(page.url));
  } else if (argument("url")) {
    const url = normalizeUrl(argument("url")!);
    pages = [{ ...emptyPage(url), outcome: "html" }];
  } else throw new Error("Usar --run=ID, --input=report.json o --url=https://www.whalemate.com/.");
  const output = path.join(process.cwd(), ".audit-artifacts", "browser", `${Date.now()}`);
  const scenarios = selectScenarios(pages, criteria.maxScenarios);
  if (!scenarios.length) throw new Error("No hay páginas HTML para auditar.");
  const baseline = argument("baseline") ? path.resolve(argument("baseline")!) : undefined;
  if (baseline) {
    const manifest = JSON.parse(await readFile(path.join(baseline, "manifest.json"), "utf8"));
    if (manifest.criteriaVersion !== criteria.version) throw new Error("La referencia usa otra versión de criterios. Revisar y aprobar una nueva referencia.");
  }
  const report = await runBrowserAudit(scenarios, criteria, output, { auditRunId: id, baselineDir: baseline });
  if (id) {
    const images = [];
    for (const name of (await readdir(output)).filter((name) => name.endsWith(".png"))) {
      const content = await readFile(path.join(output, name));
      if (content.byteLength <= 3_000_000) images.push({ name, base64: content.toString("base64") });
    }
    report.persistedArtifacts = images.map((image) => image.name);
    const client = await getDb().connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO audit_browser_reports (id,audit_run_id,criteria_version,report) VALUES ($1::uuid,$2,$3,$4::jsonb)`, [report.id, id, report.criteriaVersion, JSON.stringify(report)]);
      for (let i = 0; i < images.length; i += 5) await client.query(`INSERT INTO audit_browser_artifacts (report_id,name,content) SELECT $1::uuid,name,decode(base64,'base64') FROM jsonb_to_recordset($2::jsonb) AS x(name text,base64 text)`, [report.id, JSON.stringify(images.slice(i, i + 5))]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  }
  if (argument("approve-baseline")) {
    if (report.scenarios.some((scenario) => scenario.status !== "completed")) throw new Error("No se aprueban referencias con escenarios fallidos.");
    const destination = path.resolve(argument("approve-baseline")!);
    await mkdir(destination, { recursive: true });
    for (const scenario of report.scenarios) if (scenario.screenshot) await copyFile(path.join(output, scenario.screenshot), path.join(destination, scenario.screenshot));
    await writeFile(path.join(destination, "manifest.json"), JSON.stringify({ criteriaVersion: report.criteriaVersion, browserVersion: report.browserVersion, approvedAt: new Date().toISOString(), report: report.id }, null, 2));
  }
  console.log(`${report.scenarios.length} escenarios; ${report.findings.length} hallazgos. Artefactos: ${output}`);
  if (report.scenarios.some((scenario) => scenario.status === "error")) process.exitCode = 2;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Falló Playwright."); process.exitCode = 1; }).finally(async () => { if (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING) await getDb().end(); });
