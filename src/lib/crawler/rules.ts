import { SITE_URL } from "../site";
import { pageLanguage } from "./engine";
import type { CrawlIssue, CrawlPage, CrawlReport, CrawlState, Severity } from "./types";
import defaultConfiguration from "../../../audit.rules.config";

type Rule = { id: string; category: string; title: string; severity: Severity; weight: number; recommendation: string; review?: boolean };
export const SEO_RULES: Rule[] = [
  { id: "download", category: "Rastreo", title: "No se pudo descargar la URL", severity: "Alta", weight: 10, recommendation: "Revisar disponibilidad, DNS, TLS y límites del servidor; reauditar la URL." },
  { id: "http", category: "Rastreo", title: "Respuesta HTTP de error", severity: "Alta", weight: 10, recommendation: "Corregir la respuesta o actualizar los enlaces y el sitemap al destino correcto." },
  { id: "robots-blocked", category: "Indexabilidad", title: "URL del sitemap bloqueada por robots.txt", severity: "Media", weight: 5, recommendation: "Comprobar si la exclusión es intencional y mantener el sitemap consistente." },
  { id: "truncated", category: "Rastreo", title: "Respuesta truncada: HTML no evaluado", severity: "Media", weight: 4, recommendation: "Reducir el peso del documento o revisar el límite de descarga." },
  { id: "non-html", category: "Rastreo", title: "URL de sitemap no devuelve HTML", severity: "Baja", weight: 0, review: true, recommendation: "Confirmar el tipo de recurso y si debe pertenecer a este sitemap." },
  { id: "redirect", category: "Enlaces", title: "URL del sitemap redirigida", severity: "Media", weight: 3, recommendation: "Incluir en sitemap y enlaces internos la URL final cuando corresponda." },
  { id: "redirect-chain", category: "Enlaces", title: "Cadena de redirecciones", severity: "Media", weight: 3, recommendation: "Enlazar directamente al destino final y evitar saltos intermedios." },
  { id: "title", category: "Metadatos", title: "Title ausente", severity: "Media", weight: 5, recommendation: "Definir un title descriptivo y específico de la página." },
  { id: "title-length", category: "Metadatos", title: "Revisar extensión del title", severity: "Baja", weight: 0, review: true, recommendation: "Revisar claridad y presentación en resultados; 60 caracteres no es un límite absoluto." },
  { id: "description", category: "Metadatos", title: "Meta description ausente", severity: "Baja", weight: 2, recommendation: "Añadir una descripción útil y específica para la página indexable." },
  { id: "duplicate-title", category: "Metadatos", title: "Title duplicado en el mismo idioma", severity: "Media", weight: 4, recommendation: "Diferenciar títulos de páginas indexables y canónicas." },
  { id: "duplicate-description", category: "Metadatos", title: "Description duplicada en el mismo idioma", severity: "Baja", weight: 2, recommendation: "Revisar si las páginas necesitan descripciones diferenciadas." },
  { id: "h1", category: "Contenido", title: "H1 ausente", severity: "Media", weight: 3, recommendation: "Incluir un encabezado principal descriptivo del contenido." },
  { id: "multiple-h1", category: "Contenido", title: "Revisar múltiples H1", severity: "Baja", weight: 0, review: true, recommendation: "Revisar la estructura semántica; múltiples H1 no implican por sí solos un error crítico." },
  { id: "alt", category: "Accesibilidad", title: "Imágenes sin atributo ALT", severity: "Media", weight: 3, recommendation: "Añadir ALT descriptivo o alt vacío para imágenes decorativas; revisar visualmente su función." },
  { id: "noindex", category: "Indexabilidad", title: "URL del sitemap con noindex", severity: "Alta", weight: 8, recommendation: "Quitar la URL del sitemap o corregir la directiva si debe indexarse." },
  { id: "canonical-multiple", category: "Indexabilidad", title: "Múltiples declaraciones canonical", severity: "Alta", weight: 6, recommendation: "Emitir una sola declaración canonical coherente." },
  { id: "canonical-invalid", category: "Indexabilidad", title: "Destino canonical roto o no indexable", severity: "Alta", weight: 8, recommendation: "Apuntar a un destino accesible e indexable; comprobar las directivas del destino." },
  { id: "canonical-redirect", category: "Indexabilidad", title: "Canonical hacia una redirección", severity: "Media", weight: 3, recommendation: "Evaluar apuntar directamente al destino canónico final." },
  { id: "schema-parse", category: "Datos estructurados", title: "JSON-LD inválido", severity: "Media", weight: 3, recommendation: "Corregir la sintaxis y verificar el marcado específico; JSON válido no garantiza Rich Results." },
  { id: "broken-link", category: "Enlaces", title: "Enlace interno hacia una respuesta HTTP de error", severity: "Alta", weight: 7, recommendation: "Actualizar el enlace en esta página o corregir el recurso de destino." },
  { id: "redirect-link", category: "Enlaces", title: "Enlace interno hacia una redirección", severity: "Baja", weight: 2, recommendation: "Actualizar el enlace al destino final cuando corresponda." },
  { id: "hreflang-code", category: "Internacionalización", title: "Código hreflang inválido", severity: "Media", weight: 3, recommendation: "Usar códigos de idioma/región válidos o x-default." },
  { id: "hreflang-return", category: "Internacionalización", title: "Hreflang sin reciprocidad", severity: "Media", weight: 4, recommendation: "Declarar el enlace de vuelta entre las páginas equivalentes." },
  { id: "hreflang-self", category: "Internacionalización", title: "Hreflang sin autorreferencia", severity: "Baja", weight: 2, recommendation: "Incluir la página actual en el conjunto de alternates." },
  { id: "hreflang-target", category: "Internacionalización", title: "Destino hreflang no indexable o incoherente", severity: "Alta", weight: 5, recommendation: "Usar páginas equivalentes accesibles, indexables y canónicas." },
  { id: "language", category: "Internacionalización", title: "Idioma HTML no coincide con la ruta", severity: "Media", weight: 3, recommendation: "Revisar lang y el contenido de la versión ES/EN/PT-BR." },
  { id: "duplicate-content", category: "Contenido", title: "Contenido principal idéntico en el mismo idioma", severity: "Media", weight: 4, recommendation: "Revisar duplicación y consolidación; distinguir páginas que deban ser únicas." },
  { id: "short-content", category: "Contenido", title: "Revisar contenido breve de la plantilla", severity: "Baja", weight: 0, review: true, recommendation: "Evaluar si el artículo o glosario responde la intención; no agregar texto solo para alcanzar una cantidad." },
  { id: "soft-404", category: "Indexabilidad", title: "Posible soft 404", severity: "Media", weight: 0, review: true, recommendation: "Confirmar si es una página de error con HTTP 200; una heurística no equivale al diagnóstico de Google." },
  { id: "possible-orphan", category: "Enlaces", title: "Sin enlaces entrantes detectados desde la home", severity: "Baja", weight: 0, review: true, recommendation: "Revisar enlazado y cobertura del rastreo; no afirmar que es huérfana si la cobertura es parcial." },
];

