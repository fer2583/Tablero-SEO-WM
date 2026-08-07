# Métricas y filtros

## Matriz de secciones

| Sección | Fuente | Dimensiones | Filtros |
| --- | --- | --- | --- |
| Resumen | `/api/summary`, snapshots DB | métricas agregadas de GSC/GA4, auditoría, indexación | ninguno contra APIs; sólo snapshot persistido |
| Search | GSC Search Analytics, `/api/integrations/search-console` | fecha, página, país, dispositivo, search type, apariencia y métricas globales | periodo, idioma, país, dispositivo, página |
| Keywords | GSC Search Analytics, `/api/gsc/keywords` | query + página, keyword objetivo, intención, cluster, estado, marca/no marca | periodo, país, dispositivo, página, query |
| Analytics | GA4 Data API, `/api/integrations/analytics` | landing page, métricas, source/medium, país, dispositivo | Organic Search, periodo, idioma, país, dispositivo, página |
| Auditoría | snapshots DB de PageSpeed, CrUX y crawler, `/api/audit` | URLs, issues, CWV, scores y schema | snapshot; no se ejecuta en render |
| Indexación | snapshots DB de URL Inspection, Sitemaps y crawler, `/api/indexation` | URL, veredicto, cobertura, canonical, sitemap | snapshot; separado de GSC Search Analytics |

La posición de Keywords se etiqueta como **media GSC** y no representa un ranking exacto. La canibalización se marca cuando una query devuelve múltiples páginas. Las oportunidades requieren posición media 4–15, más de 100 impresiones y CTR menor a 3%.

## Fuentes

- **Search Console (GSC):** clicks orgánicos desde resultados de Google, impresiones, CTR, posición media, queries y organic paths. Las oportunidades se agrupan por posición 4–10 y 11–20.
- **Google Analytics 4 (GA4):** usuarios, usuarios nuevos, sesiones totales, sesiones orgánicas, sesiones con interacción, engagement rate, tiempo de interacción, eventos, conversiones/key events, landing pages, source/medium, país y dispositivo.
- GSC clicks no equivale a GA4 sessions: son eventos y ventanas de medición distintas. Consentimiento, bloqueadores, redirecciones y atribución pueden explicar diferencias.

## Filtros

Los filtros globales de periodo, idioma, país y dispositivo se envían a las APIs live de Search, Keywords y Analytics. Página y query se aplican a las dimensiones correspondientes. En cada tabla, la búsqueda global, los filtros por columna y las cabeceras de ordenación operan sobre las filas recibidas; `min:max` permite rangos numéricos. Las tablas muestran paginación cuando superan su límite.

Si no existe DB o snapshot, Resumen devuelve `no_data`/`unavailable`; no consulta APIs externas. Keywords devuelve `no_data` cuando GSC responde sin filas y `unavailable` ante falta de conexión.

## Tráfico IA

`Sesiones desde IA` es una derivación transparente, no una métrica nativa universal de GA4. Se consulta `sessionSource` con un filtro `FULL_REGEXP` contra `AI_REFERRAL_SOURCES` en `src/lib/integrations.ts`: ChatGPT/OpenAI, Perplexity, Claude, Gemini, Copilot, You.com, Phind, Poe y DeepSeek. La lista es una constante ampliable.

El tráfico IA se mantiene separado de Organic Search, Direct y Referral general. Si GA4 rechaza la combinación de dimensión y filtro, la API devuelve `aiStatus: unavailable` y la UI muestra el estado de fuente no disponible. Una integración no disponible devuelve payload vacío; una consulta válida sin filas devuelve `no_data`.
