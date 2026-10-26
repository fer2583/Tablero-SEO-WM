# Rediseño de UI - WhaleMate SEO Control Center

**Estado:** Fases 0-5 completadas · **Fecha:** 2026-10-26
**Alcance:** migración de presentación. No se modificaron crawler, persistencia, snapshots ni las APIs de datos (solo se amplió el contrato de Keywords y el formato de Alertas).

---

## 1. Stack visual

| Pieza | Uso |
|---|---|
| Next.js 16 (App Router, Turbopack) | shell, rutas y páginas |
| React 19 | componentes cliente |
| Tailwind CSS v4 (`@tailwindcss/postcss`) | utilidades y tokens |
| Base UI (`@base-ui/react/dialog`) | diálogos y sheets accesibles |
| cmdk | paleta de comandos |
| motion | transiciones del shell |
| Recharts | gráficos de línea, área, barras y scatter |
| TanStack Table v9 + Virtual | grilla de Keywords |
| NumberFlow | números animados en KPIs |
| nuqs | estado de la vista de Keywords en la URL |
| sonner | toasts |

Todo el stack es MIT/Apache-2.0. No hay dependencias de pago.

---

## 2. Tokens y tema

El tema es **oscuro único** y vive en `src/app/globals.css`. Los tokens usan el prefijo `--wm-*` y se exponen a Tailwind mediante `@theme inline` como `--color-*`.

### Superficies y bordes

| Token | Uso |
|---|---|
| `surface-0` | fondo de la app |
| `surface-1` | tarjetas y contenedores |
| `surface-2` | cabeceras de tabla, inputs, bloques internos |
| `surface-3` | hover y elementos activos |
| `surface-4` | realces y track de progreso |
| `edge` / `edge-strong` | bordes normales / bordes en foco |

### Contenido y semántica

- `content`, `content-muted`, `content-faint`: jerarquía de texto.
- `accent`, `accent-strong`, `accent-soft`: acción principal y selección.
- `positive`, `caution`, `negative`: estado con significado (nunca decorativo).
- `chart-1..6`: series de gráficos y leyendas.

### Tipografía

- **Wix Madefor Display** (400/500/600/700) para todo el texto.
- **Mono de sistema** para métricas y URLs, siempre con `.tnum` (`font-variant-numeric: tabular-nums`).
- Formato local `es-ES`: miles con punto, decimales con coma, porcentajes sin espacio antes del `%` en tablas.

---

## 3. Capa de utilidades `.wm-*`

Definidas al final de `globals.css`:

- `.wm-app`: scope visual raíz (fondo, color, selección, scrollbars).
- `.wm-skeleton`: placeholder con shimmer.
- `.wm-rise`: entrada suave de páginas.
- `.wm-drawer`, `.wm-dialog`, `.wm-backdrop`: animaciones de overlays.
- `.wm-row`: hover de filas.
- `.wm-focus-ring`: foco accesible uniforme.
- `.wm-scroll-x`: scroll horizontal contenido.
- `@media (prefers-reduced-motion: reduce)`: desactiva animaciones.

Regla: **no crear nuevas clases globales**. Todo lo nuevo se resuelve con utilidades Tailwind y, si hace falta, una clase `.wm-*`.

---

## 4. Shell

`src/components/dashboard-shell.tsx`:

- Sidebar fija con indicador animado (`motion`), estado de fuentes y bloque Intelligence.
- Topbar sticky con breadcrumb, búsqueda global, densidad, refresh, badge de fuentes y usuario.
- Drawer móvil y paleta de comandos (⌘K / Ctrl+K) con Base UI + cmdk.
- Densidad `comfortable` / `compact` persistida en `localStorage` mediante `useSyncExternalStore` (sin mismatch de hidratación).
- Configuración de fuentes cacheada en `sessionStorage`.
- Filtros globales (período, idioma, país, dispositivo, página, query) en la URL.

---

## 5. Primitivas reutilizables

`src/components/ui/`:

| Componente | Notas |
|---|---|
| `Button` | variantes `primary`, `secondary`, `outline`, `ghost`, `danger`; tamaños `sm`, `md`, `lg`, `icon`, `icon-sm` |
| `Card`, `CardHeader`, `CardBody` | contenedor con borde y sombra sutil |
| `Badge`, `LiveDot` | estados y punto "en vivo" |
| `Progress`, `scoreTone` | barras de progreso y color por score |
| `StatCard` | KPI con delta, barra opcional y detalle |
| `Section` | bloque con título, detalle y acción |
| `Sheet` | panel lateral (modal o no modal) para detalle |
| `DataGrid` | tabla con búsqueda, filtros por columna, orden, paginación y `minWidth` |
| `FilterPill` | select compacto con etiqueta |

