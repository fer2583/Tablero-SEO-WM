"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { MentionCheckSheet } from "./mention-check-sheet";
import { PROMPT_INTENTS, type AiPromptRecord, type MentionsPayload } from "@/lib/ai-mentions-types";
import { cn } from "@/lib/utils";

const SUGGESTED = [
  { prompt: "¿Qué empresas ofrecen human risk management en Latinoamérica?", intent: "comparación" },
  { prompt: "Mejores plataformas de concientización y simulación de phishing en español", intent: "comparación" },
  { prompt: "¿Cómo reducir el riesgo humano en ciberseguridad?", intent: "problema" },
  { prompt: "Alternativas a KnowBe4 en español", intent: "comparación" },
  { prompt: "¿Qué es el human risk score y cómo se calcula?", intent: "general" },
  { prompt: "Proveedores de entrenamiento adaptativo en ciberseguridad", intent: "comparación" },
  { prompt: "¿Whalemate es una buena plataforma de human risk management?", intent: "marca" },
];

const when = (value: string) => new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
const pct = (value: number) => `${(value * 100).toFixed(0)}%`;

const inputClass = "wm-focus-ring h-8 rounded-lg border border-edge bg-surface-1 px-2 text-[11.5px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none";

export function AiMentionsView() {
  const [payload, setPayload] = useState<MentionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [intent, setIntent] = useState<string>("general");
  const [language, setLanguage] = useState("es");
  const [selected, setSelected] = useState<AiPromptRecord | null>(null);

  const load = async () => {
    try {
      const response = await fetch("/api/ai-mentions", { cache: "no-store" });
      setPayload((await response.json()) as MentionsPayload);
    } catch {
      setPayload({
        status: "unavailable",
        prompts: [],
        checks: [],
        summary: { prompts: 0, checked: 0, mentioned: 0, visibility: 0, averageRank: null, platforms: [], lastCheckedAt: null },
        error: "No se pudo consultar el registro de menciones.",
        generatedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const active = useMemo(() => (payload?.prompts ?? []).filter((prompt) => prompt.status === "active"), [payload]);
  const latest = useMemo(() => {
    const map = new Map<number, MentionsPayload["checks"][number]>();
    for (const check of payload?.checks ?? []) if (!map.has(check.promptId)) map.set(check.promptId, check);
    return map;
  }, [payload]);

  const addPrompt = async (text: string, nextIntent = intent, nextLanguage = language) => {
    if (busy) return false;
    setBusy(true);
    try {
      const response = await fetch("/api/ai-prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: text, intent: nextIntent, language: nextLanguage }) });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo crear el prompt.");
      setPromptInput("");
      await load();
      return true;
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "No se pudo crear el prompt.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const seed = async () => {
    if (busy) return;
    setBusy(true);
    let added = 0;
    try {
      for (const item of SUGGESTED) {
        const response = await fetch("/api/ai-prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...item, language: "es" }) });
        if (response.ok) added += 1;
      }
      await load();
      toast.success(`${added} prompts sugeridos cargados`);
    } finally {
      setBusy(false);
    }
  };

  const archive = async (prompt: AiPromptRecord) => {
    if (!window.confirm("¿Archivar este prompt? Dejará de aparecer en la lista activa.")) return;
    const response = await fetch(`/api/ai-prompts?id=${prompt.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("No se pudo archivar el prompt.");
      return;
    }
    await load();
    toast.success("Prompt archivado");
  };

  const removeCheck = async (id: number) => {
    if (!window.confirm("¿Eliminar este chequeo del historial?")) return;
    const response = await fetch(`/api/ai-mentions?id=${id}`, { method: "DELETE" });
    const body = (await response.json()) as MentionsPayload & { error?: string };
    if (!response.ok) {
      toast.error(body.error ?? "No se pudo eliminar el chequeo.");
      return;
    }
    setPayload(body);
    toast.success("Chequeo eliminado");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="wm-skeleton h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="wm-skeleton h-[240px] rounded-xl" />
      </div>
    );
  }

  if (!payload || payload.status === "unavailable") {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
        <CircleAlert className="size-6 text-content-faint" />
        <p className="mt-3 text-[13px] font-medium text-content">El registro de menciones no está disponible</p>
        <p className="mx-auto mt-1 max-w-lg text-[11.5px] leading-relaxed text-content-faint">{payload?.error ?? "No se pudo leer la base de datos."}</p>
        <code className="mt-3 rounded-md border border-edge bg-surface-2 px-2 py-1 font-mono text-[10.5px] text-content-muted">npm run db:migrate</code>
      </div>
    );
  }

  const summary = payload.summary;
  const coverage = summary.prompts ? summary.checked / summary.prompts : 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Prompts activos" value={summary.prompts} icon={<Sparkles className="size-3.5" />} detail={`${summary.checked} con chequeo registrado`} />
        <StatCard label="Cobertura" value={pct(coverage)} bar={coverage * 100} tone={coverage >= 0.8 ? "positive" : "caution"} detail={`${summary.checked} de ${summary.prompts} prompts`} />
        <StatCard
          label="Visibilidad de marca"
          value={pct(summary.visibility)}
          bar={summary.visibility * 100}
          tone={summary.visibility >= 0.5 ? "positive" : summary.visibility > 0 ? "caution" : "negative"}
          detail={`${summary.mentioned} chequeos mencionan a Whalemate`}
        />
        <StatCard label="Ranking medio" value={summary.averageRank == null ? "—" : summary.averageRank.toFixed(1).replace(".", ",")} detail={summary.lastCheckedAt ? `Último chequeo: ${when(summary.lastCheckedAt)}` : "Sin chequeos"} />
      </div>

      {summary.platforms.length ? (
        <Section title="Visibilidad por plataforma" detail="Porcentaje de chequeos donde la marca fue mencionada.">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {summary.platforms.map((platform) => (
              <div key={platform.platform} className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11.5px] font-medium text-content">{platform.platform}</p>
                  <span className="font-mono text-[11px] tabular-nums text-content-muted">{pct(platform.visibility)}</span>
                </div>
                <Progress className="mt-1.5" value={platform.visibility * 100} tone={platform.visibility >= 0.5 ? "positive" : "caution"} label={platform.platform} />
                <p className="mt-1.5 text-[10px] text-content-faint">
                  {platform.mentioned} de {platform.checks} chequeos mencionan la marca
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title={`Prompts · ${active.length} activos`}
        detail="Librería de consultas para medir menciones en asistentes de IA. El chequeo es manual y sin costo."
        action={<Badge tone="neutral">Manual · $0</Badge>}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={promptInput}
            onChange={(event) => setPromptInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && promptInput.trim().length >= 5) void addPrompt(promptInput.trim());
            }}
            placeholder="Nuevo prompt (ej. mejores plataformas de human risk management)"
            aria-label="Nuevo prompt"
            className={cn(inputClass, "min-w-[220px] flex-1")}
          />
          <select value={intent} onChange={(event) => setIntent(event.target.value)} aria-label="Intención del prompt" className={inputClass}>
            {PROMPT_INTENTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Idioma del prompt" className={inputClass}>
            <option value="es">ES</option>
            <option value="en">EN</option>
            <option value="pt">PT</option>
          </select>
          <Button variant="secondary" size="sm" className="gap-1.5" disabled={busy || promptInput.trim().length < 5} onClick={() => void addPrompt(promptInput.trim())}>
            <Plus className="size-3.5" /> Agregar
          </Button>
        </div>

        {active.length ? (
          <ul className="mt-2 space-y-1.5">
            {active.map((prompt) => {
              const last = latest.get(prompt.id);
              return (
                <li key={prompt.id} className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-medium leading-relaxed text-content">{prompt.prompt}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral">{prompt.intent}</Badge>
                        <Badge tone="neutral">{prompt.language.toUpperCase()}</Badge>
                        {last ? (
                          <>
                            <Badge tone={last.mentioned ? "positive" : "negative"}>
                              {last.mentioned ? <Check className="size-2.5" /> : null}
                              {last.mentioned ? `Mencionada${last.brandRank ? ` #${last.brandRank}` : ""}` : "No mencionada"}
                            </Badge>
                            <span className="text-[9.5px] text-content-faint">
                              {last.platform} · {when(last.checkedAt)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[9.5px] text-content-faint">Sin chequeos todavía</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setSelected(prompt)}>
                        Registrar chequeo
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void archive(prompt)} aria-label={`Archivar ${prompt.prompt}`}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-2 grid place-items-center rounded-lg border border-dashed border-edge/70 px-4 py-8 text-center">
            <Sparkles className="size-5 text-content-faint" />
            <p className="mt-2 text-[12px] font-medium text-content">Todavía no hay prompts</p>
            <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-content-faint">
              Cargá los prompts sugeridos para Whalemate y medí visibilidad en ChatGPT, Perplexity, Gemini, Copilot y Claude.
            </p>
            <Button variant="primary" size="sm" className="mt-3" disabled={busy} onClick={() => void seed()}>
              {busy ? "Cargando…" : `Cargar ${SUGGESTED.length} prompts sugeridos`}
            </Button>
          </div>
        )}
      </Section>

      <Section title="Historial de chequeos" detail="Los últimos 20 registros del período. Cada chequeo conserva evidencia y fuentes citadas.">
        {payload.checks.length ? (
          <ul className="space-y-1">
            {payload.checks.slice(0, 20).map((check) => (
              <li key={check.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-2/40 px-2.5 py-1.5">
                <Badge tone={check.mentioned ? "positive" : "negative"}>{check.mentioned ? "Mencionada" : "No"}</Badge>
                <span className="min-w-0 flex-1 truncate text-[11px] text-content" title={check.prompt}>
                  {check.prompt}
                </span>
                <span className="text-[9.5px] text-content-faint">
                  {check.platform} · {when(check.checkedAt)}
                </span>
                {check.citationUrl ? (
                  <a href={check.citationUrl} target="_blank" rel="noreferrer" className="text-[9.5px] text-accent hover:underline">
                    Cita
                  </a>
                ) : null}
                <button type="button" onClick={() => void removeCheck(check.id)} aria-label="Eliminar chequeo" className="wm-focus-ring rounded p-1 text-content-faint hover:text-negative">
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 py-6 text-center text-[11px] text-content-faint">Todavía no hay chequeos. Registrá el primero desde un prompt.</p>
        )}
      </Section>

      <div className="rounded-xl border border-edge bg-surface-1 px-3 py-2.5">
        <p className="text-[10.5px] leading-relaxed text-content-faint">
          <strong className="text-content-muted">Menciones manuales, costo cero.</strong> No se consultan APIs de pago ni se scrapean asistentes. Para Google AI Overviews usá la plataforma
          &quot;Google AI Overviews&quot; y registrá la cita con evidencia. La automatización con APIs (Gemini free tier, Perplexity, OpenAI, Anthropic) queda como fase opcional BYOK.
        </p>
      </div>

      <MentionCheckSheet key={selected?.id ?? "none"} prompt={selected} onClose={() => setSelected(null)} onSaved={(next) => setPayload(next)} />
    </div>
  );
}
