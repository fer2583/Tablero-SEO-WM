import { CRITERIA_VERSION, type BrowserCriteria } from "./src/lib/browser-audit/types";

// Replace/add site-specific selectors after approving the business journeys.
// No form is submitted; the runner blocks non-GET requests by default.
const criteria: BrowserCriteria = {
  version: CRITERIA_VERSION,
  readySelector: 'astro-island[component-url*="Header"]:not([ssr])',
  ctaSelector: 'main a[href*="contact"], main a[href*="calendly"], main a[href*="reunion"], main a[href*="diagnostic"], main a[href*="contato"]',
  ctaRequiredTemplates: ["Home", "Servicio"],
  menu: { button: ".mobile-menu-btn", panel: ".mobile-panel.open" },
  journeys: [
    { id: "keyboard-entry", description: "Entrada de teclado con foco en un control", templates: ["Home", "Servicio", "Blog", "Glosario", "Page", "Jobs"], steps: [{ action: "press", key: "Tab" }] },
    { id: "demo-contact", description: "CTA de demo lleva al formulario de contacto", templates: ["Home", "Servicio"], steps: [{ action: "click", selector: ':is(main a[href*="contact"],main a[href*="contato"]):visible >> nth=0', expectedUrl: "/(contacto|contact|contato)/?$", expectVisible: ".contact-form" }] },
    { id: "language-es-en", description: "La home española cambia a su versión inglesa", templates: ["Home"], languages: ["ES"], viewport: "desktop", steps: [{ action: "click", selector: ".lang-trigger", expectVisible: ".lang-menu" }, { action: "click", selector: '.lang-option[href="/en/"]', expectedUrl: "/en/$", expectVisible: "main h1" }] },
  ],
  masks: ["time", "[data-audit-mask]"],
  minBodyFontPx: 16,
  maxScenarios: 30,
  visualDifferenceThreshold: 0.01,
};
export default criteria;
