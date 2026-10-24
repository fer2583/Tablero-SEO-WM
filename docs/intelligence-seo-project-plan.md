# Intelligence SEO — Project Plan

**Versión:** 1.0  
**Fecha:** 2026-10-24  
**Estado:** Plan — aprobado para implementación  
**Repositorio:** Tablero-SEO-WM (base actual Whalemate)

---

## 1. Visión y Decisiones Fundamentales

| Decisión | Implicación |
|---|---|
| **DataForSEO** como proveedor SEO Data API principal | Volúmenes, SERPs, dificultad, backlinks — pay-per-use |
| **Crawler propio + GSC/GA4** como núcleo gratis | Auditoría técnica, keywords propias, contenido, indexabilidad |
| **Producto modular** (Core + 5 módulos) | SEO Intelligence, Competitive Radar, AI Search, Response Automation, Growth & Revenue |
| **Precios por capacidad + consumo** | No "keywords guardadas" sino "keywords monitoreadas / investigadas" |
| **Model Router** para IA | Código determinístico → modelo barato → modelo medio → modelo caro solo en decisiones estratégicas |
| **Usage & Cost Engine desde P0** | `plans`, `subscriptions`, `module_entitlements`, `usage_ledger`, `workspace_budgets`, `credit_transactions` |
| **4 workspaces internos** como laboratorio | Whalemate, Hitocean, Cyberlatam, Agencia propia |

---

## 2. Infraestructura (Costo Incremental $0/mes)

```
Hostinger Business (ya contratado)
├── Next.js App (Dashboard, APIs, Auth, Alertas, Cron liviano)
└── MySQL (opcional: cola simple, cache, sesiones)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
Neon PostgreSQL           Tu PC (Worker Local)
(Free tier)               - Crawler pesado
- Workspaces              - Playwright/Chromium
- Historial KW            - Ollama (IA local)
- Snapshots               - Diff Engine
- usage_ledger            - Report Generator
```

**Flujo tareas pesadas:** Hostinger API → encola en Neon (`task_queue`) → Worker local (polling 30s) ejecuta → guarda resultado → notifica al usuario.

---

## 3. Qué Desarrollamos Nosotros (Costo $0 Licencias/APIs)

| Componente | Descripción | Prioridad |
|---|---|---|
| **SEO Crawler v2** | Crawlee/Cheerio (HTML) + Playwright (JS) → snapshots versionados, diff engine | P0 |
| **SEO Audit Engine** | Reglas configurables (YAML/JSON): technical, content, schema, links, performance | P0 |
| **Keyword Manager** | GSC + CSV import + targets (keyword→URL) + clusters + historial + filtros | P0 |
| **Topic Cluster Engine** | Algoritmos co-ocurrencia + embeddings locales (sentence-transformers en Ollama) | P1 |
| **Competitor Site Watcher** | Sitemaps + crawling programado + snapshots HTML/content + diff semántico | P1 |
| **Content Gap Engine** | Comparar inventarios temáticos (tus topics vs competidores) | P1 |
| **Alert Engine** | Reglas estadísticas (z-score, % change), deduplicación, severidad, canales (Telegram/email) | P0 |
| **Opportunity Scoring** | Fórmula configurable: `impacto × intención / esfuerzo` con pesos por cliente | P1 |
| **Agentes locales básicos** | Ollama (Llama 3.1 8B, Qwen 2.5 7B) en RTX 5060 8GB → clasificación, resumen, extracción | P1 |
| **Report Generator** | PDF/CSV/HTML con plantillas, recomendaciones priorizadas | P1 |
| **Countermove Engine** | Cambio competidor + tus páginas + GSC + objetivos → acción concreta | P1 |

**Tres desarrollos diferenciadores:**
1. **Competitor Change Intelligence** — snapshots + diff semántico + alerta accionable
2. **Topic Battlefield** — mapa de temas tuyos vs competidores, gaps, oportunidades
3. **Countermove Engine** — de "algo cambió" a "hacé esto ahora"

---

