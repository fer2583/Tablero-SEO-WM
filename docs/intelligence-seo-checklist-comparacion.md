# Intelligence SEO — Checklist del tablero actual contra el plan

**Fecha de revisión:** 2026-10-24  
**Repositorio:** Tablero-SEO-WM  
**Plan de referencia:** [Intelligence SEO — Project Plan](intelligence-seo-project-plan.md)  
**Alcance:** inventario de la implementación actual y comparación con las fases del plan.

## 1. Resumen

Tenemos una base fuerte de auditoría técnica y reporting GSC/GA4. Keywords y Contenido están incompletos. La plataforma multicuenta, el monitoreo competitivo y los agentes todavía están pendientes.

La prioridad es convertir los datos existentes en inteligencia SEO confiable, reutilizando el crawler, las integraciones y la persistencia que ya están desarrollados.

### Leyenda y criterio

- **✅ Implementado:** existe código conectado para esa capacidad.
- **🟡 Parcial:** existe una base, pero no satisface todo el alcance del plan.
- **⬜ Pendiente:** no se encontró implementación operativa.

El estado refleja una revisión del código: no acredita por sí solo conexión vigente, ejecución correcta en producción o disponibilidad de las fuentes. Una tabla, un placeholder o una etiqueta en la interfaz no cuentan como funcionalidad terminada. No se ejecutaron nuevas pruebas ni despliegues para preparar esta comparación.

## 2. Qué abarca hoy nuestro tablero

| Sección | Estado | Qué tenemos y qué falta |
|---|---|---|
| **Resumen** | 🟡 | KPIs, comparaciones, rankings GSC y resultados técnicos. Algunos indicadores son placeholders y hay métricas que necesitan corregir su alcance. |
| **Search Console** | ✅ | Rendimiento, consultas/páginas, países, dispositivos, URLs y comparación agregada de períodos. Hay límites de filas y no todas las vistas usan histórico persistido. |
| **Analytics** | 🟡 | Adquisición, conversiones, dispositivos, geografía, páginas y reportes temporales. Algunos filtros y nombres de métricas necesitan corrección. |
| **Auditoría técnica** | ✅ | Crawler propio, reglas, incidencias, puntuación, cobertura, historial, comparación y reauditorías selectivas. |
| **Experiencia / Playwright** | ✅ | Auditoría renderizada por muestras, accesibilidad automática, recorridos, capturas y comparación visual. Ejecución local/CI. |
| **PageSpeed / CrUX** | ✅ | Medición mobile/desktop, puntuaciones, métricas, caché, consulta automática y manual, diagnóstico de errores y falta de datos. |
| **Keywords** | 🟡 | Consultas reales de GSC, filtros y oportunidades básicas. Sin targets operativos, tendencias reales, volumen, dificultad ni clustering funcional. |
| **Contenido** | 🟡 | Consultas, páginas, oportunidades y agrupaciones básicas. El cruce GSC/GA4 y las agrupaciones requieren mejoras. |
| **Alertas** | 🟡 | Reglas, severidad, persistencia, deduplicación y estados. Faltan alertas por keyword, umbrales configurables y notificaciones externas. |
| **Configuración** | 🟡 | Visor de fuentes y sincronización. No permite administrar conexiones, usuarios, sitios o proveedores. |
| **Indexación** | 🟡 | Hay API e inspección de una muestra de URLs, pero la pantalla `/indexacion` está deshabilitada. |
| **Reportes y exportaciones** | 🟡 | Exportación técnica JSON y evidencias. Sin generador comercial PDF/CSV/HTML. |

### Herramientas comunes existentes

- [x] Navegación entre las secciones principales.
- [x] Tablas con búsqueda local, ordenación y paginación de 25 filas.
- [x] Filtros por columna cuando están habilitados en la tabla.
- [x] Comparaciones agregadas de períodos en Search Console y Analytics.
- [x] Estados de fuente y fechas de actualización en distintas secciones.
- [ ] Selector real de workspace y administración de usuarios.
- [ ] Búsqueda global funcional.
- [ ] Centro de notificaciones conectado a la campana del encabezado.
- [ ] Exportación general de reportes e importación CSV de keywords.

## 3. Fase 0 — Base multicuenta

