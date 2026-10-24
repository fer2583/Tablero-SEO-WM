# Plan de mejora del Crawler y la Auditoría técnica

Estado: implementación del núcleo y la capa Playwright disponible en el repositorio. La activación en cada entorno requiere aplicar la migración y configurar sus credenciales. Las secciones siguientes conservan el diagnóstico de partida y el diseño; la sección 15 describe la operación y el alcance implementado.

Alcance: sección `/auditoria-tecnica` y endpoints `/api/audit`, `/api/configuration`, `/api/summary`.

Stack: se mantiene **Next.js 16 + React + TypeScript + Postgres/Neon en Vercel**. Se incorporan librerías pequeñas para interpretar HTML y `robots.txt`, y **Playwright + axe-core** como motor de auditoría renderizada en un runner separado.

## 1. Diagnóstico de partida

La sección funciona, pero no responde las preguntas que un responsable SEO necesita: qué está mal, en qué páginas, por qué importa y si se corrigió.

| Problema | Impacto |
|---|---|
| La auditoría solo revisa 20 de las 396 URLs del sitemap | El resultado parece sano porque la muestra es pequeña |
| `AUDIT_CRAWL_LIMIT` no está definido en producción; el default es 20 y el tope duro 50 | No hay forma de auditar el sitio completo desde la configuración actual |
| `GET /api/configuration` ejecuta `runAudit()` en cada request | Abrir el dashboard dispara crawl, PSI y CrUX (30-60 s) |
| `snapshot_key: "manual"` se reutiliza en cada corrida | El historial tiene una sola fila y las incidencias antiguas no se limpian |
| Las páginas que fallan al descargar se descartan del análisis | Un timeout o un 429 puede no generar ninguna incidencia |
| `language()` no reconoce `/br/` | El idioma real `pt-BR` se clasifica mal |
| `robots.txt` falla cerrado y no interpreta `Disallow` | Un error temporal bloquea todo el crawl; las reglas reales se ignoran |
| El parseo de HTML se hace con regex | Falsos positivos y negativos en metadatos, headings, hreflang y JSON-LD |
| El recorte del body se aplica después de descargar | Se baja el cuerpo completo y se puede cortar JSON-LD a la mitad |
| `saveAuditSnapshot()` inserta fila por fila | Guardar cientos de páginas se vuelve otro cuello de botella |
| PSI y CrUX se piden en cada ejecución sin caché | Latencia, cuota y resultados inconsistentes |
| `sources.crawler` y `schema.status` quedan siempre en `partial` | El estado no comunica cobertura real |

Referencias de comportamiento actual: `src/lib/audit.ts`, `src/lib/site.ts`, `src/app/api/audit/route.ts`, `src/app/api/configuration/route.ts`, `src/db/queries.ts`.

## 2. Qué mantiene y qué cambia la propuesta

### Se mantiene

- El stack y el modelo de despliegue en Vercel.
- La lectura de sitemap, PSI, CrUX y Search Console.
- La separación entre datos de laboratorio, datos de campo y auditoría propia.
- Los estados `partial`, `unavailable` y `live` como información válida.

### Se cambia

| Propuesta anterior | Mejora recomendada |
|---|---|
| Ejecutar todo en una petición de hasta 300 s | Procesar por lotes con progreso persistido y reanudación |
| Streaming como mecanismo principal de progreso | Progreso en Postgres; streaming solo como refinamiento posterior |
| Rastrear únicamente el sitemap | Sitemap más descubrimiento de enlaces internos |
| Continuar siempre si `robots.txt` falla | Distinguir ausencia del archivo de errores temporales |
| Puntuar por cantidad de incidencias | Puntuación por regla, categoría y páginas evaluables |
| Tratar canonical distinto o contenido corto como errores | Aplicar contexto de plantilla para evitar falsos positivos |
| Evitar migraciones | Una migración pequeña que habilite historial, consultas y reanudación |