## 4. Métricas: Qué Podemos / No Podemos Sin Pagar

| Métrica | ¿Sin pagar? | Fuente |
|---|---|---|
| Queries con impresiones en nuestro sitio | ✅ | GSC |
| Clicks, CTR, posición media propia | ✅ | GSC |
| Keywords extraídas de contenido competidores | ✅ | Crawler propio |
| Clusters e intención inferida | ✅ | Motor propio |
| Volumen estimado de KW que nunca apareció en GSC | ❌ | DataForSEO / Google Ads API |
| Dificultad SEO comparable Ahrefs/Semrush | 🟡 Estimable | DataForSEO Labs / heurística propia |
| Ranking independiente competidores en Google | ❌ | DataForSEO SERP API |
| Histórico global backlinks | ❌ | DataForSEO / proveedor backlinks |

**Estrategia:** GSC primero, datos externos solo cuando sean necesarios.

---

## 5. Arquitectura Comercial — Módulos y Planes

### Módulos (independientes en backend, no solo UI)
| Módulo | Qué incluye |
|---|---|
| **SEO Intelligence** | GSC, GA4, crawling, auditorías, KW, rankings, oportunidades |
| **Competitive Radar** | Competidores, movimientos, SERPs, gaps, amenazas |
| **AI Search Intelligence** | GEO/AEO, prompts, menciones, citas, fuentes de IA |
| **Response Automation** | Agentes, playbooks, recomendaciones, aprobaciones, ejecución |
| **Growth & Revenue Intelligence** | CRM, leads, conversiones, experimentación, atribución |

### Planes (hipótesis USD, no validadas)
| Plan | Precio | Target | Incluye |
|---|---|---|---|
| **Demo pública** | Gratis | Captación | Datos ilustrativos, caso completo, sin crawling continuo |
| **SEO Monitor** | $39–79/mes | Freelancers, PYMEs | 1 sitio, 500 URLs/crawl, 100 KW/semana, alertas |
| **SEO Growth** | $119–179/mes | Empresas activas | 2.000 URLs, 500 KW/sem, investigación, Topic Intel, 3 competidores |
| **Market Intelligence** | $249–449/mes | Equipos marketing | + Competitive Radar avanzado, GEO limitado, Topic Battlefield |
| **Full Command Center** | $499–999+/mes | Empresas/agencias | + CRM, agentes, playbooks, automatizaciones, experimentos |

### Add-ons
| Complemento | Precio tentativo |
|---|---|
| Competitive Radar avanzado | $49–129/mes |
| GEO / AI Visibility | $69–199/mes |
| SEO Technical Crawl ampliado | $19–69/mes |
| Automatizaciones y agentes | $59–199/mes + consumo |
| Workspaces adicionales | Según límites del plan |
| Paquetes keywords/prompts/análisis | Créditos adicionales |

---

## 6. Model Router — Control de Costos IA

| Nivel | Modelo (ref. OpenAI) | Uso | Costo aprox / 1K análisis |
|---|---|---|---|
| **Determinístico** | Código (sin LLM) | Cálculos, umbrales, agrupaciones, comparaciones | $0 |
| **Económico** | GPT-5.6 Luna ($0.20/$1.20 per 1M) | Clasificación, extracción, resúmenes rutinarios | ~$4.80 |
| **Intermedio** | GPT-5.6 Terra ($2/$12 per 1M) | Investigación anomalías, análisis competitivo | ~$48 |
| **Avanzado** | GPT-6 Astra ($10/$50 per 1M) | Decisiones estratégicas, análisis solicitados por usuario | ~$225 |

**Regla:** Un evento rutinario no consume la misma capacidad que una investigación de alto valor.

---

## 7. Usage & Cost Engine (P0)