| Ticket del plan | Estado | Qué ya tenemos / qué falta |
|---|---|---|
| `core-01` Organizaciones, workspaces y miembros | ⬜ | No implementado. El tablero está acoplado a Whalemate. |
| `core-02` Planes, suscripciones y módulos | ⬜ | Sin implementación de planes ni habilitaciones comerciales por cuenta. |
| `core-03` Consumos, costos, presupuestos y créditos | ⬜ | Sin ledger de consumo, tarifas de proveedores ni presupuestos por workspace. |
| `core-04` Control de permisos y reserva de presupuesto | ⬜ | Sin implementación. Los límites del crawler y los locks no equivalen a permisos comerciales ni presupuestos. |
| `core-05` Login, roles y aislamiento entre clientes | ⬜ | No hay autenticación multicuenta ni autorización por workspace. La autenticación de Google existente corresponde al proveedor, no al usuario del tablero. |
| `core-06` Infraestructura y despliegue Hostinger | 🟡 | Ya existen Next.js, Postgres, migraciones y configuración Vercel. Falta implementar Hostinger/staging y su despliegue automatizado. |

**Balance:** existe infraestructura de aplicación y persistencia, pero no el núcleo SaaS multicuenta. La habilitación y los recursos de Hostinger siguen pendientes de comprobación.

## 4. Fase 1 — SEO Intelligence

| Ticket del plan | Estado | Qué ya tenemos / qué falta |
|---|---|---|
| `seo-01` Crawler robusto | 🟡 Muy avanzado | Ya tiene descubrimiento, robots, lotes, persistencia, recuperación y límites. Falta ejecución autónoma, configuración por sitio y control de tasa por host. |
| `seo-02` Motor de auditoría | 🟡 Muy avanzado | Ya hay 32 reglas, evidencia, recomendaciones, score, excepciones e historial. Falta completar la configurabilidad prevista por el plan. Las reglas actuales están en TypeScript, no en un cargador YAML/JSON. |
| `seo-03` Keyword Intelligence con histórico | 🟡 | Existe consulta live y parte del histórico. Falta conservar relaciones consulta–página, segmentos y comparaciones reales por keyword, además del comportamiento de caché previsto. |
| `seo-04` Adaptador SERP / DataForSEO | ⬜ | Sin proveedor ni adaptadores de volumen, dificultad o SERPs. |
| `seo-05` Rank Tracker | ⬜ | No existe monitoreo independiente programado. La posición media GSC no cubre este ticket. |
| `seo-06` Gestión de keywords objetivo | 🟡 Solo esquema | Existen tablas de targets e histórico, pero no API/UI operativa. |
| `seo-07` Topic Clusters | 🟡 Muy básico | Contenido agrupa términos de forma léxica. No hay clustering semántico ni clusters gestionables. |
| `seo-08` Oportunidades configurables | 🟡 | Hay reglas fijas. Faltan configuración, criterios unificados, exportación y conversión a target/tarea. |
| `seo-09` Alertas SEO | 🟡 | Existe el motor general. Faltan alertas específicas por keyword, nuevas entradas y posibles conflictos entre páginas. |

### 4.1. Checklist de correcciones prioritarias de datos

- [ ] Corregir **Ganadoras/Perdedoras**: hoy ordenan por clics actuales, no por crecimiento o caída entre períodos.
- [ ] Hacer efectivo el filtro de idioma en Keywords.
- [ ] Conservar histórico conjunto de consulta y página para comparar su relación.
- [ ] Recopilar los segmentos de país/dispositivo que se ofrezcan como filtros del histórico: hoy la ingesta diaria guarda agregados `all`.
- [ ] Informar cuándo faltan fechas, segmentos o períodos comparables.
- [ ] Normalizar URLs para cruzar GSC con GA4 sin perder la identidad de las URLs observadas.
- [ ] Revisar el alcance orgánico de las métricas usadas en Resumen y Contenido.
- [ ] Corregir filtros de Analytics que no llegan a la consulta y etiquetas que no corresponden a la métrica obtenida.
- [ ] Diferenciar **posible canibalización** de un conflicto confirmado.
- [ ] Mostrar fuente, período, actualización y límites de cada resultado.
- [ ] Unificar las reglas de oportunidades: Keywords y Contenido usan umbrales distintos.

### 4.2. Límites del histórico actual

- La ingesta recupera los últimos 30 días y hace upsert; puede acumular historia con sucesivas ejecuciones, pero no implementa un backfill completo.
- Las consultas y las páginas se obtienen por separado: no permiten reconstruir su relación histórica mediante un cruce arbitrario.
- Los snapshots resumen usan claves fijas y se sobrescriben; no constituyen por sí mismos una serie versionada.
- El módulo Keywords consulta GSC en vivo, hasta 1.000 filas, sin paginación de la API.
- Los rankings del Resumen usan un conjunto limitado de consultas, no todo el universo de keywords del sitio.

