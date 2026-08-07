# Tablero SEO WM

Dashboard Next.js para Whalemate. Consulta en modo solo lectura Google Search Console, GA4, PageSpeed, CrUX y el crawler propio. Todas las métricas, filas y fechas proceden de respuestas reales; si una fuente falla o no está configurada, la interfaz queda vacía y muestra su estado.

## Desarrollo

```bash
npm install
npm run dev
```

Consulta [docs/QUICK-CONNECT.md](docs/QUICK-CONNECT.md) para crear la service account, dar permisos, configurar variables locales o Vercel y validar las conexiones.

La auditoría técnica está fijada a `https://www.whalemate.com/`. Configura `SITE_URL` con ese valor, además de `PAGESPEED_API_KEY`, `CRUX_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` y `GSC_SITE_URL` cuando correspondan. PageSpeed/Lighthouse mide laboratorio y CrUX mide usuarios reales; la cobertura de schema indica JSON-LD parseable, no validación Rich Results. URL Inspection de GSC se limita a 20 URLs por ejecución y el crawler propio a 50 URLs por request.

```bash
npm run lint
npm run build
```
