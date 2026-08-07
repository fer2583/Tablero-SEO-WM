# Auditoría: fuentes y configuración

La sección Auditoría separa tres fuentes y no usa Search Console para PageSpeed:

- **PageSpeed Insights (PSI):** Lighthouse de laboratorio para una URL individual. Incluye Performance, SEO, Accessibility, Best Practices, LCP, CLS, INP cuando Lighthouse lo devuelve, TBT y opportunities/diagnostics. Es una fotografía controlada, no una distribución de usuarios.
- **Chrome UX Report (CrUX):** datos reales agregados de usuarios. Consulta LCP, INP, CLS, FCP y TTFB por URL (o por origin para la home) y por mobile/desktop. Puede devolver `Unavailable` cuando no existe suficiente volumen.
- **Auditor propio:** descarga una única URL server-side y revisa HTTP, metadatos, headings, canonical, robots meta, Open Graph, JSON-LD, enlaces internos, ALT, redirects, sitemap y robots.txt. Respeta robots.txt, valida el hostname de `SITE_URL`, bloquea destinos privados, limita el body, timeouts y redirecciones. No afirma huérfanas, profundidad o duplicados: se muestran como `unavailable / not collected` porque todavía no hay crawler completo.

## Habilitar APIs

Configura estas variables en el servidor (Vercel, hosting o `.env.local`). No se incluyen valores en el repositorio ni se envían al navegador:

```env
SITE_URL=https://tu-hostname-configurado.example/
PAGESPEED_API_KEY=
CRUX_API_KEY=
```

1. En Google Cloud habilita **PageSpeed Insights API** y crea una API key restringida a esa API para `PAGESPEED_API_KEY`.
2. Habilita **Chrome UX Report API** y crea una API key para `CRUX_API_KEY`. CrUX requiere key en este módulo.
3. Reinicia el servidor después de cambiar variables y abre `/auditoria-tecnica`.

Sin una key, la fuente aparece como `Unavailable` con instrucciones. El auditor propio no necesita Google Cloud. Las ejecuciones se guardan únicamente en el historial local del navegador.

## Endpoints

- `GET /api/audit?url=https%3A%2F%2Fwww.whalemate.com%2F&device=mobile`

El endpoint devuelve los tres resultados juntos con `sources` independientes. Solo acepta URLs del hostname de `SITE_URL`; no es un crawler ni un proxy abierto.