La diferencia central: una petición larga puede terminar bien, pero no garantiza recuperación ante timeout, desconexión o despliegue durante el rastreo.

## 3. Arquitectura recomendada

```text
Crear auditoría
    ↓
Leer robots.txt y descubrir sitemaps
    ↓
Persistir URLs pendientes
    ↓
Procesar lotes y descubrir enlaces internos
    ↓
Guardar resultados y progreso
    ↓
Evaluar reglas entre páginas
    ↓
Seleccionar escenarios de navegador
    ↓
Ejecutar Playwright sobre páginas representativas
    ↓
Publicar auditoría y comparar con la anterior
```

La auditoría tiene **dos motores** que escriben en el mismo historial:

| Motor | Cobertura | Qué aporta |
|---|---|---|
| Crawler HTTP/HTML | Sitio completo | SEO técnico, enlaces, metadatos, cobertura |
| Auditor de navegador (Playwright) | Páginas representativas | Renderizado, interacción, accesibilidad, responsive y capturas |

El crawler HTML alimenta la selección de escenarios del navegador; el auditor de navegador confirma qué ocurre realmente cuando la página se ejecuta.

### Endpoints

| Operación | Endpoint |
|---|---|
| Crear auditoría | `POST /api/audit/runs` |
| Consultar progreso | `GET /api/audit/runs/:id` |
| Procesar siguiente lote | `POST /api/audit/runs/:id/process` |
| Pausar, reanudar o cancelar | `POST /api/audit/runs/:id/actions` |
| Páginas e incidencias paginadas | Endpoints de la corrida |
| Último resultado publicado | `GET /api/audit` |

El botón "Auditar ahora" debe usar `POST`. Una operación costosa que modifica la base no debe dispararse con `GET`.

### Ejecución de lotes

- Lotes iniciales de 25 a 50 URLs.
- Concurrencia moderada y configurable.
- Reducir el ritmo ante 429/503 y respetar `Retry-After`.
- Reintentos acotados solo para errores transitorios.
- Bloqueo con vencimiento para evitar procesar un lote dos veces.
- Resultados idempotentes: repetir una petición no duplica páginas.
- Guardar progreso al cerrar cada lote.

En la primera versión el navegador coordina los lotes. Si se cierra, la auditoría queda recuperable y continúa al volver. Ejecutarla con el navegador cerrado requiere añadir después un mecanismo de ejecución durable.