function canonicalPage(page: CrawlPage) { return page.outcome === "html" && page.indexable && (!page.canonical || page.canonical === page.finalUrl); }
export function computeDepths(pages: CrawlPage[]) {
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  pages.forEach((page) => { page.depth = null; });
  const root = byUrl.get(SITE_URL);
  if (!root) return;
  root.depth = 0;
  const queue = [root];
  for (let index = 0; index < queue.length; index++) {
    const page = queue[index];
    for (const link of page.links) {
      const target = byUrl.get(link.url);
      if (target && target.depth == null) { target.depth = (page.depth || 0) + 1; queue.push(target); }
    }
  }
}
export function evaluateCrawl(state: CrawlState): CrawlReport {
  const configuration = state.ruleConfig || defaultConfiguration;
  computeDepths(state.pages);
  const pages = state.pages;
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const issues: CrawlIssue[] = [];
  const stats = new Map(SEO_RULES.map((rule) => [rule.id, { ...rule, eligible: 0, affected: 0 }]));
  const evaluated = new Set<string>();
  const exceptions = configuration.exceptions.filter((item) => item.reason.trim() && Date.parse(item.expiresAt) > Date.now());
  const exceptionIds = new Set(exceptions.map((item) => `${item.rule}:${item.url}`));
  const check = (rule: string, page: CrawlPage, applies: boolean, evidence?: string | false | null) => {
    if (!applies || configuration.disabled.includes(rule) || exceptionIds.has(`${rule}:${page.url}`)) return;
    const spec = stats.get(rule)!;
    const id = `${rule}:${page.url}`;
    spec.eligible++;
    evaluated.add(id);
    if (!evidence) return;
    spec.affected++;
    issues.push({ id, rule, url: page.url, category: spec.category, issue: spec.title, severity: spec.severity, evidence, recommendation: spec.recommendation, status: "open", evaluation: spec.review ? "review" : "automatic" });
  };
  const duplicateIndexes = { title: new Map<string, CrawlPage[]>(), metaDescription: new Map<string, CrawlPage[]>(), contentHash: new Map<string, CrawlPage[]>() };
  for (const page of pages.filter(canonicalPage)) for (const key of ["title", "metaDescription", "contentHash"] as const) {
    if (!page[key]) continue;
    const id = `${page.language}:${page[key]}`;
    const group = duplicateIndexes[key].get(id);
    if (group) group.push(page); else duplicateIndexes[key].set(id, [page]);
  }
  const duplicated = (page: CrawlPage, key: keyof typeof duplicateIndexes) => duplicateIndexes[key].get(`${page.language}:${page[key]}`) || [];
  for (const page of pages) {
    const html = page.outcome === "html";
    const indexable = !!canonicalPage(page);
    const inSitemap = page.sources.includes("sitemap");
    check("download", page, true, ["network_error", "timeout", "robots_unavailable"].includes(page.outcome) && (page.error || page.outcome));
    check("http", page, page.httpStatus != null, page.outcome === "http_error" && `HTTP ${page.httpStatus}`);
    check("robots-blocked", page, inSitemap, page.outcome === "blocked" && "robots.txt impide descargar una URL del sitemap.");
    check("truncated", page, true, page.bodyTruncated && "Documento supera 2 MB; metadatos no evaluados.");
    check("non-html", page, inSitemap, page.outcome === "non_html" && (page.error || "Respuesta no HTML"));
    check("redirect", page, inSitemap && page.httpStatus != null, !!page.redirects.length && page.redirects.join(" → "));
    check("redirect-chain", page, page.httpStatus != null, page.redirects.length > 1 && page.redirects.join(" → "));
    check("title", page, indexable, !page.title && "No hay title en el HTML descargado.");
    check("title-length", page, indexable && !!page.title, (page.title?.length || 0) > configuration.titleWarningLength && `${page.title!.length} caracteres: ${page.title}`);
    check("description", page, indexable, !page.metaDescription && "Sin meta description.");
    check("duplicate-title", page, indexable && !!page.title, duplicated(page, "title").length > 1 && duplicated(page, "title").map((item) => item.url).join(" · "));
    check("duplicate-description", page, indexable && !!page.metaDescription, duplicated(page, "metaDescription").length > 1 && duplicated(page, "metaDescription").map((item) => item.url).join(" · "));
    check("h1", page, html, !page.h1.length && "No se detectó H1.");
    check("multiple-h1", page, html, page.h1.length > 1 && page.h1.join(" · "));
    check("alt", page, html, !!page.imagesWithoutAlt && `${page.imagesWithoutAlt} imágenes sin atributo alt. alt vacío no se penaliza.`);
    check("noindex", page, html && inSitemap, page.indexable === false && `${page.robotsMeta || ""} ${page.xRobotsTag || ""}`.trim());
    check("canonical-multiple", page, html, page.canonicals.length > 1 && page.canonicals.join(" · "));
    const target = page.canonical ? byUrl.get(page.canonical) : undefined;
    check("canonical-invalid", page, html && !!target && (target.httpStatus != null || target.outcome === "html"), !!target && ((target.httpStatus || 0) >= 400 || target.indexable === false) && `${target.url}: HTTP ${target.httpStatus}; indexable=${target.indexable}`);
    check("canonical-redirect", page, html && !!target && target.httpStatus != null, !!target?.redirects.length && target.redirects.join(" → "));
    check("schema-parse", page, html && page.jsonLd > 0, !!page.parseErrors.length && page.parseErrors.join(" · "));
    const links = page.links.map((link) => byUrl.get(link.url)).filter((item): item is CrawlPage => !!item && item.httpStatus != null);
    check("broken-link", page, html && links.length > 0, links.some((item) => (item.httpStatus || 0) >= 400) && links.filter((item) => (item.httpStatus || 0) >= 400).map((item) => `${item.url} (${item.httpStatus})`).join(" · "));
    check("redirect-link", page, html && links.length > 0, links.some((item) => item.redirects.length) && links.filter((item) => item.redirects.length).map((item) => `${item.url} → ${item.finalUrl}`).join(" · "));
    const alternates = page.hreflang.map((item) => ({ ...item, target: byUrl.get(item.url) }));
    check("hreflang-code", page, html && alternates.length > 0, alternates.some((item) => !validLanguage(item.language)) && alternates.filter((item) => !validLanguage(item.language)).map((item) => item.language).join(" · "));
    const inspectedAlternates = alternates.filter((item) => item.target?.outcome === "html");
    check("hreflang-return", page, html && inspectedAlternates.length > 0, inspectedAlternates.some((item) => item.target!.url !== page.url && !item.target!.hreflang.some((back) => back.url === page.url)) && inspectedAlternates.filter((item) => item.target!.url !== page.url && !item.target!.hreflang.some((back) => back.url === page.url)).map((item) => item.url).join(" · "));
    check("hreflang-self", page, html && alternates.length > 0, !alternates.some((item) => item.url === page.finalUrl) && "Conjunto de alternates sin URL actual.");
    check("hreflang-target", page, html && alternates.some((item) => item.target?.httpStatus != null), alternates.some((item) => item.target && ((item.target.httpStatus || 0) >= 400 || item.target.indexable === false || (item.target.canonical && item.target.canonical !== item.target.finalUrl))) && alternates.filter((item) => item.target && ((item.target.httpStatus || 0) >= 400 || item.target.indexable === false || (item.target.canonical && item.target.canonical !== item.target.finalUrl))).map((item) => item.url).join(" · "));
    check("language", page, html, page.language !== pageLanguage(page.url) && `Ruta: ${pageLanguage(page.url)}; HTML: ${page.language}`);
    check("duplicate-content", page, indexable && page.wordCount >= 30, duplicated(page, "contentHash").length > 1 && duplicated(page, "contentHash").map((item) => item.url).join(" · "));
    check("short-content", page, html && ["Blog", "Glosario"].includes(page.template), page.wordCount < configuration.shortEditorialWords && `${page.wordCount} palabras principales; evaluar intención y plantilla.`);
    check("soft-404", page, html && page.httpStatus === 200, page.errorPageHint || null);
    check("possible-orphan", page, html && page.url !== SITE_URL, page.depth == null && "No alcanzada desde la home en el grafo descargado. Revisar cobertura antes de concluir orfandad.");
  }
  const rules = [...stats.values()].map((rule) => ({ rule: rule.id, category: rule.category, weight: rule.weight, eligible: rule.eligible, affected: rule.affected, score: rule.eligible ? Math.round(100 * (1 - rule.affected / rule.eligible)) : null }));
  const weighted = (values: typeof rules) => {
    const active = values.filter((rule) => rule.score != null && rule.weight > 0);
    const total = active.reduce((sum, rule) => sum + rule.weight, 0);
    return total ? Math.round(active.reduce((sum, rule) => sum + rule.score! * rule.weight, 0) / total) : null;
  };
  const groups = SEO_RULES.map((rule) => { const affected = issues.filter((issue) => issue.rule === rule.id); return { rule: rule.id, issue: rule.title, severity: rule.severity, count: affected.length, urls: affected.map((issue) => issue.url) }; }).filter((group) => group.count);
  const old = new Map(state.previousIssues.map((issue) => [issue.id, issue]));
  const current = new Set(issues.map((issue) => issue.id));
  const measured = pages.filter((page) => page.outcome === "html").length;
  return { exceptions, issues, rules, score: weighted(rules), coverage: state.pages.length + state.queue.length ? Math.round(measured / (state.pages.length + state.queue.length + state.excluded.filter((item) => item.reason.startsWith("Límite")).length) * 100) : 0,
    categories: [...new Set(rules.map((rule) => rule.category))].map((category) => { const values = rules.filter((rule) => rule.category === category); return { category, score: weighted(values), evaluated: values.reduce((sum, rule) => sum + rule.eligible, 0) }; }), groups,
    comparison: { new: issues.filter((issue) => !old.has(issue.id)).map((issue) => issue.id), persistent: issues.filter((issue) => old.has(issue.id)).map((issue) => issue.id), resolved: [...old.keys()].filter((id) => !current.has(id) && evaluated.has(id)), unevaluated: [...old.keys()].filter((id) => !current.has(id) && !evaluated.has(id)) } };
}
function validLanguage(language: string) {
  if (language === "x-default") return true;
  if (!/^[a-z]{2,3}(?:-[a-z]{2}|-\d{3})?$/i.test(language)) return false;
  try { return Intl.getCanonicalLocales(language).length > 0; } catch { return false; }
}
