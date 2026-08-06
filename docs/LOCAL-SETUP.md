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

## Live y Demo fallback

- `status: "live"`: la API respondió con datos de Google usando las credenciales locales.
- `status: "fallback"`: faltan variables, el JSON no es accesible, faltan permisos o Google devolvió un error. La aplicación conserva los datos demo y devuelve el error para facilitar el diagnóstico.

Para comprobar el fallback, detén el servidor, elimina temporalmente las variables de Google de `.env.local`, vuelve a ejecutar `npm run dev` y repite la petición. `.env.local` está ignorado por Git.