Tablas core:
- `plans` — definición de planes y límites
- `subscriptions` — workspace ↔ plan + ciclo facturación
- `module_entitlements` — qué módulos tiene cada plan
- `usage_ledger` — cada operación: `workspace_id`, `module`, `operation`, `estimated_cost`, `actual_cost`, `timestamp`
- `provider_costs` — costos unitarios por proveedor (DataForSEO, OpenAI, etc.)
- `workspace_budgets` — presupuesto mensual por workspace + alertas umbral
- `credit_transactions` — recargas, consumos, ajustes

**Flujo obligatorio por tarea pagada:**
```
Verificar permisos → Consultar límite → Estimar costo → Reservar presupuesto 
→ Ejecutar → Registrar costo real → Actualizar saldo
```

**Automatizaciones:** detienen/posponen ops no críticas al alcanzar límite; alertas críticas conservan canal mínimo.

**BYOK (Bring Your Own Key):** opcional en planes enterprise — cliente conecta su proveedor IA y paga tokens directo.

---

## 8. Fases de Implementación

### Fase 0 — Base Multitenant (2-3 semanas)
| Ticket | Descripción |
|---|---|
| `core-01` | Schema: `organizations`, `workspaces`, `members`, `roles` (RBAC) |
| `core-02` | `plans`, `subscriptions`, `module_entitlements` |
| `core-03` | `usage_ledger`, `provider_costs`, `workspace_budgets`, `credit_transactions` |
| `core-04` | Middleware: `checkEntitlement(module)`, `estimateCost(op)`, `reserveBudget()`, `recordUsage()` |
| `core-05` | Auth multitenant (NextAuth + workspace context), RLS en queries |
| `core-06` | Deploy staging Hostinger + Neon; CI/CD GitHub → Hostinger |

**Entregable:** 4 workspaces aislados, límites de consumo, facturación interna simulada.

---

### Fase 1 — SEO Comercial (4-6 semanas)
| Ticket | Descripción |
|---|---|
| `seo-01` | **Crawler robusto**: `crawl_jobs` queue, robots.txt, rate-limit/host, descubrimiento sitemap+links, snapshots versionados |
| `seo-02` | **Audit Engine**: reglas configurables YAML/JSON, categorías: technical, content, schema, links, performance |
| `seo-03` | **Keyword Intelligence**: `fetchKeywordsFromDB()` (lee `gsc_queries_daily` agregado), trends vs período anterior, cache 1h |
| `seo-04` | **SERP Provider Adapter**: interfaz `SerpProvider` + impl `DataForSEO` + mock; `getVolume()`, `getSerp()`, `getDifficulty()` |
| `seo-05` | **Rank Tracker**: `rank_checks` cron, guarda `rank_history`, alerta Δ > threshold |
| `seo-06` | **Keyword Targets CRUD**: API + UI asignar keyword → target_url + idioma + país + status |
| `seo-07` | **Topic Clusters**: aglomerativo co-ocurrencia GSC + embeddings locales opcional |
| `seo-08` | **Oportunidades configurables**: UI sliders, export CSV, crear target desde oportunidad |
| `seo-09` | **Alertas SEO**: caída pos >5, pérdida clics >30%, nueva KW top20, error crítico, canibalización |

**Entregable:** Producto vendible como **SEO Monitor / SEO Growth**.

---

### Fase 2 — Inteligencia Competitiva (3-4 semanas)
| Ticket | Descripción |
|---|---|
| `comp-01` | **Competitor Registry**: `competitors` table (domain, workspace_id, crawl_frequency, priority_pages[]) |
| `comp-02` | **Competitor Crawler**: jobs programados → snapshot HTML + contenido normalizado + metadata |
| `comp-03` | **Diff Engine**: snapshot N vs N-1 → cambios semánticos (nueva página, title, contenido, schema, precio) |
| `comp-04` | **Topic Battlefield**: tus clusters vs clusters competidor → gaps, overlap, weakness, opportunity score |
| `comp-05` | **SERP Gap Analysis**: para KWs target tuyas, quién rankea top10 y tú no |
| `comp-06` | **Alertas competitivas**: nuevo competidor top10, landing en tu topic, cambio precio/oferta |

**Entregable:** Módulo **Competitive Radar** (add-on o plan Market Intelligence).