Convenciones de `DataGrid`:

- `value` define orden y búsqueda; `render` define el contenido visual.
- `hideBelow` oculta columnas en móvil.
- Las tablas anchas usan scroll horizontal propio; nunca generan overflow de página.

---

## 6. Páginas

| Ruta | Composición |
|---|---|
| `/` | KPIs de salud, GSC/GA4 con deltas, rankings, auditoría y estado de fuentes |
| `/search-console` | tabs Performance/Queries/Geographic/Device/Site URL, serie diaria, heat bars, cards de dispositivo y pantalla completa |
| `/analytics` | 8 vistas, 6 KPIs con deltas, donut por dimensión y serie temporal para vistas de fecha |
| `/auditoria-tecnica` | corrida con progreso y acciones, resumen por categorías, issues, páginas con detalle inline, experiencia, rendimiento, historial y configuración |
| `/keywords` | KPIs con sparkline, tendencia diaria, distribución de posición, scatter de oportunidades, tabs de vista y ficha de evidencia |
| `/contenido` | consultas, oportunidades, páginas con demanda, clusters, señales de cobertura y canibalizaciones |
| `/alertas` | KPIs por severidad, tabs por fuente, filtros y acciones Revisar/Resolver/Reabrir |
| `/configuracion` | estado real de las fuentes y última sincronización |
| `*` | `not-found.tsx` oscuro con regreso al resumen |

Rutas retiradas: `/indexacion` (devuelve 404; la API `/api/indexation` sigue existiendo).

---

## 7. Contratos de datos relevantes

### Keywords (`/api/gsc/keywords`)

Además de `rows`, `winners`, `losers`, `opportunities` y `cannibalization`, la respuesta incluye:

- `totals` y `previous`: clics, impresiones, CTR y posición del período actual y anterior.
- `daily`: serie diaria `{ date, clicks, impressions, ctr, position }`.
- `truncated`: `true` si GSC devolvió el límite de 1.000 filas.
- Por fila: `previousClicks`, `previousPosition`, `clickDelta`, `positionDelta`, `expectedCtr`, `potentialClicks`, `opportunityScore`, `brand`.

La serie diaria y los deltas requieren un deploy del backend; en desarrollo `/api/*` se proxya a `API_PROXY_ORIGIN`.

### Alertas (`/api/alerts`)

Los mensajes de métricas se formatean en el servidor con `maximumFractionDigits` acotado (0 para valores ≥ 100, 2 para el resto).

---

## 8. Reglas de diseño

1. **Color con significado**: verde/amarillo/rojo solo para estado o variación.
2. **Una superficie**: no se anidan tarjetas dentro de tarjetas con sombras nuevas.
3. **Números honestos**: si no hay dato se muestra `—`, nunca `0` inventado.
4. **Densidad**: los KPI y tablas usan padding compacto; el contenido usa `min-w-0` y truncado.
5. **Movimiento**: 120-180 ms, respetando `prefers-reduced-motion`.
6. **Teclado**: ⌘K, `Esc` para cerrar overlays y foco visible en todos los controles.
7. **Sin acciones falsas**: no hay "crear tarea" persistente; sí "Copiar consulta", "Abrir página" y "Abrir en Search Console" cuando corresponde.

---

## 9. Verificación

Antes de deployar:

```bash
npx tsc --noEmit
npm run lint
npm run build
npm test        # 25 tests unitarios
npm run test:ui # E2E desktop + móvil (requiere el server en :3001)
```

El E2E levanta el server con `npm run dev:local -- -p 3001` y cubre auditoría, PageSpeed/CrUX, issues, páginas, detalle de URL y overflow horizontal a 390 px.

---

## 10. Estado del plan

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Tokens, Tailwind, primitivas base | Completada |
| 1 | Shell, sidebar, topbar, ⌘K, densidad | Completada |
| 2 | Keywords (piloto) | Completada |
| 3 | Resumen y Auditoría | Completada |
| 4 | Contenido, Alertas, Configuración, Search Console, Analytics | Completada |
| 5 | Borrado del CSS legacy y código muerto | Completada |

`globals.css` pasó de ~81 KB a ~5 KB. Se eliminaron `ui.tsx`, `data-table.tsx` e `indexation-panel.tsx`.

Pendientes funcionales fuera del rediseño: métricas de negocio reales (acciones del mes), volumen/dificultad de keywords y clustering avanzado.
