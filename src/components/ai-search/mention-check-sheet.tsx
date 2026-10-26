"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MENTION_PLATFORMS, type AiPromptRecord, type MentionsPayload } from "@/lib/ai-mentions-types";

const today = () => new Date().toISOString().slice(0, 10);

const inputClass = "wm-focus-ring h-8 w-full rounded-lg border border-edge bg-surface-1 px-2 text-[11.5px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none";
const labelClass = "text-[9.5px] uppercase tracking-[0.07em] text-content-faint";

export function MentionCheckSheet({ prompt, onClose, onSaved }: { prompt: AiPromptRecord | null; onClose: () => void; onSaved: (payload: MentionsPayload) => void }) {
  const [platform, setPlatform] = useState<string>("ChatGPT");
  const [date, setDate] = useState(today());
  const [mentioned, setMentioned] = useState(false);
  const [rank, setRank] = useState("");
  const [citation, setCitation] = useState("");
  const [sources, setSources] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!prompt || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/ai-mentions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          promptId: prompt.id,
          platform,
          checkedAt: date ? `${date}T12:00:00.000Z` : null,
          mentioned,
          brandRank: mentioned && rank ? Number(rank) : null,
          citationUrl: citation,
          sources,
          excerpt,
          evidenceUrl: evidence,
          notes,
        }),
      });
      const payload = (await response.json()) as MentionsPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo registrar el chequeo.");
      onSaved(payload);
      toast.success("Chequeo registrado");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar el chequeo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={prompt != null}
      onClose={onClose}
      title={prompt?.prompt ?? ""}
      subtitle="Chequeo manual de mención"
      width="max-w-[520px]"
      footer={
        <>
          <Button variant="primary" size="sm" onClick={() => void submit()} disabled={saving}>
            {saving ? "Guardando…" : "Registrar chequeo"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
            Cancelar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className={labelClass}>Plataforma</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value)} className={inputClass} aria-label="Plataforma">
              {MENTION_PLATFORMS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Fecha</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} aria-label="Fecha del chequeo" />
          </label>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-edge bg-surface-2/40 px-3 py-2 text-[11.5px] text-content">
          <input type="checkbox" checked={mentioned} onChange={(event) => setMentioned(event.target.checked)} className="size-3.5 accent-[var(--wm-accent)]" />
          La respuesta menciona a Whalemate
        </label>

        {mentioned ? (
          <label className="space-y-1">
            <span className={labelClass}>Posición de la marca (opcional)</span>
            <input type="number" min={1} max={50} value={rank} onChange={(event) => setRank(event.target.value)} placeholder="Ej. 3" className={inputClass} aria-label="Posición de la marca" />
          </label>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelClass}>URL citada</span>
            <input value={citation} onChange={(event) => setCitation(event.target.value)} placeholder="https://www.whalemate.com/..." className={inputClass} aria-label="URL citada" />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Evidencia</span>
            <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Link a captura o chat" className={inputClass} aria-label="URL de evidencia" />
          </label>
        </div>

        <label className="space-y-1">
          <span className={labelClass}>Fuentes citadas (separadas por coma)</span>
          <input value={sources} onChange={(event) => setSources(event.target.value)} placeholder="whalemate.com, knowbe4.com" className={inputClass} aria-label="Fuentes citadas" />
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Extracto de la respuesta</span>
          <textarea
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            rows={3}
            placeholder="Fragmento textual donde aparece (o no) la marca."
            className="wm-focus-ring w-full rounded-lg border border-edge bg-surface-1 px-2 py-1.5 text-[11.5px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none"
            aria-label="Extracto de la respuesta"
          />
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Notas</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones de la revisión" className={inputClass} aria-label="Notas" />
        </label>

        {error ? <p className="rounded-lg border border-negative/30 bg-negative/10 px-2.5 py-1.5 text-[10.5px] text-negative">{error}</p> : null}

        <p className="text-[9.5px] leading-relaxed text-content-faint">
          El chequeo es manual: abrí el prompt en la plataforma elegida, verificá si Whalemate aparece y registrá la evidencia. No se envían datos a ningún proveedor externo.
        </p>
      </div>
    </Sheet>
  );
}