**Balance:** crawler y auditoría se deben reutilizar; Keywords necesita completar su lógica y corregir la base de datos que alimentará el análisis antes de sumar IA.

## 5. Fase 2 — Inteligencia competitiva

| Ticket del plan | Estado | Qué ya tenemos / qué falta |
|---|---|---|
| `comp-01` Registro de competidores | ⬜ | No existe registro operativo, frecuencia ni configuración por competidor. |
| `comp-02` Crawling de competidores | ⬜ | El crawler actual está restringido a Whalemate. |
| `comp-03` Comparación de cambios competitivos | 🟡 Primitivas reutilizables | Tenemos snapshots estructurados, hashes y comparación de incidencias. Falta el seguimiento y diff de contenido de competidores. |
| `comp-04` Topic Battlefield | ⬜ | No existe comparación temática entre sitios. |
| `comp-05` SERP Gap | ⬜ | No existe. Depende de obtener SERPs externas. |
| `comp-06` Alertas competitivas | ⬜ | No existen. |

**Balance:** hay tecnología reutilizable, pero todavía no hay un módulo competitivo funcional. La comparación de incidencias técnicas no equivale a un diff semántico de contenido.

## 6. Fase 3 — GEO y respuesta

| Ticket del plan | Estado | Qué ya tenemos / qué falta |
|---|---|---|
| `geo-01` Biblioteca de prompts | ⬜ | No existe. |
| `geo-02` Medición de menciones y citas en IA | ⬜ | No existe. El tráfico referido desde IA en GA4 no equivale a medir visibilidad GEO. |
| `geo-03` Countermove Engine | ⬜ | No existe. Las recomendaciones actuales son textos de reglas técnicas, no contramovimientos competitivos. |
| `geo-04` Model Router / Ollama | ⬜ | No hay integración ni enrutamiento entre modelos. |
| `geo-05` Acciones y aprobaciones | ⬜ | No hay gestión ni ejecución de acciones SEO. |
| `geo-06` Telegram / email digest | ⬜ | No implementado. |
| `geo-07` Seguimiento de resultados postacción | ⬜ | No existe relación entre una acción ejecutada y su medición posterior. |

**Balance:** el módulo está pendiente. Los referrals IA, las recomendaciones determinísticas y la aprobación de una referencia visual no sustituyen las capacidades de esta fase.

## 7. Fase 4 — Full OS

- [ ] Workflows de ejecución con aprobaciones.
- [ ] Integraciones CMS.
- [ ] Creación automatizada de PRs.
- [ ] Integraciones CRM.
- [ ] Experimentación y medición de resultados.
- [ ] Atribución comercial.
- [ ] Administración de agencias, white label y SSO.

**Balance:** pendiente.

## 8. Capacidades transversales del plan

| Capacidad | Estado | Observación |
|---|---|---|
| Motor determinístico de reglas | ✅ | Existe en auditoría y alertas; no equivale a un Model Router. |
| Opportunity Scoring comercial configurable | 🟡 | Hay heurísticas y prioridades técnicas; falta un score de oportunidades ligado a objetivos comerciales. |
| Report Generator | 🟡 | Hay reportes técnicos JSON, capturas y trazas; faltan plantillas y generación comercial PDF/CSV/HTML. |
| Cola general y worker local autónomo | ⬜ | Hay estado persistido de crawl y un runner CLI, pero no una cola general de tareas con dispatcher y worker. |
| Cron de sincronización | ⬜ | Hay ingesta manual/oportunista; no hay programación de cron versionada en el repositorio. |
| Pruebas automatizadas | ✅ | Existen pruebas de crawler, persistencia, rendimiento, navegador y UI. No se volvieron a ejecutar en esta revisión. |
| CI como control automático de calidad | 🟡 | Existe workflow manual de auditoría browser; falta automatizar tests/lint/build como control de cambios. |
| Demo pública y trial con cuotas | ⬜ | No hay una experiencia separada con datos de ejemplo, autenticación y límites del trial. |

## 9. Activos que el plan debe reconocer como ya desarrollados

Los siguientes puntos deben figurar como **reutilizar/ampliar**, no como desarrollos desde cero:

- [x] Crawler HTTP propio con Cheerio.
- [x] Estado persistido, leases y recuperación de corridas.
- [x] Pausa, reanudación, cancelación y reauditoría selectiva.
- [x] Motor contextual de reglas y excepciones versionadas.
- [x] Comparación de incidencias nuevas, persistentes, resueltas y sin reevaluar.
- [x] Crawl incremental opcional con ETag/304.
- [x] Runner Playwright, axe-core, recorridos y regresión visual.
- [x] PageSpeed y CrUX separados, con caché y tareas persistidas.
- [x] Integraciones GSC/GA4 e ingesta diaria persistida.
- [x] Motor básico de alertas.
- [x] Exportaciones JSON y evidencias técnicas.
- [x] Migraciones y pruebas automatizadas existentes.

