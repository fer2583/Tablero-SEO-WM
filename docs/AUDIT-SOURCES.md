# Auditoría: fuentes y configuración

La sección Auditoría está fijada exclusivamente a `https://www.whalemate.com/`. El endpoint ignora cualquier URL recibida por query string y no funciona como proxy abierto.

- **PageSpeed Insights (PSI):** Lighthouse de laboratorio para una URL individual. Incluye Performance, SEO, Accessibility, Best Practices, LCP, CLS, INP cuando Lighthouse lo devuelve, TBT y opportunities/diagnostics. Es una fotografía controlada, no una distribución de usuarios.
- **Chrome UX Report (CrUX):** datos reales agregados de usuarios. Consulta LCP, INP, CLS, FCP y TTFB por URL (o por origin para la home) y por mobile/desktop. Puede devolver `Unavailable` cuando no existe suficiente volumen.
- **Auditor propio:** obtiene el sitemap real, respeta `robots.txt`, bloquea destinos privados, limita el body, timeouts, redirecciones y crawl a 50 URLs por request con concurrencia 4. Revisa HTTP, metadatos, headings, canonical, robots meta, Open Graph, JSON-LD parseable, enlaces internos y ALT.
- **Search Console:** URL Inspection está limitada a 20 URLs por ejecución para respetar cuota. El estado `partial` es válido y no se convierte en números estimados.

## Habilitar APIs

Configura estas variables en el servidor (Vercel, hosting o `.env.local`). No se incluyen valores en el repositorio ni se envían al navegador:

```env
SITE_URL=https://www.whalemate.com/
PAGESPEED_API_KEY=
CRUX_API_KEY=
GSC_SITE_URL=https://www.whalemate.com/
GOOGLE_SERVICE_ACCOUNT_JSON=
```

1. En Google Cloud habilita **PageSpeed Insights API** y crea una API key restringida a esa API para `PAGESPEED_API_KEY`.
2. Habilita **Chrome UX Report API** y crea una API key para `CRUX_API_KEY`. CrUX requiere key en este módulo.
3. Reinicia el servidor después de cambiar variables y abre `/auditoria-tecnica`.

Sin una key, la fuente aparece como `Unavailable` con instrucciones. El auditor propio no necesita Google Cloud. Las ejecuciones se guardan únicamente en el historial local del navegador.

## Endpoints

- `GET /api/audit`

El endpoint devuelve PageSpeed y CrUX para mobile y desktop, sitemap/crawl/schema e indexación GSC. Las claves nunca se incluyen en la respuesta. Lighthouse es laboratorio; CrUX son datos agregados de usuarios reales. `JSON-LD parseable` solo confirma que el JSON se pudo analizar sintácticamente, no que Google lo valide como Rich Result. Sin una API configurada, la UI muestra `Unavailable`/`No data`.
