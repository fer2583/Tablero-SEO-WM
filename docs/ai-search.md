# AI Search e Intelligence

**Estado:** implementado y desplegado · **Fecha:** 2026-10-26
**Costo:** $0. No se usan APIs de IA pagas ni scraping de asistentes.

---

## 1. Qué incluye

### `/ai-search` - Tráfico IA
- Consulta GA4 en vivo con filtro `sessionSource` contra asistentes: ChatGPT/OpenAI, Perplexity, Gemini, Copilot, Claude, DeepSeek, You, Phind, Poe.
- KPIs: sesiones, share sobre el total, usuarios, conversiones e interacción, con comparación contra el período anterior.
- Serie diaria, split por plataforma, tabla de orígenes (`source / medium`) y landing pages.
- Filtros de período, idioma, país y dispositivo.
- Endpoint: `GET /api/ai-search?days=&language=&country=&device=` (`src/lib/ai-search.ts`).

**Límite honesto:** es una métrica derivada de GA4. No incluye citas en Google AI Overviews, porque no generan referrer.

### `/ai-search` - Menciones IA (manual)
- Librería de prompts (`ai_prompts`) y chequeos (`ai_mention_checks`).
- Cada chequeo registra: plataforma, fecha, mencionado sí/no, posición de marca, URL citada, fuentes, extracto, evidencia y notas.
- Score: prompts activos, cobertura, visibilidad de marca (% de prompts con mención), ranking medio y visibilidad por plataforma.
- Prompts sugeridos para Whalemate (7) cargados en producción.
- Endpoints:
  - `GET/POST/DELETE /api/ai-prompts`
  - `GET/POST/DELETE /api/ai-mentions`

### `/intelligence` - Señales priorizadas
- Reemplaza el antiguo botón "próximo módulo".
- Combina keywords, auditoría, alertas, tráfico IA y menciones IA en señales con scoring determinístico.
- Foco de la semana (top 3), grupos por categoría, brief copiable y estado de fuentes.
- Endpoint: `GET /api/intelligence?days=&language=&country=&device=` (`src/lib/intelligence.ts`).

**Scoring:** `score = impacto × peso_confianza × peso_esfuerzo`.

| Factor | Valores |
|---|---|
| Confianza | alta 1.0 · media 0.7 · baja 0.4 |
| Esfuerzo | bajo 1.0 · medio 0.7 · alto 0.45 |

No usa LLM: los umbrales y el brief se generan con reglas explícitas.

---

## 2. Base de datos

Tablas aditivas (`src/db/schema.sql`):

```sql
ai_prompts(id, site_url, prompt, intent, language, status, created_at, updated_at)
ai_mention_checks(id, prompt_id, platform, checked_at, mentioned, brand_rank,
                  citation_url, sources JSONB, excerpt, evidence_url, notes)
```

Las tablas se crean de forma idempotente en el primer uso (`src/db/ai-mentions.ts`) porque los secretos de producción son write-only y la migración no siempre se puede correr desde una estación. También se pueden crear con `npm run db:migrate`.

---

## 3. Flujo semanal recomendado

1. Abrir `/ai-search` → pestaña **Menciones IA**.
2. Elegir un prompt y abrir la plataforma (ChatGPT, Perplexity, Gemini, Copilot, Claude o AI Overviews).
3. Registrar si Whalemate aparece, en qué posición y con qué cita/fuentes.
4. Repetir 1-2 veces por semana. El score y `/intelligence` se actualizan solos.

---

## 4. Qué quedó pendiente (y por qué)

| Pendiente | Motivo |
|---|---|
| Chequeo automático de menciones | Requiere API key de pago (OpenAI, Perplexity, Anthropic) o Gemini free tier con key y cuotas. No hay key configurada. |
| Citas en Google AI Overviews | No existe API gratuita; requiere SERP API de pago o registro manual (ya soportado con la plataforma "Google AI Overviews"). |
| Histórico propio de tráfico IA | Hoy se consulta GA4 en vivo. Persistir una tabla diaria de IA permitiría series más largas que la retención de GA4. |
| Alertas automáticas de IA | Las señales de caída de tráfico y visibilidad ya alimentan `/intelligence`; todavía no generan alertas en el motor de `/alertas`. |
| Share of voice vs. competidores | El modelo actual mide presencia de Whalemate, no cuota frente a competidores. Se puede agregar con chequeos multi-marca. |
| Brief generado por LLM | Se evitó a propósito para mantener costo cero y resultados auditables. |

---

## 5. Variables de entorno

- `GA4_PROPERTY_ID` y credenciales de Google: necesarias para el tráfico IA.
- `DATABASE_URL` (o `POSTGRES_URL`): necesaria para menciones manuales.
- No se agregaron claves de IA.
