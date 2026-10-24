# Auditoría: fuentes, ejecución y configuración

La auditoría está fijada a `https://www.whalemate.com/`. No acepta dominios arbitrarios. Diseño y criterios: [crawler-auditor.md](crawler-auditor.md).

## Fuentes independientes

- **Crawler HTTP/HTML:** sitemap y descubrimiento de enlaces, parser Cheerio, robots.txt, reglas contextuales, historial en Postgres y lotes reanudables. Predeterminado: 2000 URLs, 25 por lote, concurrencia 4. No hay corte oculto a 20/50 páginas.
- **Playwright + axe-core:** runner Node local/CI. Selecciona hasta 30 escenarios por plantilla, idioma y viewport. Comprueba renderizado, responsive, accesibilidad automática y recorridos observacionales. La falta de un reporte de navegador no bloquea la publicación del crawl HTML.
- **PageSpeed Insights:** Lighthouse de laboratorio por URL/dispositivo. La home se consulta automáticamente en mobile y desktop cuando termina el crawl general. Sus puntuaciones Performance, Accesibilidad, Buenas prácticas y SEO se muestran en Resumen y Rendimiento, junto con LCP, CLS, FCP y TBT; TBT no se presenta como INP. Caché de 24 h para éxitos y 5 min para respuestas no disponibles.
- **CrUX:** p75 de campo agregado por origen y dispositivo, incluyendo su período de colección. Sin volumen suficiente se muestra sin datos. No se atribuyen los datos del origen a cada URL.
- **Search Console:** se reutiliza la muestra persistida de URL Inspection; no se inspecciona todo el sitio en cada crawl.
- **GSC/GA4:** las URLs y las métricas de los últimos 30 días persistidos enriquecen descubrimiento/prioridad. Cada fuente se agrega por separado antes del join. Los usuarios diarios sumados de GA4 no representan usuarios únicos del período.

La salud técnica es una métrica interna ponderada por regla y páginas evaluables, con cobertura separada. No predice posiciones. Las observaciones heurísticas no descuentan puntos. JSON-LD presente/parseable no equivale a elegibilidad para Rich Results.

## Preparación

Configurar una base Neon/Vercel Postgres de prueba en `.env.local`:

```env
DATABASE_URL=postgres://...
AUDIT_CRAWL_LIMIT=2000
AUDIT_BATCH_SIZE=25
AUDIT_CONCURRENCY=4
AUDIT_QUERY_LIMIT=100
AUDIT_MAX_DEPTH=10
AUDIT_INCREMENTAL=false
PAGESPEED_API_KEY=
CRUX_API_KEY=
```

```bash
npm install
npm run db:migrate
npm run dev:local
```

`db:migrate` aplica `src/db/schema.sql` en una transacción. Es aditivo e idempotente y conserva snapshots anteriores. `vercel.json` lo ejecuta antes del build durante un despliegue en Vercel, usando las variables del entorno de destino. El comando local `next build` por sí solo no ejecuta migraciones.

Para publicar en la URL en vivo con la sesión de Vercel del proyecto:

```bash
vercel --prod --yes
```

El despliegue aplica el esquema y compila antes de promover el dominio de producción. `.vercelignore` excluye credenciales locales y artefactos; el proxy de desarrollo está desactivado dentro de Vercel.

`dev:local` desactiva el rewrite de `/api/*` a producción para que se prueben las rutas nuevas. `npm run dev` conserva la configuración normal de `API_PROXY_ORIGIN`. También se puede usar `API_PROXY_DISABLED=true` en el entorno.

## API y operación

| Método y ruta | Función |
|---|---|
| `GET /api/audit` | Último snapshot general publicado, corrida activa e historial; sin rastrear |
| `POST /api/audit/runs` | Crear/reutilizar corrida activa; body opcional `{ "maxUrls": 2000 }` |
| `POST /api/audit/runs` con `{ "urls": ["https://www.whalemate.com/..."] }` | Reauditoría selectiva de hasta 100 URLs; no reemplaza la salud general |
| `GET /api/audit/runs/:id` | Progreso, configuración, snapshot y reportes del navegador |
| `POST /api/audit/runs/:id/process` | Procesar un lote con lease de 120 s y presupuesto de trabajo de 50 s |
| `POST /api/audit/runs/:id/actions` | `{ "action": "pause" \| "resume" \| "cancel" }` |
| `GET /api/audit/runs/:id/pages`, `/issues`, `/links` | Listado con `offset`, `limit` (máximo 100) y `q` |
| `POST /api/audit/runs/:id/enrich` | Programar PSI/CrUX por URL de la corrida; devuelve 202 con tarea persistida; body `{ "url": "https://www.whalemate.com/", "force": false }`. `force: true` repite sin caché |
| `GET /api/audit/runs/:id/evidence?report=UUID&name=FILE.png` | Captura persistida de ese reporte/corrida |
| `GET /api/configuration` | Estado/configuración persistida; no ejecuta Google, crawler, PSI ni CrUX |

