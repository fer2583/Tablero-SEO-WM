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

El esquema es idempotente y está versionado en `src/db/schema.sql`. Para inicializar una base de datos local o Neon, usar `npm run db:migrate` con `DATABASE_URL`. En Vercel, `vercel.json` aplica la migración transaccional antes de compilar usando las variables del entorno de destino. `next build` por sí solo no modifica la base.

La auditoría técnica está fijada a `https://www.whalemate.com/`. PageSpeed/Lighthouse mide laboratorio y CrUX mide usuarios reales; JSON-LD no implica validación Rich Results. URL Inspection de GSC conserva su límite propio. El crawler trabaja por lotes reanudables, con 2000 URLs como límite configurable predeterminado y una capa Playwright + axe-core separada.

## Crawler y auditoría renderizada

Aplicar la migración aditiva con `npm run db:migrate` sobre la base de destino. Para desarrollar sin el proxy de API a producción, usar `npm run dev:local`.

```bash
npm run audit:report -- --limit=10
npx playwright install chromium
npm run audit:browser -- --run=123
npm test
```

Guía de operación y API: [docs/AUDIT-SOURCES.md](docs/AUDIT-SOURCES.md). Diseño: [docs/crawler-auditor.md](docs/crawler-auditor.md). Los reportes sin `--run` no escriben en Postgres.

## Fase 2: snapshots y refresco

`/api/summary` lee snapshots persistidos de Search Console y GA4. Si falta un snapshot o tiene más de 24 horas, inicia una ingesta oportunista protegida por `synchronization` y devuelve el último dato disponible mientras continúa; los estados de GSC y GA4 son independientes. La acción manual del Resumen llama a `POST /api/ingest?sources=gsc,ga4&refresh=1`; `GET /api/ingest` nunca consulta APIs externas. No hay crons.

La persistencia requiere aplicar `src/db/schema.sql` en la base destino. Sin variables de base de datos, Auditoría y Resumen informan `unavailable`; el crawler se puede verificar por CLI sin persistencia.

```bash
npm run lint
npm run build
```