La documentación de Vercel permite 300 s en Hobby con Fluid Compute. Se toma como margen de ejecución, no como fundamento de la arquitectura. Ver [duración de funciones](https://vercel.com/docs/functions/configuring-functions/duration).

## 4. Crawler

### Fuentes de URLs

1. Sitemap y sus índices.
2. Enlaces internos encontrados desde la home y las páginas.
3. URLs presentes en los datos persistidos de GSC y GA4.
4. URLs conocidas de auditorías anteriores.

Cada URL guarda su origen: sitemap, enlace, Analytics o historial.

### Funcionalidades que habilita

- Enlaces internos rotos, indicando qué páginas enlazan al destino.
- Páginas descubiertas por enlaces que no están en el sitemap.
- URLs del sitemap sin enlaces entrantes detectados.
- Profundidad desde la home.
- Enlaces internos que pasan por redirecciones.
- Bucles y cadenas de redirección.
- Páginas conocidas por GSC/GA4 que el crawl no logra alcanzar.

"No está en sitemap" no significa "huérfana". La detección de posibles páginas huérfanas se basa en el grafo de enlaces y expresa sus límites cuando el rastreo es parcial.

### Normalización

- Quitar fragmentos y resolver URLs relativas.
- No convertir automáticamente rutas a minúsculas ni unificar barras finales: pueden ser recursos distintos.
- Controlar parámetros, calendarios y paginaciones para evitar rastreos infinitos.
- Todo límite aplicado debe quedar visible en el resultado.

### Errores de descarga

Una página no descargada debe figurar como **no evaluada**, nunca como página sin problemas. Estados explícitos:

- Timeout.
- Error DNS o TLS.
- Respuesta 429.
- Bloqueo del servidor.
- Error HTTP.
- Contenido no HTML.
- Respuesta truncada.

Además, limitar bytes durante la lectura de la respuesta y registrar `bodyTruncated` cuando corresponda.

### robots.txt

- 404/410: continuar sin restricciones declaradas.
- 429/5xx o error de red: aplicar reintentos y caché válida; pausar si no hay política utilizable.
- Respetar `Allow`/`Disallow` y registrar las URLs excluidas.

Un `robots.txt` inexistente no es equivalente a uno temporalmente inaccesible. Ver [especificación de robots.txt](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).

## 5. Reglas SEO

### Tratamiento contextual

| Caso | Tratamiento |
|---|---|
| Menos de 300 palabras | Observación según plantilla; no error automático |
| Title de más de 60 caracteres | Advertencia configurable, no infracción absoluta |
| Canonical hacia otra URL | Verificar destino y coherencia; puede ser correcto |
| Más de un H1 | Advertencia estructural, no error crítico universal |
| Imagen con `alt=""` | Puede ser decorativa; distinguir de imagen sin atributo ALT |
| Página sin JSON-LD | Oportunidad según plantilla, no fallo técnico general |
| Meta description duplicada | Evaluar en páginas indexables y canónicas |
| Error HTTP | Problema principal; evitar cascadas de "falta title/H1/schema" |

Google admite canonical hacia otras URLs como mecanismo de consolidación. El problema relevante es que sea contradictorio, apunte a un destino roto o entre en conflicto con otras señales. Ver [consolidación de duplicados](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

### Rastreo e indexabilidad

- 4xx/5xx, timeouts y redirecciones.
- `meta robots`, `googlebot` y `X-Robots-Tag`.
- Canonical múltiple, roto, redirigido o no indexable.
- URLs no indexables dentro del sitemap.
- Recursos bloqueados o pendientes de evaluación.

### Internacionalización

- Reconocimiento correcto de ES, EN y PT-BR.
- Hreflang recíproco, autorreferencia y códigos válidos.
- Destinos hreflang accesibles y coherentes con canonical.
- Agrupaciones de traducciones incompletas.

### On-page y contenido

- Metadatos ausentes o duplicados.
- Estructura de encabezados.
- Texto principal, excluyendo navegación y pie.
- Duplicados exactos y posibles duplicados dentro del mismo idioma.

### Datos estructurados

- Bloques JSON-LD separados de cantidad de entidades y tipos.
- Errores de parsing.
- Reglas específicas por plantilla.
- Distinguir JSON válido de elegibilidad para resultados enriquecidos.

## 6. Modelo de datos

Se reutiliza `audit_runs` y se amplía con:

- **Páginas por corrida:** estado, métricas extraídas, errores e intentos.
- **Enlaces por corrida:** origen, destino y atributos necesarios.
- **Incidencias:** regla, URL y evidencia estructurada.
- **Escenarios de navegador:** página, idioma, viewport, recorrido y estado de ejecución.
- **Hallazgos renderizados:** criterio, evidencia técnica, captura, severidad, confianza y tipo de evaluación.
- **Capturas y referencias aprobadas:** imagen, viewport, fecha y versión del criterio.
- **Versiones:** configuración del crawl, catálogo de criterios, reglas y fórmula de puntuación.

Cada corrida tiene identificador único e inmutable. Los grupos de problemas se calculan para la interfaz conservando las ocurrencias individuales.

Presentación esperada:

> 12 tipos de problemas · 83 incidencias · 47 páginas afectadas

Las inserciones se hacen por lote y en transacciones cortas. Una corrida se publica como completada solo cuando su persistencia terminó.

## 7. Puntuación

No se usa `cantidad de issues / páginas × 10` como fórmula definitiva. Se proponen puntuaciones por categoría, con pesos acotados por regla y denominadores de páginas realmente evaluables.

Se separa:

- Salud técnica.
- Cobertura del análisis.
- Estado de las fuentes externas.

En la capa renderizada se muestran indicadores independientes:

1. SEO técnico.
2. Funcionamiento de recorridos.
3. Accesibilidad automática.
4. Criterios UX/UI evaluados.
5. Cobertura de escenarios.

No se mezcla todo en una única "nota UX": ocultaría diferencias importantes.

Ejemplo de auditoría parcial:

> Salud provisional: 86/100 · cobertura HTML: 72% · 9 URLs sin evaluar

El score es una métrica interna explicable, no una estimación de posicionamiento en Google.

## 8. PSI y CrUX

Se ejecutan como tareas separadas del crawler:

- Caché por URL, dispositivo y fecha.
- PSI inicialmente sobre páginas representativas por plantilla.
- CrUX etiquetado como dato de origen o URL, con su período de colección.
- Sin datos de CrUX se muestra "sin datos", no una nota negativa.
- TBT de laboratorio e INP de campo se muestran como métricas diferentes.
- El tiempo de respuesta observado por el crawler no se presenta como Core Web Vital.

## 9. Auditoría renderizada y experiencia con Playwright

El crawler HTML comprueba qué entrega el servidor. Playwright comprueba **qué termina viendo y pudiendo hacer el usuario**. Es una capa complementaria, no un reemplazo.

Para WhaleMate permite además verificar diferencias entre mobile, desktop y las versiones ES, EN y PT-BR.

### Qué datos nuevos obtiene

| Área | Qué detecta | Valor |
|---|---|---|
| SEO renderizado | Cambios de title, canonical, robots, headings y enlaces tras ejecutar JavaScript | Detectar diferencias entre HTML inicial y DOM final |
| Funcionamiento | Menús que no abren, CTAs sin destino, formularios con errores, selector de idioma roto | Encontrar obstáculos concretos para navegar o contactar |
| Responsive | Desbordamientos horizontales, elementos cortados, superposiciones, contenido inaccesible | Detectar problemas reales en mobile |
| Accesibilidad | Controles sin nombre accesible, inputs sin etiqueta, errores de contraste, problemas de teclado | Mejorar la capacidad de usar el sitio |
| Recursos y JavaScript | Excepciones, imágenes fallidas y solicitudes fallidas relevantes | Encontrar problemas que el HTML por sí solo no muestra |
| Diseño visual | Capturas por página, idioma y viewport; diferencias contra una referencia aprobada | Detectar regresiones tras un cambio |
| Recorridos | Si una persona puede ir de un artículo al servicio y al formulario | Verificar caminos importantes del negocio |

Una captura sola aporta evidencia visual. El valor real está en combinarla con DOM, medidas de elementos y pruebas de interacción.

> Ejemplo: en mobile, el banner de consentimiento tapa el botón de contacto y Playwright no consigue pulsarlo.

Eso es accionable; "mejorar la experiencia mobile" no lo es.

### Catálogo de criterios UX/UI

Los criterios se guardan en un **catálogo versionado**, con reglas generales y reglas por plantilla. Cada criterio incluye:

- Identificador y descripción.
- Páginas y dispositivos donde aplica.
- Condición verificable.
- Severidad.
- Evidencia necesaria.
- Recomendación.
- Tipo de evaluación: automática o revisión humana.

#### Navegación y orientación

- Menú principal operable con mouse y teclado.
- Menú mobile que abre, permite navegar y cierra correctamente.
- Indicador de foco visible.
- Selector de idioma que lleva a la traducción correspondiente.
- Breadcrumbs coherentes donde estén definidos.
- Ausencia de elementos fijos que oculten contenido o controles.

#### CTAs y contacto

- CTA principal presente en las plantillas donde se haya definido.
- Texto accesible y destino válido.
- Botón realmente visible y accionable, no solo presente en el DOM.
- Formulario con etiquetas e instrucciones.
- Validaciones comprensibles.
- Mensajes de error asociados al campo.
- Estado de éxito verificable.

No se envían formularios comerciales reales durante cada auditoría. La validación y navegación se prueban sin envío; el flujo completo se verifica en un entorno de prueba.

#### Lectura y responsive

- Ausencia de scroll horizontal accidental.
- Texto o controles recortados.
- Solapamientos entre elementos.
- Imágenes deformadas.
- Legibilidad según criterios configurados.
- Comportamiento al ampliar texto.
- Consistencia de espaciados y tipografía respecto de los tokens del diseño.

Un texto cortado es un fallo comprobable; una tipografía "poco atractiva" es una valoración de diseño.

#### Accesibilidad

Se integra **axe-core con Playwright** para comprobaciones automáticas y se agregan recorridos de teclado. Esto detecta bastantes problemas, pero **no certifica el cumplimiento de WCAG**: la comprensión del contenido, la calidad de algunos textos alternativos o la lógica completa del foco requieren revisión adicional.

### Funcionalidades destacadas

#### Paridad entre idiomas

Comparar las versiones equivalentes para detectar:

- CTAs que desaparecen en una traducción.
- Texto que desborda por ser más largo.
- Elementos que quedan en otro idioma.
- Selector que devuelve a la home en vez de a la página equivalente.
- Formularios o menús que funcionan en ES y fallan en PT-BR.

Complementa la auditoría técnica de hreflang.

#### Recorridos de negocio verificables

Definir unos pocos caminos importantes:

```text
Artículo → servicio relacionado → contacto
Home → servicio → CTA principal
Glosario → contenido relacionado → servicio
Cambio de idioma → página equivalente
```

Resultado esperado:

> Recorrido bloqueado en el paso 3: el CTA queda cubierto en mobile.

Los recorridos priorizan mejor que la revisión de componentes aislados. El primer criterio a acordar es cuál es la acción principal del sitio: contacto, solicitud de diagnóstico, agendar una reunión u otra conversión.

#### Comparación antes y después

Guardar una referencia aprobada y comparar capturas, elementos clave, destinos de CTAs, comportamiento del menú y estado del formulario. Una diferencia visual no implica automáticamente un problema: puede ser un rediseño intencional. La referencia se aprueba y actualiza de forma controlada.

### Alcance de ejecución

Playwright es bastante más costoso que descargar HTML. **No se ejecuta sobre todas las URLs y todos los dispositivos en cada corrida.**

Cobertura inicial:

- Una página representativa por plantilla.
- Los tres idiomas.
- Mobile y desktop.
- Páginas importantes por tráfico o negocio.
- URLs modificadas o con incidencias previas.

Como referencia, cinco plantillas × tres idiomas × dos tamaños son **30 escenarios** antes de añadir recorridos. Es una cobertura razonable y ampliable.

### Dónde se ejecuta

El dashboard sigue en Vercel. El navegador se ejecuta inicialmente en **un runner Node.js local o en CI**, que reutiliza TypeScript y guarda los resultados en Postgres.

Ejecutar Chromium dentro de las funciones del dashboard agrega peso, consumo y restricciones operativas. Se evalúa por separado si después se necesita un botón que dispare auditorías completamente autónomas.

### Evidencia y presentación

Cada hallazgo incluye:

- URL, idioma y viewport.
- Criterio incumplido.
- Pasos para reproducirlo.
- Resultado esperado y observado.
- Captura con el elemento señalado.
- Evidencia técnica.
- Severidad y confianza.
- Estado: nuevo, persistente, corregido o pendiente de revisión.

### Límites

Playwright puede verificar que un botón funciona. **No demuestra que su texto convenza ni que aumente conversiones.** Para eso hacen falta analítica, investigación con usuarios o experimentos.

Tampoco reemplaza:

- **CrUX**, que aporta rendimiento real de usuarios.
- **Lighthouse**, para auditorías de laboratorio estandarizadas.
- **Revisión humana**, para aspectos subjetivos de diseño y comprensión.

Si más adelante se usa IA para revisar capturas, se emplea para **proponer observaciones con evidencia**, no para declarar fallos automáticamente.

## 10. Nuevas funcionalidades

### Prioridad alta

1. **Ficha de URL:** estado HTTP, indexabilidad, canonical, metadatos, hreflang, schema, enlaces entrantes/salientes, problemas y evidencia visual renderizada.
2. **Comparación entre auditorías:** problemas nuevos, resueltos, persistentes y URLs sin reevaluar.
3. **Reauditar una URL o un problema:** confirmar una corrección sin repetir todo el sitio.
4. **Priorización con GSC/GA4:** destacar problemas en páginas con tráfico o impresiones, indicando el período.
5. **Vista por plantilla e idioma:** detectar problemas corregibles en una sola plantilla.
6. **Progreso real:** pendientes, procesadas, bloqueadas, fallidas, excluidas y límite alcanzado.

### Segunda etapa

- Exportación de páginas e incidencias.
- Filtros guardados.
- Reglas configurables y excepciones justificadas.
- Detección de posibles soft 404.
- Crawl incremental usando caché y validadores HTTP cuando apliquen.
- Selección automática de páginas representativas para PSI.

## 11. Etapas de implementación

| Etapa | Entregable | Criterio de aceptación |
|---|---|---|
| **1. Fiabilidad** | Configuración sin crawl, corridas únicas, errores explícitos y persistencia consistente | Consultar configuración no dispara rastreo ni PSI/CrUX |
| **2. Crawl completo** | Lotes, parser, robots, sitemap, descubrimiento y reanudación | Todas las URLs del sitemap terminan en un estado explicado; sin cortes silenciosos a 20/50 |
| **3. Diagnóstico** | Reglas contextuales, evidencia, agrupación y puntuación versionada | Cada problema identifica URLs, causa y acción recomendada |
| **4. Interfaz útil** | Progreso, ficha de URL, comparación y reauditoría selectiva | Se puede localizar un problema y verificar su corrección |
| **5. Auditoría renderizada** | Runner Playwright, escenarios por plantilla/idioma/viewport, axe-core, capturas y recorridos | Los escenarios seleccionados se ejecutan, guardan evidencia y distinguen fallo comprobable de recomendación |
| **6. Enriquecimiento** | PSI/CrUX separados y prioridad con GSC/GA4 | Las fuentes tienen alcance, fecha y estado visibles |

## 12. Verificación

- Pruebas del motor con fixtures: parsing, robots, redirects, reintentos, reanudación e idempotencia.
- Pruebas de reglas SEO con HTML de ejemplo por plantilla e idioma.
- Pruebas de puntuación con denominadores de cobertura distintos.
- Pruebas de Playwright contra un sitio de prueba local: menú, idioma, formulario sin envío, responsive y teclado.
- Verificación de que axe-core y los criterios UX/UI distinguen automático de revisión humana.
- `npm run lint` y `npx tsc --noEmit` como control mínimo, no como validación del crawler.

## 13. Requisito de entorno

Actualmente `/api/*` local apunta a producción mediante el rewrite de `next.config.ts` (`API_PROXY_ORIGIN`). Antes de implementar hace falta:

- Ejecución local del crawler sin persistencia, o
- Una base de prueba o entorno preview para validar reanudación e historial sobre el backend nuevo.

Para Playwright hace falta además un runner con Chromium instalado (local o CI) y una URL de entorno de prueba para los recorridos que no deben tocar producción.

Sin esto no es posible verificar el comportamiento nuevo de forma segura.

## 14. Recomendación final

Implementar primero **fiabilidad, crawl completo y diagnóstico contextual**. Después incorporar comparación, priorización por tráfico y la **auditoría renderizada con Playwright**.

La capa de navegador se suma como módulo "Auditoría renderizada y experiencia", empezando por estas cinco capacidades:

1. SEO antes y después de JavaScript.
2. Errores de consola y recursos críticos.
3. Responsive: desbordamientos y superposiciones.
4. Accesibilidad automática con axe-core.
5. Recorridos de menú, idioma y contacto.

Después se agregan regresión visual y criterios UX/UI más específicos.

Esto mantiene el stack, resuelve el límite actual y convierte la sección en una herramienta para **encontrar, priorizar y comprobar una corrección**. Con Playwright, además, pasa de "la página tiene los elementos correctos" a **"la página se puede usar y permite completar los recorridos importantes"**, que es donde está su valor real.

## 15. Implementación y operación

Guía detallada de configuración, API y comandos: [AUDIT-SOURCES.md](AUDIT-SOURCES.md).

### Implementado

- Corridas únicas, una sola activa por sitio, lotes con lease, checkpoint transaccional y reanudación.
- Configuración de solo lectura, POST para ejecutar, historial y snapshots generales separados de reauditorías selectivas.
- Parser HTML, robots, sitemap, enlaces internos, errores explícitos, bytes limitados durante la lectura y pausas/reintentos ante errores transitorios.
- Reglas contextuales, evidencia por URL, agrupación, categorías ponderadas, comparación y excepciones versionadas con vencimiento.
- Descubrimiento y prioridad con datos persistidos de GSC/GA4, con período visible y agregaciones independientes.
- Progreso, ficha de URL, historial navegable, exportación JSON y filtros de páginas guardados en el navegador.
- Crawl incremental opcional con validación condicional HTTP.
- PSI/CrUX separados con caché, consulta automática de la home al terminar el crawl y consulta manual de páginas representativas. Tarea persistida, ejecución con Next.js `after()` y actualización automática de la UI.
- Puntuaciones Lighthouse y Core Web Vitals visibles en Resumen/Rendimiento; falta de muestra CrUX diferenciada de errores de cuota, acceso o conexión.
- Runner Playwright + axe-core, escenarios mobile/desktop, señal de hidratación, capturas, trazas, recorridos, comparación visual y observaciones de paridad entre idiomas.
- Reportes y PNGs de hasta 3 MB por captura en Postgres, con consulta desde Experiencia. Trazas y capturas mayores permanecen en artefactos del runner/CI.
- Workflow manual de CI y pruebas del motor, PostgreSQL, navegador y tablero.

### Decisiones operativas

- El crawler publica su resultado HTML al completar la cola; Playwright adjunta después su evidencia a la misma corrida. La disponibilidad del navegador no bloquea el resultado técnico.
- La coordinación de lotes sigue en el navegador del tablero. Cerrar la pestaña conserva el progreso, pero no crea una ejecución autónoma.
- La comparación visual requiere referencias aprobadas; no se generan referencias automáticamente durante una auditoría normal.
- Los criterios subjetivos de diseño, consistencia con tokens, calidad de textos y conversión siguen requiriendo revisión humana. Los recorridos de envío completo se configuran en un entorno de prueba.
- El rendimiento avanzado por plantilla se consulta de forma selectiva; no se solicita Lighthouse para todas las URLs.
- La detección de soft 404 es heurística y requiere revisión; no reproduce el veredicto de Google. Los duplicados semánticos siguen siendo una ampliación posterior: se detectan duplicados exactos del contenido principal.

### Activación

1. Configurar una base Neon/Postgres de prueba y ejecutar `npm run db:migrate`.
2. Usar `npm run dev:local` para desactivar el proxy a producción y abrir `/auditoria-tecnica`.
3. Iniciar una auditoría; verificar progreso, pausa/reanudación e historial.
4. Instalar Chromium y ejecutar `npm run audit:browser -- --run=ID`.
5. Consultar Experiencia y ejecutar PSI/CrUX desde Rendimiento con las keys configuradas.
6. Aplicar la misma migración y configuración en el entorno de despliegue cuando se publique el cambio.