El navegador coordina los lotes. Cerrar el tablero conserva el progreso, pero no programa ejecución autónoma. Al volver, las corridas activas se recuperan; las pausadas requieren reanudar. Los 429/503 y errores de red transitorios tienen reintentos acotados y pausa con fecha; se respeta `Retry-After`.

Un lote en curso no se cancela a mitad de persistencia: la UI aplica la pausa/cancelación al finalizar. Un lease vencido permite recuperar la corrida; un proceso antiguo no puede sobrescribir al nuevo propietario.

### PageSpeed y Core Web Vitals

Al completar un crawl general, se reserva automáticamente una tarea de rendimiento para la home. Next.js `after()` ejecuta PSI/CrUX después de devolver la respuesta del crawler, con un lease de 180 segundos y el `maxDuration` de la ruta. El tablero consulta el estado mientras la tarea está activa y muestra los resultados sin recargar. Las reauditorías selectivas no lanzan esta consulta automáticamente.

En Rendimiento se puede consultar otra URL representativa o usar **Repetir tests sin caché**. Ambos dispositivos se procesan juntos. Si el proceso se interrumpe, la tarea vencida se muestra como interrumpida y admite reintento.

CrUX 404 se muestra como **Google no tiene datos de campo suficientes**, separado de un fallo de la API. Errores de acceso, cuota, timeout o respuestas inválidas se identifican explícitamente sin exponer claves ni cuerpos de error de Google. La falta de CrUX no impide medir Lighthouse y no se sustituye con datos de laboratorio.

## Reglas y crawl incremental

`audit.rules.config.ts` contiene versión, umbrales, reglas deshabilitadas y excepciones justificadas con vencimiento. La configuración queda congelada en cada corrida. Las excepciones no se cuentan como evaluaciones aprobadas. Aumentar la versión al cambiar criterios o semántica.

`AUDIT_INCREMENTAL=true` reutiliza resultados HTML de la última corrida general únicamente si el servidor confirma un 304 mediante ETag/Last-Modified. Sin validadores se vuelve a descargar. La opción está desactivada por defecto; las reglas entre páginas vuelven a evaluarse.

## Playwright

```bash
npx playwright install chromium
npm run audit:browser -- --run=123
```

Requiere una corrida v2 completada y DATABASE_URL. Guarda reporte y PNGs de hasta 3 MB por captura en Postgres; se pueden abrir desde la pestaña Experiencia. Trazas, capturas mayores y reporte completo quedan en `.audit-artifacts/browser/TIMESTAMP/`. No se versionan artefactos.

Sin base de datos:

```bash
npm run audit:report -- --limit=10
npm run audit:browser -- --input=.audit-artifacts/dry-run/report.json
npm run audit:browser -- --url=https://www.whalemate.com/
```

Los modos sin `--run` guardan resultados solo en disco. `audit:report` no consume Google ni persiste en la base.

`audit.browser.config.ts` define selectores, criterios, máscara visual, señal de hidratación y recorridos. Incluye menú mobile, teclado, CTA hacia contacto y cambio de la home ES→EN. La señal de hidratación evita interpretar un botón todavía no inicializado como una interacción rota. Actualizar selectores y versión cuando cambie el sitio.

El runner bloquea solicitudes no GET/HEAD y navegación fuera del origen. No envía formularios comerciales. Una prueba de envío y éxito requiere un entorno/recorrido de prueba específico. Las diferencias de CTA entre plantillas/idiomas son observaciones, no prueba automática de una traducción incorrecta.

Referencias visuales aprobadas explícitamente:

```bash
npm run audit:browser -- --url=https://www.whalemate.com/ --approve-baseline=.audit-artifacts/baseline
npm run audit:browser -- --url=https://www.whalemate.com/ --baseline=.audit-artifacts/baseline
```

Las diferencias son hallazgos para revisión, no errores automáticos. Mantener la misma versión de Chromium y criterios para comparar referencias. No se aprueban referencias con escenarios incompletos.

El workflow manual `.github/workflows/browser-audit.yml` recibe `run_id`, usa el secret `AUDIT_DATABASE_URL`, instala Chromium, persiste resultados y publica artefactos durante 14 días. No se ejecuta ni despliega automáticamente.

## Verificación

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`npm test` usa PostgreSQL aislado en proceso (PGlite), fixtures del crawler y Chromium contra un servidor local de prueba. No modifica producción.

Para probar el tablero, iniciar la aplicación en el puerto 3001 (`npm run dev:local -- --port 3001` o `npm start -- --port 3001`) y ejecutar `npm run test:ui`. La prueba intercepta las APIs y verifica iniciar/pausar/reanudar, incidencias, detalle de URL y viewport mobile. `AUDIT_UI_URL` permite otro origen local.
