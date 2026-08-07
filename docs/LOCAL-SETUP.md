# Configuración local

La aplicación puede consultar Google Analytics 4 y Search Console con una service account local. El archivo JSON de credenciales debe permanecer fuera del repositorio y nunca debe subirse a Git.

## Preparar el entorno

Desde la raíz del proyecto:

```bash
copy .env.example .env.local
```

En PowerShell, el comando equivalente es:

```powershell
Copy-Item .env.example .env.local
```

Edita `.env.local` y cambia `GOOGLE_APPLICATION_CREDENTIALS` por la ruta absoluta real del JSON. No pegues el contenido del JSON en este archivo ni lo guardes dentro del repositorio. Los valores de propiedad y sitio incluidos en `.env.example` son:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:/ruta/al/service-account.json
GA4_PROPERTY_ID=528336901
GSC_SITE_URL=https://www.whalemate.com/
```

La cuenta de servicio necesita acceso de solo lectura a la propiedad GA4 `528336901` y al sitio de Search Console configurado en `GSC_SITE_URL`.

## Instalar y ejecutar

```bash
npm install
npm run dev
```

Con el servidor iniciado, prueba Analytics en `http://localhost:3000/api/integrations/analytics`:

```bash
curl http://localhost:3000/api/integrations/analytics
```

## Filtros y verificación

Los filtros del dashboard se guardan en la URL y se envían a ambas APIs. Ejemplo sin credenciales expuestas:

```text
/api/integrations/search-console?days=7&language=en&country=US&device=mobile&page=%2Fen%2Fservices
/api/integrations/analytics?days=60&language=pt&country=PT&device=desktop
```

`days` acepta `7`, `28`, `60` o `90`; `country` usa códigos ISO de dos letras; `device` acepta `desktop`, `mobile` o `tablet`; `page` y `query` son opcionales para GSC. La comparación usa el período inmediatamente anterior de la misma duración.

El idioma no es una dimensión nativa común a estas APIs: GSC aplica un filtro de URL sobre la dimensión `page` y GA4 sobre `landingPagePlusQueryString` (`/en/`, `/pt/` o una expresión para el idioma raíz ES). País y dispositivo se aplican como dimensiones de Google. La respuesta incluye `metadata.rows`, `metadata.lastResponseAt` y los filtros efectivos; la tarjeta “Cómo verificar datos” los muestra sin exponer credenciales.

Las secciones Indexación avanzada, Keywords, Contenido y Alertas no tienen backend conectado y muestran `No data available`. Auditoría técnica solo muestra resultados reales de sus fuentes.

## Estados de conexión

- `status: "live"`: la API respondió con datos de Google usando las credenciales locales.
- `status: "unavailable"`: faltan variables, permisos o Google devolvió un error. La aplicación devuelve payload vacío y un error no sensible; no sustituye la respuesta con métricas, filas o fechas generadas.
- `status: "no_data"`: la consulta fue válida, pero no devolvió filas.

La auditoría técnica también requiere `SITE_URL`; no existe un dominio predeterminado. PageSpeed y CrUX solo se muestran cuando sus APIs responden. El timestamp de respuesta del endpoint es técnico y no se presenta como fecha de actualización de los datos.

Para comprobar el estado sin conexión, detén el servidor, elimina temporalmente las variables de Google de `.env.local`, vuelve a ejecutar `npm run dev` y repite la petición. `.env.local` está ignorado por Git.
