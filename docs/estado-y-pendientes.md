# Estado del tablero y pendientes

**Última actualización:** 2026-10-26
**Producción:** https://tablero-seo-wm.vercel.app
**Repositorio:** Tablero-SEO-WM

---

## 1. Implementado

### 1.1 Rediseño de interfaz (fases 0-5)

- **Fase 0 - Fundación:** tokens `--wm-*`, mapeo `@theme inline`, `cn()`, `components.json` y primitivas `Button`, `Card`, `Badge`, `Progress`, `StatCard`, `Section`, `Sheet`, `DataGrid` y `FilterPill`.
- **Fase 1 - Shell:** sidebar, topbar, paleta ⌘K/Ctrl+K, drawer móvil, densidad persistida, refresh global, estado de fuentes y navegación activa.
- **Fase 2 - Keywords:** KPIs con sparkline, serie diaria, distribución de posición, scatter de oportunidades, tabs de vista, búsqueda, grilla con TanStack Table v9 y ficha de evidencia.
- **Fase 3 - Resumen y Auditoría:** KPIs, GSC/GA4 con deltas, rankings, salud técnica, issues, páginas con detalle, experiencia, rendimiento, historial y configuración.
- **Fase 4 - Resto:** Search Console, Analytics, Contenido, Alertas y Configuración con el mismo sistema visual.
- **Fase 5 - Limpieza:** `globals.css` pasó de ~81 KB a ~5 KB; se eliminaron `ui.tsx`, `data-table.tsx` e `indexation-panel.tsx`; ruta `/indexacion` retirada; 404 propio en modo oscuro.

Documentación: [`ui-redesign.md`](ui-redesign.md).

### 1.2 Datos y contratos

- **Keywords:** `totals`, `previous`, `daily`, `truncated` y por fila `clickDelta`, `positionDelta`, `expectedCtr`, `potentialClicks`, `opportunityScore` y `brand`.
- **Alertas:** valores numéricos acotados en servidor y cliente (sin decimales crudos).
- **Contraste:** contraste corregido en tablas y filtros de Contenido/Keywords.

### 1.3 AI Search - tráfico IA

- Página `/ai-search` con pestaña **Tráfico IA**.
- Consulta GA4 en vivo por `sessionSource` contra asistentes: ChatGPT/OpenAI, Perplexity, Gemini, Copilot, Claude, DeepSeek, You, Phind y Poe.
- KPIs con comparación de período, serie diaria, split por plataforma, orígenes y landing pages.
- Endpoint: `GET /api/ai-search`.
- Límite documentado: no incluye citas en Google AI Overviews (no generan referrer).

### 1.4 AI Search - menciones IA (manual, costo cero)

- Pestaña **Menciones IA** dentro de `/ai-search`.
- Librería de prompts (`ai_prompts`) y chequeos (`ai_mention_checks`).
- Registro por chequeo: plataforma, fecha, mencionado sí/no, posición, URL citada, fuentes, extracto, evidencia y notas.
- Score: prompts activos, cobertura, visibilidad de marca, ranking medio y visibilidad por plataforma.
- 7 prompts sugeridos cargados en producción.
- Endpoints: `GET/POST/DELETE /api/ai-prompts` y `GET/POST/DELETE /api/ai-mentions`.
- Las tablas se crean de forma idempotente en el primer uso y también están en `schema.sql`.

Documentación: [`ai-search.md`](ai-search.md).

### 1.5 Intelligence

- Página `/intelligence` (reemplaza el antiguo botón de "próximo módulo").
- Combina keywords, auditoría, alertas, tráfico IA y menciones IA en señales priorizadas.
- Scoring determinístico: `impacto × peso_confianza × peso_esfuerzo`.
- Foco de la semana (top 3), grupos por categoría, brief copiable y estado de fuentes.
- Endpoint: `GET /api/intelligence`.

### 1.6 Verificación

```bash
npx tsc --noEmit
npm run lint
npm run build
npm test        # 25 tests
npm run test:ui # E2E desktop + móvil
```

Estado actual: todo verde. Sin overflow horizontal a 390 px en las páginas nuevas.

---

## 2. Pendiente

### 2.1 IA y menciones

| Pendiente | Bloqueo | Impacto |
|---|---|---|
| Chequeo automático de menciones | Requiere API key paga (OpenAI, Perplexity, Anthropic) o Gemini free tier con key y cuotas | Alto: elimina el trabajo manual semanal |
| Citas en Google AI Overviews | No hay API gratuita; requiere SERP API paga o registro manual | Alto para GEO/AEO |
| Histórico propio de tráfico IA | Hoy se consulta GA4 en vivo; falta tabla diaria `ga4_ai_daily` | Medio: series más largas que la retención de GA4 |
| Alertas automáticas de IA | Las señales ya alimentan Intelligence, pero no el motor de Alertas | Medio: detección proactiva de caídas |
| Share of voice vs competidores | El modelo actual mide presencia propia | Medio: comparación competitiva |
| Brief generado por LLM | Se evitó a propósito para mantener $0 | Bajo: el brief determinístico ya es usable |

### 2.2 SEO Intelligence (plan original)

| Pendiente | Estado |
|---|---|
| Volumen, dificultad y clustering avanzado de keywords | Sin proveedor de datos (DataForSEO u otro) |
| Investigación de keywords y SERPs | No implementado |
| Competitive Radar (competidores, gaps, amenazas) | No implementado |
| Response Automation (playbooks, aprobaciones, acciones) | No implementado |
| Growth & Revenue (CRM, atribución lead → keyword → deal) | No implementado |
| Reportes PDF/CSV y exportaciones comerciales | Parcial (export JSON puntual) |
| Notificaciones externas (Telegram, email) | No implementado |
| Indexación en UI | Ruta deshabilitada; API existe |
| Multicuenta, planes, permisos y presupuestos | No implementado (base actual de un solo sitio) |
| Despliegue en Hostinger | Pendiente de infraestructura |

### 2.3 Deuda técnica menor

- `DataGrid` no usa virtualización; con miles de filas conviene evaluar TanStack Virtual.
- Las tablas anchas usan scroll horizontal interno; evaluar columnas configurables.
- El proyecto no tiene commit automático ni CI configurado para los nuevos tests.

---

## 3. Cómo se actualiza el estado

- Cambios de UI: editar [`ui-redesign.md`](ui-redesign.md).
- Cambios de AI Search: editar [`ai-search.md`](ai-search.md).
- Roadmap de producto: [`intelligence-seo-project-plan.md`](intelligence-seo-project-plan.md) y [`intelligence-seo-checklist-comparacion.md`](intelligence-seo-checklist-comparacion.md).
