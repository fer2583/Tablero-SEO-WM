"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Copy, RefreshCw, ShieldAlert, Sparkles, Target, Telescope } from "lucide-react";
import { toast } from "sonner";
import { useDashboardFilters } from "@/components/filter-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import type { IntelligencePayload, IntelligenceSignal, SignalCategory } from "@/lib/intelligence-types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<SignalCategory, string> = {
  oportunidad: "Oportunidad",
  tecnico: "Técnico",
  ia: "IA",
  alerta: "Alerta",
  datos: "Datos",
};

const CATEGORY_TONE: Record<SignalCategory, "accent" | "caution" | "positive" | "negative" | "neutral"> = {
  oportunidad: "accent",
  tecnico: "caution",
  ia: "positive",
  alerta: "negative",
  datos: "neutral",
};

const formatDay = (value: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed).replace(" de ", " ");
};

export function IntelligenceWorkspace() {
  const { filters, updateFilter, refresh, refreshKey } = useDashboardFilters();
  const [payload, setPayload] = useState<IntelligencePayload | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");

  const url = useMemo(() => `/api/intelligence?days=${filters.days}&language=${filters.language}&country=${filters.country}&device=${filters.device}`, [filters.country, filters.days, filters.device, filters.language]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: IntelligencePayload) => {
        setPayload(value);
        setLoadedUrl(url);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadedUrl(url);
      });
    return () => controller.abort();
  }, [url, refreshKey]);

  const loading = loadedUrl !== url && payload == null;
  const period = payload?.period.start ? `${formatDay(payload.period.start)} – ${formatDay(payload.period.end)}` : "Período no disponible";
  const focus = payload?.signals.slice(0, 3) ?? [];
  const rest = payload?.signals.slice(3) ?? [];
  const groups: Array<{ key: SignalCategory; label: string; items: IntelligenceSignal[] }> = [
    { key: "oportunidad", label: "Oportunidades", items: rest.filter((signal) => signal.category === "oportunidad") },
    { key: "tecnico", label: "Riesgos técnicos", items: rest.filter((signal) => signal.category === "tecnico" || signal.category === "alerta") },
    { key: "ia", label: "Visibilidad IA", items: rest.filter((signal) => signal.category === "ia" || signal.category === "datos") },
  ].filter((group) => group.items.length > 0) as Array<{ key: SignalCategory; label: string; items: IntelligenceSignal[] }>;

  const copyBrief = async () => {
    if (!payload) return;
    const text = [`Intelligence · ${period}`, ...payload.brief].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Brief copiado");
    } catch {
      toast.error("No se pudo copiar el brief");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="wm-skeleton h-16 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="wm-skeleton h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="wm-skeleton h-[260px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="wm-rise space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <Brain className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">Intelligence</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Señales priorizadas por impacto</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
            <span>{period}</span>
            <Badge tone={payload?.status === "live" ? "positive" : payload?.status === "partial" ? "caution" : "negative"}>
              {payload?.status === "live" ? "Fuentes completas" : payload?.status === "partial" ? "Cobertura parcial" : "Sin datos"}
            </Badge>
            <span className="text-content-faint">Scoring determinístico · sin LLM</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={refresh} className="gap-1.5">
            <RefreshCw className="size-3.5" /> Actualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => void copyBrief()} disabled={!payload?.brief.length} className="gap-1.5">
            <Copy className="size-3.5" /> Copiar brief
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill label="Periodo" value={String(filters.days)} onChange={(value) => updateFilter("days", value)} options={[["7", "7 días"], ["28", "28 días"], ["30", "30 días"], ["60", "60 días"], ["90", "90 días"]]} />
        <FilterPill label="País" value={filters.country} onChange={(value) => updateFilter("country", value)} options={[["all", "Todos"], ["ES", "España"], ["MX", "México"], ["US", "EE. UU."], ["GB", "Reino Unido"], ["PT", "Portugal"], ["AR", "Argentina"]]} />
        <FilterPill label="Dispositivo" value={filters.device} onChange={(value) => updateFilter("device", value)} options={[["all", "Todos"], ["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]]} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Señales activas" value={payload?.summary.signals ?? 0} icon={<Telescope className="size-3.5" />} detail="Priorizadas por score" />
        <StatCard label="Oportunidades" value={payload?.summary.opportunities ?? 0} icon={<Target className="size-3.5" />} tone="accent" detail="Keywords y contenido" />
        <StatCard label="Riesgos" value={payload?.summary.risks ?? 0} icon={<ShieldAlert className="size-3.5" />} tone={(payload?.summary.risks ?? 0) > 0 ? "caution" : "positive"} detail="Técnicos y alertas" />
        <StatCard label="Score máximo" value={payload?.summary.topScore ?? 0} icon={<Sparkles className="size-3.5" />} detail="Impacto × confianza / esfuerzo" />
      </div>

      {!payload || payload.status === "unavailable" ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
          <Brain className="size-6 text-content-faint" />
          <p className="mt-3 text-[13px] font-medium text-content">Todavía no hay señales</p>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-content-faint">
            Intelligence combina keywords, auditoría, alertas y visibilidad IA. Conectá las fuentes o esperá el próximo snapshot.
          </p>
        </div>
      ) : (
        <>
          <Section title="Foco de la semana" detail="Las tres señales con mayor score. Atacá primero lo que combina impacto alto, confianza alta y esfuerzo bajo." action={<Badge tone="accent">Top 3</Badge>}>
            {focus.length ? (
              <div className="grid items-start gap-2 xl:grid-cols-3">
                {focus.map((signal, index) => (
                  <article key={signal.id} className="rounded-lg border border-edge bg-surface-2/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid size-6 place-items-center rounded-md bg-accent-soft font-mono text-[10px] font-semibold text-accent">{index + 1}</span>
                      <Badge tone={CATEGORY_TONE[signal.category]}>{CATEGORY_LABEL[signal.category]}</Badge>
                    </div>
                    <h3 className="mt-2 text-[12px] font-semibold leading-snug text-content">{signal.title}</h3>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-content-muted">{signal.detail}</p>
                    {signal.metric ? <p className="mt-1.5 font-mono text-[10.5px] tabular-nums text-content">{signal.metric}</p> : null}
                    {signal.evidence ? <p className="mt-1 text-[9.5px] leading-relaxed text-content-faint">{signal.evidence}</p> : null}
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge tone="neutral">confianza {signal.confidence}</Badge>
                      <Badge tone="neutral">esfuerzo {signal.effort}</Badge>
                      <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums text-accent">{signal.score}</span>
                    </div>
                    <Progress className="mt-1.5" value={signal.score} tone={signal.category === "alerta" ? "negative" : signal.category === "ia" ? "positive" : "accent"} label={`Score ${signal.title}`} />
                    <Link href={signal.href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-1.5 -ml-2 gap-1 text-[10.5px]")}>
                      Abrir sección <ArrowRight className="size-3" />
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="px-1 py-6 text-center text-[11px] text-content-faint">No hay señales prioritarias para el período. Buen momento para revisar cobertura de fuentes.</p>
            )}
          </Section>

          {groups.map((group) => (
            <Section key={group.key} title={group.label} detail={`${group.items.length} señales adicionales.`}>
              <ul className="space-y-1.5">
                {group.items.map((signal) => (
                  <li key={signal.id} className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={CATEGORY_TONE[signal.category]}>{CATEGORY_LABEL[signal.category]}</Badge>
                          <span className="font-mono text-[10px] text-content-faint">score {signal.score}</span>
                          {signal.metric ? <span className="font-mono text-[10px] tabular-nums text-content-muted">{signal.metric}</span> : null}
                        </div>
                        <p className="mt-1 text-[11.5px] font-medium text-content">{signal.title}</p>
                        <p className="mt-0.5 text-[10.5px] leading-relaxed text-content-muted">{signal.detail}</p>
                      </div>
                      <Link href={signal.href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 gap-1 text-[10.5px]")}>
                        Abrir <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ))}

          <div className="grid items-start gap-3 xl:grid-cols-2">
            <Section title="Brief de entrada" detail="Tres prioridades listas para copiar y compartir.">
              <ol className="space-y-1.5">
                {payload.brief.map((line, index) => (
                  <li key={index} className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-1.5 font-mono text-[10.5px] leading-relaxed text-content-muted">
                    {line}
                  </li>
                ))}
              </ol>
            </Section>
            <Section title="Estado de fuentes" detail="Cada fuente se evalúa por separado; una caída no bloquea el resto.">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries({ keywords: "Keywords", audit: "Auditoría", alerts: "Alertas", ai: "Tráfico IA", mentions: "Menciones IA" }).map(([key, label]) => {
                  const state = payload.sources[key as keyof IntelligencePayload["sources"]];
                  return (
                    <Badge key={key} tone={state === "live" ? "positive" : state === "empty" ? "caution" : "neutral"}>
                      {label} · {state}
                    </Badge>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-content-faint">
                Scoring determinístico: impacto × peso de confianza / peso de esfuerzo. El brief no usa un LLM; se genera con los datos y umbrales del tablero.
              </p>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
