# Conectar Google Search Console y GA4

La integración es de solo lectura y está pensada para una demo single-site. Usa una service account en el servidor; las credenciales nunca llegan al navegador. Más adelante se debe migrar a OAuth para soportar múltiples usuarios y propiedades.

## 1. Crear la service account

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) y crea o selecciona un proyecto.
2. En **IAM y administración > Cuentas de servicio**, crea una cuenta de servicio.
3. Copia su email, por ejemplo `seo-demo@mi-proyecto.iam.gserviceaccount.com`.
4. En **Claves > Agregar clave > Crear clave nueva**, selecciona JSON y descarga la clave fuera del repositorio.

No uses archivos de credenciales del proyecto HitOcean ni subas el JSON a Git.

## 2. Habilitar APIs

En **APIs y servicios > Biblioteca**, habilita:

- Google Search Console API
- Google Analytics Data API

## 3. Dar acceso de solo lectura

- Search Console: abre `https://search.google.com/search-console`, selecciona `https://www.whalemate.com` y añade el email de la service account como usuario **Restringido**.
- GA4: abre **Administrador > Cuenta/Propiedad > Gestión de accesos**, añade el email como **Viewer** (o **Analyst** si la propiedad lo requiere). Copia el ID numérico de la propiedad, no el ID de medición `G-...`.

## 4. Configurar variables

Crea `.env.local` (está ignorado por Git):

```env
GSC_SITE_URL=https://www.whalemate.com
GA4_PROPERTY_ID=123456789
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"..."}
```

Para desarrollo local también puedes omitir `GOOGLE_SERVICE_ACCOUNT_JSON` y usar `GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\segura\service-account.json`. En Vercel configura las tres primeras variables en **Project Settings > Environment Variables**; pega el JSON como valor secreto y no configures `GOOGLE_APPLICATION_CREDENTIALS` allí.

## 5. Ejecutar y validar

```bash
npm install
npm run dev
```

Comprueba `http://localhost:3000/api/integrations/search-console` y `http://localhost:3000/api/integrations/analytics`. La respuesta incluye `status: "live"` o `status: "fallback"`. En la interfaz, Resumen, Search Console y Analytics muestran el estado correspondiente. Sin variables, sin permisos o ante un error de Google, se mantienen los datos mock y se muestra el error accionable.

Las ventanas son los últimos 28 días completos y los 28 días inmediatamente anteriores. Los endpoints son `GET` y no aceptan credenciales desde el cliente.
