# Métricas y filtros

## Fuentes

- **Search Console (GSC):** clicks orgánicos desde resultados de Google, impresiones, CTR, posición media, queries y organic paths. Las oportunidades se agrupan por posición 4–10 y 11–20.
- **Google Analytics 4 (GA4):** usuarios, usuarios nuevos, sesiones totales, sesiones orgánicas, sesiones con interacción, engagement rate, tiempo de interacción, eventos, conversiones/key events, landing pages, source/medium, país y dispositivo.
- GSC clicks no equivale a GA4 sessions: son eventos y ventanas de medición distintas. Consentimiento, bloqueadores, redirecciones y atribución pueden explicar diferencias.

## Filtros

Los filtros globales de periodo, idioma, país y dispositivo se envían a las APIs live. Página y query se aplican a las dimensiones correspondientes. En cada tabla, la búsqueda global, los filtros por columna y las cabeceras de ordenación operan sobre las filas recibidas; `min:max` permite rangos numéricos. Las tablas muestran paginación cuando superan su límite.

Las vistas sin backend (auditoría técnica, Keywords, Contenido y Alertas) llevan la etiqueta **Demo** y usan datos de muestra.

## Tráfico IA

`Sesiones desde IA` es una derivación transparente, no una métrica nativa universal de GA4. Se consulta `sessionSource` con un filtro `FULL_REGEXP` contra `AI_REFERRAL_SOURCES` en `src/lib/integrations.ts`: ChatGPT/OpenAI, Perplexity, Claude, Gemini, Copilot, You.com, Phind, Poe y DeepSeek. La lista es una constante ampliable.

El tráfico IA se mantiene separado de Organic Search, Direct y Referral general. Si GA4 rechaza la combinación de dimensión y filtro, la API devuelve `aiStatus: unavailable` y la UI muestra `No disponible`/`IA no disponible`; nunca se presentan datos demo como live. Los datos demo sólo aparecen cuando toda la integración cae al fallback y quedan etiquetados como **Demo fallback**.
