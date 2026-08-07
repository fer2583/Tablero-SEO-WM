# Tablero SEO WM

Dashboard Next.js para Whalemate. Consulta en modo solo lectura Google Search Console, GA4, PageSpeed, CrUX y el crawler propio. Todas las métricas, filas y fechas proceden de respuestas reales; si una fuente falla o no está configurada, la interfaz queda vacía y muestra su estado.

## Desarrollo

```bash
npm install
npm run dev
```

Consulta [docs/QUICK-CONNECT.md](docs/QUICK-CONNECT.md) para crear la service account, dar permisos, configurar variables locales o Vercel y validar las conexiones.

## Persistencia Fase 1

La persistencia base usa `@vercel/postgres` contra Neon/Vercel Postgres. Agrega `DATABASE_URL` a `.env.local` (o configura `POSTGRES_URL` desde la integración de Vercel). Las credenciales son server-only y nunca deben usar un prefijo `NEXT_PUBLIC_`.

El esquema es idempotente y está versionado en `src/db/schema.sql`. Para inicializar una base de datos local o Neon, ejecuta ese archivo desde el SQL Editor de Neon, Vercel Postgres o `psql` con `DATABASE_URL`. `src/db/migrate.ts` expone `migrate()` para un paso de despliegue controlado; no se ejecuta automáticamente y no debe apuntar a producción sin revisión.

La auditoría técnica está fijada a `https://www.whalemate.com/`. Configura `SITE_URL` con ese valor, además de `PAGESPEED_API_KEY`, `CRUX_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` y `GSC_SITE_URL` cuando correspondan. PageSpeed/Lighthouse mide laboratorio y CrUX mide usuarios reales; la cobertura de schema indica JSON-LD parseable, no validación Rich Results. URL Inspection de GSC se limita a 20 URLs por ejecución y el crawler propio a 50 URLs por request.

## Fase 2: snapshots y refresco

`/api/summary` lee únicamente snapshots de Search Console y GA4. `/api/audit` y `/api/indexation` leen su último snapshot persistido. Un snapshot de más de 24 horas inicia un refresco oportunista protegido por `synchronization`; si ya existe, la respuesta devuelve el snapshot mientras la ejecución continúa. `?refresh=1` fuerza una ejecución, y `action=inspect-priority` fuerza la inspección limitada de Indexación. No hay crons.

La Fase 2 requiere aplicar nuevamente `src/db/schema.sql` en la base destino para crear `indexation_runs` y `source_snapshots`. Sin variables de base de datos, Auditoría e Indexación conservan su fallback live previo; Resumen informa `unavailable` porque no puede leer datos persistidos.

```bash
npm run lint
npm run build
```