### Límites importantes de estos activos

- El navegador coordina los lotes del crawl: cerrar el tablero conserva el estado, pero no programa su continuación autónoma.
- Playwright trabaja sobre muestras representativas, no como renderizado automático de todas las URLs.
- Los snapshots del crawler conservan resultados estructurados; no son un archivo completo y versionado de HTML y contenido textual.
- CrUX mide datos de campo por origen y dispositivo; no implica que cada URL auditada tenga datos propios.
- JSON-LD válido y pruebas automáticas de accesibilidad no equivalen a elegibilidad garantizada para resultados enriquecidos ni a certificación de accesibilidad.

## 10. Orden práctico que sale del checklist

1. **Corregir calidad de datos y terminar Keywords/Contenido.** Priorizar comparaciones reales, relaciones consulta–página, filtros efectivos y cruces explicables.
2. **Hacer autónomos los procesos existentes.** Reutilizar el motor actual mediante tareas persistidas y un worker que no dependa de una pestaña abierta.
3. **Agregar multicuenta y conexiones independientes.** Probar aislamiento de datos, tareas, cachés y credenciales antes de incorporar otro cliente.
4. **Incorporar SERPs y rank tracking opcional.** Separar posiciones observadas externamente de la posición media GSC y medir el consumo.
5. **Construir inteligencia competitiva.** Generalizar el crawler y añadir registro de competidores, snapshots comparables y oportunidades.
6. **Sumar GEO, agentes y ejecución.** Aplicar metodologías reproducibles, presupuestos y seguimiento de resultados.

**Conclusión:** ya tenemos el motor técnico y buena parte del tablero de datos. Falta convertirlo en inteligencia SEO confiable y, después, en un producto multicuenta.

## 11. Referencias en el repositorio

| Área | Archivos principales |
|---|---|
| Plan original | [`intelligence-seo-project-plan.md`](intelligence-seo-project-plan.md) |
| Navegación y secciones | [`dashboard-shell.tsx`](../src/components/dashboard-shell.tsx), [`page.tsx`](../src/app/[section]/page.tsx) |
| Resumen | [`summary-panel.tsx`](../src/components/summary-panel.tsx), [`API summary`](../src/app/api/summary/route.ts) |
| Search Console / Analytics | [`integration-panels.tsx`](../src/components/integration-panels.tsx), [`integrations.ts`](../src/lib/integrations.ts) |
| Keywords | [`keywords.ts`](../src/lib/keywords.ts), [`API keywords`](../src/app/api/gsc/keywords/route.ts) |
| Contenido | [`content.ts`](../src/lib/content.ts), [`content-panel.tsx`](../src/components/content-panel.tsx) |
| Alertas | [`alerts.ts`](../src/lib/alerts.ts), [`alerts-panel.tsx`](../src/components/alerts-panel.tsx) |
| Configuración / Indexación | [`API configuration`](../src/app/api/configuration/route.ts), [`indexation.ts`](../src/lib/indexation.ts) |
| Ingesta y persistencia | [`ingest.ts`](../src/lib/ingest.ts), [`schema.sql`](../src/db/schema.sql), [`queries.ts`](../src/db/queries.ts) |
| Crawler y reglas | [`engine.ts`](../src/lib/crawler/engine.ts), [`rules.ts`](../src/lib/crawler/rules.ts), [`audit-store.ts`](../src/db/audit-store.ts), [`audit.rules.config.ts`](../audit.rules.config.ts) |
| Rendimiento | [`audit.ts`](../src/lib/audit.ts), [`performance.ts`](../src/lib/crawler/performance.ts) |
| Navegador | [`runner.ts`](../src/lib/browser-audit/runner.ts), [`audit-browser.ts`](../scripts/audit-browser.ts), [`audit.browser.config.ts`](../audit.browser.config.ts) |
| Operación de auditoría | [`AUDIT-SOURCES.md`](AUDIT-SOURCES.md) |
| Pruebas | [`tests/`](../tests/) |

Este checklist es una fotografía del estado revisado. Debe actualizarse cuando un ticket se complete y se verifique su comportamiento, manteniendo la distinción entre código existente, integración operativa y alcance comercial terminado.
