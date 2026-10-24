import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { parsePage } from "../crawler/engine";
import type { CrawlPage } from "../crawler/types";
import type { BrowserCriteria, BrowserFinding, BrowserReport, BrowserScenario, ScenarioResult } from "./types";

export function selectScenarios(pages: CrawlPage[], max = 30): BrowserScenario[] {
  const representatives = new Map<string, CrawlPage>();
  const priority = (page: CrawlPage) => (page.traffic?.impressions || 0) + (page.traffic?.users || 0);
  for (const page of [...pages].sort((a, b) => priority(b) - priority(a) || a.url.localeCompare(b.url))) {
    if (page.outcome !== "html") continue;
    const key = `${page.template}:${page.language}`;
    if (!representatives.has(key)) representatives.set(key, page);
  }
  return [...representatives.values()].flatMap((page) => (["mobile", "desktop"] as const).map((viewport) => ({ id: createHash("sha256").update(`${page.url}:${viewport}`).digest("hex").slice(0, 16), url: page.url, language: page.language, template: page.template, viewport }))).slice(0, max);
}
export async function compareScreenshots(actual: Buffer, baseline: Buffer) {
  const image = PNG.sync.read(actual), reference = PNG.sync.read(baseline);
  if (image.width !== reference.width || image.height !== reference.height) return { difference: 1, dimensionsChanged: true, diff: null };
  const diff = new PNG({ width: image.width, height: image.height });
  const changed = pixelmatch(image.data, reference.data, diff.data, image.width, image.height, { threshold: 0.1 });
  return { difference: changed / (image.width * image.height), dimensionsChanged: false, diff: PNG.sync.write(diff) };
}
async function settle(page: Page, criteria: BrowserCriteria) {
  await page.locator("body").waitFor();
  if (criteria.readySelector) await page.locator(criteria.readySelector).waitFor({ state: "attached", timeout: 15_000 });
  await page.evaluate(async () => { await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2000))]); });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
}
export async function auditBrowserScenario(browser: Browser, scenario: BrowserScenario, criteria: BrowserCriteria, output: string, baselineDir?: string) {
  const viewport = scenario.viewport === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: scenario.viewport === "mobile", hasTouch: scenario.viewport === "mobile", locale: scenario.language === "PT-BR" ? "pt-BR" : scenario.language === "EN" ? "en-US" : "es-ES", colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
  // Browser audits are observational in production. Full submission journeys belong in a test environment.
  await context.route("**/*", (route) => {
    const request = route.request();
    if (!["GET", "HEAD"].includes(request.method())) return route.abort("blockedbyclient");
    if (request.isNavigationRequest() && new URL(request.url()).origin !== new URL(scenario.url).origin) return route.abort("blockedbyclient");
    return route.continue();
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const findings: BrowserFinding[] = [];
  const result: ScenarioResult = { ...scenario, status: "completed", checks: [] };
  const screenshot = `${scenario.id}.png`;
  const trace = `${scenario.id}.zip`;
  const errors: string[] = [], failedResources: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 500)));
  page.on("requestfailed", (request) => {
    if (request.method() === "GET" && ["document", "image", "script", "stylesheet"].includes(request.resourceType()) && !request.failure()?.errorText.includes("BLOCKED_BY_CLIENT")) failedResources.push(`${request.resourceType()}: ${new URL(request.url()).origin}${new URL(request.url()).pathname}`);
  });
  page.on("response", (response) => { if (response.status() >= 400 && ["document", "image", "script", "stylesheet"].includes(response.request().resourceType())) failedResources.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`); });
  const add = (criterion: string, title: string, evidence: string, recommendation: string, evaluation: "automatic" | "review" = "automatic", severity: BrowserFinding["severity"] = "Media") => {
    findings.push({ scenario: scenario.id, url: scenario.url, viewport: scenario.viewport, criterion, title, severity, evidence, recommendation, evaluation, confidence: evaluation === "automatic" ? "alta" : "media", artifact: screenshot });
    result.checks.push({ criterion, status: evaluation === "automatic" ? "failed" : "review", evidence });
  };
  try {
    const response = await page.goto(scenario.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`Navegación HTTP ${response?.status() || "sin respuesta"}`);
    await settle(page, criteria);
    const initial = parsePage(await response.text(), scenario.url);
    const rendered = await page.evaluate(() => ({ title: document.title, canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || null,
      robots: [...document.querySelectorAll<HTMLMetaElement>('meta[name="robots"],meta[name="googlebot"]')].map((node) => node.content).join(","), h1: [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim()) }));
    result.initialTitle = initial.title; result.renderedTitle = rendered.title;
    if (initial.title !== rendered.title || initial.canonical !== rendered.canonical || JSON.stringify(initial.h1) !== JSON.stringify(rendered.h1)) add("rendered-seo", "HTML inicial y DOM renderizado difieren", JSON.stringify({ initial: { title: initial.title, canonical: initial.canonical, h1: initial.h1 }, rendered }), "Revisar si las diferencias son intencionales y si el HTML inicial contiene las señales SEO necesarias.", "review");
    else result.checks.push({ criterion: "rendered-seo", status: "passed", evidence: "Title, canonical y H1 coinciden." });
    if (initial.indexable && /\b(noindex|none)\b/i.test(rendered.robots)) add("rendered-noindex", "JavaScript agrega noindex", rendered.robots, "Revisar el origen de la directiva y la intención de indexación.", "automatic", "Alta");
    const layout = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const overflow = [...document.querySelectorAll<HTMLElement>("body *")].filter((node) => {
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && (rect.right > width + 2 || rect.left < -2);
      }).slice(0, 15).map((node) => `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}: ${node.getBoundingClientRect().width.toFixed(0)}px`);
      return { horizontal: document.documentElement.scrollWidth > width + 2, overflow, bodyFont: parseFloat(getComputedStyle(document.body).fontSize) };
    });
    if (layout.horizontal) add("responsive-overflow", "Desbordamiento horizontal", layout.overflow.join(" · "), "Revisar los elementos que exceden el viewport; confirmar si existe un carrusel intencional.", "review");
    else result.checks.push({ criterion: "responsive-overflow", status: "passed", evidence: "Sin scroll horizontal detectado." });
    if (layout.bodyFont < criteria.minBodyFontPx) add("reading-size", "Revisar tamaño base del texto", `${layout.bodyFont}px; criterio configurado ${criteria.minBodyFontPx}px`, "Evaluar legibilidad y zoom; no es una infracción WCAG automática.", "review", "Baja");
    const distortedImages = await page.locator("img").evaluateAll((nodes) => nodes.filter((node) => {
      const image = node as HTMLImageElement, rect = image.getBoundingClientRect();
      const fit = getComputedStyle(image).objectFit;
      return image.naturalWidth > 0 && image.naturalHeight > 0 && rect.width > 0 && rect.height > 0 && !["cover", "contain", "scale-down"].includes(fit) && Math.abs((rect.width / rect.height) / (image.naturalWidth / image.naturalHeight) - 1) > 0.1;
    }).slice(0, 10).map((node) => ({ src: (node as HTMLImageElement).getAttribute("src"), alt: (node as HTMLImageElement).alt })));
    if (distortedImages.length) add("image-ratio", "Revisar proporción de imágenes", JSON.stringify(distortedImages), "Verificar si el cambio de relación de aspecto es intencional.", "review", "Baja");

    const ctas = page.locator(criteria.ctaSelector);
    result.ctaCount = await ctas.count();
    if (criteria.ctaRequiredTemplates.includes(scenario.template) && !result.ctaCount) add("cta-presence", "No se encontró el CTA configurado", criteria.ctaSelector, "Confirmar el selector y el objetivo de conversión de la plantilla.", "review");
    for (let index = 0; index < Math.min(result.ctaCount, 5); index++) {
      const cta = ctas.nth(index);
      if (!await cta.isVisible()) continue;
      try { await cta.click({ trial: true, timeout: 3000 }); result.checks.push({ criterion: "cta-actionable", status: "passed", evidence: (await cta.innerText()).slice(0, 150) }); }
      catch { add("cta-actionable", "CTA visible no accionable", await cta.innerText(), "Revisar superposiciones, estado deshabilitado y el área de interacción."); }
    }
    result.formCount = await page.locator("form").count();
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    for (const violation of accessibility.violations) add(`axe:${violation.id}`, violation.help, violation.nodes.map((node) => `${node.target.join(" ")}: ${node.failureSummary || ""}`).join(" · ").slice(0, 6000), violation.helpUrl, "automatic", ["critical", "serious"].includes(violation.impact || "") ? "Alta" : "Media");
    for (const incomplete of accessibility.incomplete) add(`axe-review:${incomplete.id}`, incomplete.help, "axe-core requiere revisión manual para estos elementos: " + incomplete.nodes.map((node) => node.target.join(" ")).slice(0, 10).join(" · "), incomplete.helpUrl, "review", "Baja");
    result.checks.push({ criterion: "axe-scan", status: accessibility.violations.length ? "failed" : "passed", evidence: `${accessibility.passes.length} comprobaciones aprobadas; ${accessibility.violations.length} reglas con fallos; ${accessibility.incomplete.length} para revisión.` });

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, screenshot), fullPage: true, animations: "disabled", caret: "hide", mask: criteria.masks.map((selector) => page.locator(selector)) });
    result.screenshot = screenshot;
    if (baselineDir) {
      try {
        const comparison = await compareScreenshots(await readFile(path.join(output, screenshot)), await readFile(path.join(baselineDir, screenshot)));
        if (comparison.difference > criteria.visualDifferenceThreshold) {
          add("visual-change", "Diferencia con referencia aprobada", `${(comparison.difference * 100).toFixed(2)}% píxeles distintos${comparison.dimensionsChanged ? "; cambiaron dimensiones" : ""}`, "Revisar el cambio antes de aprobar una nueva referencia.", "review");
          if (comparison.diff) await writeFile(path.join(output, `${scenario.id}-diff.png`), comparison.diff);
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") result.checks.push({ criterion: "visual-change", status: "not_applicable", evidence: "No hay referencia aprobada para este escenario." }); else throw error; }
    }
    if (criteria.menu && scenario.viewport === "mobile") {
      const menu = criteria.menu;
      try {
        await page.locator(menu.button).click(); await page.locator(menu.panel).waitFor({ state: "visible" });
        await page.locator(menu.closeButton || menu.button).click(); await page.locator(menu.panel).waitFor({ state: "hidden" });
        result.checks.push({ criterion: "journey:mobile-menu", status: "passed", evidence: "Menú abre y cierra." });
      } catch { add("journey:mobile-menu", "Menú mobile no completa apertura/cierre", JSON.stringify(menu), "Revisar selector, estado y accionabilidad del menú."); }
    } else result.checks.push({ criterion: "journey:mobile-menu", status: "not_applicable", evidence: "Configurar selectores del menú para evaluar su interacción." });

    for (const journey of criteria.journeys.filter((item) => item.templates.includes(scenario.template) && (!item.languages || item.languages.includes(scenario.language)) && (!item.viewport || item.viewport === scenario.viewport))) {
      await page.goto(scenario.url, { waitUntil: "domcontentloaded" });
      await settle(page, criteria);
      for (const [index, step] of journey.steps.entries()) {
        const criterion = `journey:${journey.id}:${index + 1}`;
        try {
          if (step.action === "click") {
            const control = page.locator(step.selector);
            const type = await control.getAttribute("type"), tag = await control.evaluate((node) => node.tagName.toLowerCase());
            const insideForm = await control.evaluate((node) => !!node.closest("form"));
            if (insideForm && (type === "submit" || (tag === "button" && !type))) throw new Error("El runner observacional no envía formularios.");
            await control.click();
            if (step.expectedUrl) await page.waitForURL(new RegExp(step.expectedUrl));
            if (step.expectVisible) await page.locator(step.expectVisible).waitFor({ state: "visible" });
          } else if (step.action === "expect") await page.locator(step.selector).waitFor({ state: "visible" });
          else {
            await page.keyboard.press(step.key);
            if (step.expectFocused && !await page.locator(step.expectFocused).evaluate((node) => node === document.activeElement)) throw new Error("El foco no llegó al control esperado.");
            if (step.key.includes("Tab") && !await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== document.documentElement)) throw new Error("No se detectó foco en un control.");
          }
          result.checks.push({ criterion, status: "passed", evidence: JSON.stringify(step) });
        } catch (error) {
          add(criterion, `Recorrido bloqueado: ${journey.description}`, `Paso ${index + 1}: ${error instanceof Error ? error.message.slice(0, 700) : "falló"}`, "Revisar el paso, sus selectores y la interacción.");
          const evidence = `${scenario.id}-${journey.id}-${index + 1}.png`;
          await page.screenshot({ path: path.join(output, evidence), animations: "disabled" });
          findings[findings.length - 1].artifact = evidence;
          break;
        }
      }
    }
    if (errors.length) add("javascript", "Excepciones JavaScript", [...new Set(errors)].join(" · "), "Revisar los errores reproducibles del sitio.");
    if (failedResources.length) add("resources", "Recursos fallidos", [...new Set(failedResources)].join(" · "), "Revisar disponibilidad, bloqueos y carga de recursos críticos.", "review");
  } catch (error) {
    result.status = "error"; result.error = error instanceof Error ? error.message.slice(0, 1000) : "Error de navegador";
    add("navigation", "Escenario no completado", result.error, "Corregir navegación o disponibilidad y repetir; las reglas pendientes no se consideran aprobadas.");
    try { await page.screenshot({ path: path.join(output, screenshot), animations: "disabled" }); result.screenshot = screenshot; } catch { findings.forEach((finding) => { delete finding.artifact; }); }
  } finally {
    result.trace = trace;
    await context.tracing.stop({ path: path.join(output, trace) });
    await context.close();
  }
  return { result, findings };
}
export async function runBrowserAudit(scenarios: BrowserScenario[], criteria: BrowserCriteria, output: string, options: { baselineDir?: string; auditRunId?: number } = {}): Promise<BrowserReport> {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report: BrowserReport = { id: randomUUID(), auditRunId: options.auditRunId, createdAt: new Date().toISOString(), criteriaVersion: criteria.version, browserVersion: browser.version(), scenarios: [], findings: [], summary: { automaticFailures: 0, reviewFindings: 0, journeys: { evaluated: 0, passed: 0 } } };
  try {
    for (const scenario of scenarios.slice(0, criteria.maxScenarios)) {
      const { result, findings } = await auditBrowserScenario(browser, scenario, criteria, output, options.baselineDir);
      report.scenarios.push(result); report.findings.push(...findings);
      // Incremental evidence survives an interrupted runner.
      await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    }
    const groups = new Map<string, ScenarioResult[]>();
    report.scenarios.filter((item) => item.status === "completed").forEach((item) => { const key = `${item.template}:${item.viewport}`; groups.set(key, [...(groups.get(key) || []), item]); });
    for (const values of groups.values()) if (new Set(values.map((item) => item.ctaCount)).size > 1) for (const item of values) report.findings.push({ scenario: item.id, url: item.url, viewport: item.viewport, criterion: "language-parity", title: "Diferencia de CTAs entre idiomas de la plantilla", evidence: values.map((value) => `${value.language}: ${value.ctaCount} CTAs`).join(" · "), recommendation: "Comparar páginas equivalentes; la diferencia puede ser intencional y requiere revisión.", severity: "Baja", evaluation: "review", confidence: "media", artifact: item.screenshot });
    report.summary.automaticFailures = report.findings.filter((item) => item.evaluation === "automatic").length;
    report.summary.reviewFindings = report.findings.filter((item) => item.evaluation === "review").length;
    const journeyChecks = report.scenarios.flatMap((item) => item.checks).filter((check) => check.criterion.startsWith("journey:") && check.status !== "not_applicable");
    report.summary.journeys = { evaluated: journeyChecks.length, passed: journeyChecks.filter((check) => check.status === "passed").length };
    await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    return report;
  } finally { await browser.close(); }
}