---

### Fase 3 — GEO y Respuesta (4-5 semanas)
| Ticket | Descripción |
|---|---|
| `geo-01` | **Prompt Library**: `prompts` table (category, template, variables, expected_output_schema) |
| `geo-02` | **AI Search Measurement**: adapters ChatGPT, Gemini, Perplexity, Claude → menciones, citas, fuentes |
| `geo-03` | **Countermove Engine v1**: input (cambio competidor, tus páginas, GSC KWs, targets) → output (action_type, target_page, rationale, priority, effort) |
| `geo-04` | **Model Router**: `routeTask(complexity, budget)` → deterministic \| ollama \| gpt-luna \| gpt-terra |
| `geo-05` | **Action Engine**: `actions` table (content_update, internal_link, schema_add, page_create, redirect, pr_draft), approval_flow |
| `geo-06` | **Notificaciones**: Telegram bot (`/status`, `/approve`, `/reject`, `/summary`), email digest semanal |
| `geo-07` | **Outcome Tracking**: post-acción → medir Δ posición/clics/imp a 7/14/30 días → attribution |

**Entregable:** Plan **Market Intelligence** + base **Full Command Center**.

---

### Fase 4 — Full OS (continuo)
- Workflows aprobados (n8n-style o custom)
- Integraciones CMS (WordPress, Webflow, Ghost), GitHub (PRs auto), CRM (HubSpot, Pipedrive)
- Experimentación A/B (títulos, meta, contenido)
- Atribución revenue (lead → keyword → landing → deal)
- Agency/White-label: multi-workspace billing, SSO, custom domain

---

## 9. Próximos Pasos Inmediatos (Esta Semana)

| Acción | Responsable | Validación |
|---|---|---|
| 1. Verificar hPanel Hostinger: ¿Node.js Web App habilitado? Límites CPU/RAM/procesos | Usuario | Captura / nota |
| 2. Clonar repo → branch `staging` → deploy Hostinger subdomain (`staging.tudominio.com`) | Dev | URL funcional, logs OK |
| 3. Probar conexión Neon desde Hostinger (latencia, SSL) | Dev | Query simple < 200ms |
| 4. Definir schema multitenant (PR con migración SQL) | Dev | `npm run db:migrate` pasa en staging |
| 5. Mover `ingest.ts` cron a Hostinger cron job (cada 6h) | Dev | Logs sync GSC/GA4 exitosos |

---

## 10. Preguntas Abiertas para Afinar

1. **Límites reales Hostinger Business** — CPU cores, RAM, procesos simultáneos, disco, ancho de banda. Define cuánto crawling/API corremos ahí vs en tu PC.

2. **Fase 0: ¿UI de administración de planes/entitlements o solo backend?** (Dashboard actual no tiene settings de billing).

3. **DataForSEO: ¿cuenta de prueba ya o arrancamos con mock + GSC y sumamos en Fase 1.5?** (Afecta `seo-04`).

4. **Ollama en tu PC ¿ya funciona?** (Modelos descargados, GPU detectada, API en `http://localhost:11434`). Si no, lo armamos en Fase 1.

5. **Notificaciones: ¿Telegram bot (gratis/simple) o email/Slack/Discord?**

6. **Prioridad real: "Keyword Intelligence completo" (`seo-03` a `seo-08`) vs "Competitor Watcher" (`comp-01` a `comp-03`)?** Tu doc dice P0 ambos; en práctica hay que secuenciar.

---

## 11. Aprobación y Siguiente Paso

- [x] Usuario revisa y aprueba plan
- [ ] Usuario responde preguntas abiertas (sección 10)
- [x] Salida de modo plan → creación de `docs/intelligence-seo-project-plan.md`
- [ ] Inicio Fase 0: tickets `core-01` a `core-06` asignados al agente programador

---

*Documento generado automáticamente desde la conversación de planificación. Basado en el repositorio `Tablero-SEO-WM` y la visión comercial definida para Coderwebs Intelligence OS.*