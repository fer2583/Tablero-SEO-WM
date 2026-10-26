"use client";

import { BarChart3, Bot, Database, Gauge, Globe2, RefreshCw, Search, Settings2, ShieldCheck } from "lucide-react";
import { useDashboardFilters } from "./filter-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

const ICONS = { gsc: Search, ga4: BarChart3, psi: Gauge, crux: Globe2, crawler: Bot, neon: Database } as const;
const LABELS = { connected: "Conectada", configured: "Configurada pero sin datos", unavailable: "No disponible", error: "Error" };
const TONES = { connected: "positive", configured: "caution", unavailable: "neutral", error: "negative" } as const;

const when = (value: string | null) =>
  value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Sin sincronización";

export function ConfigurationPanel() {
  const { configuration, refresh } = useDashboardFilters();

  if (configuration.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="wm-skeleton h-16 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="wm-skeleton h-[120px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (configuration.status === "error") {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-edge bg-surface-1 px-6 py-14 text-center">
        <Settings2 className="size-6 text-content-faint" />
        <p className="mt-3 text-[13px] font-medium text-content">No se pudo cargar la configuración</p>
        <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-content-faint">{configuration.error ?? "Error de conexión."}</p>
        <Button variant="secondary" size="sm" onClick={refresh} className="mt-4 gap-1.5">
          <RefreshCw className="size-3.5" /> Reintentar
        </Button>
      </div>
    );
  }

  const connected = configuration.sources.filter((source) => source.status === "connected").length;
  const configured = configuration.sources.filter((source) => source.status === "configured").length;
  const unavailable = configuration.sources.filter((source) => source.status === "unavailable" || source.status === "error").length;

  return (
    <div className="wm-rise space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <Settings2 className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">Configuración</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Fuentes de datos</h1>
          <p className="mt-1 text-[11.5px] text-content-muted">Estado real de las conexiones. Nunca se muestran secretos ni credenciales.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Volver a comprobar
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Conectadas" value={connected} icon={<ShieldCheck className="size-3.5" />} tone="positive" detail="Responden con datos reales" />
        <StatCard label="Configuradas sin datos" value={configured} icon={<Settings2 className="size-3.5" />} tone="caution" detail="Credenciales presentes, sin respuesta" />
        <StatCard label="No disponibles" value={unavailable} icon={<Globe2 className="size-3.5" />} tone={unavailable ? "negative" : "positive"} detail="Requieren configuración o revisión" />
      </div>

      <Section title="Fuentes" detail={`${configuration.sources.length} orígenes monitoreados por el tablero.`}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {configuration.sources.map((source) => {
            const Icon = ICONS[source.key as keyof typeof ICONS] ?? Globe2;
            const tone = TONES[source.status] ?? "neutral";
            return (
              <article key={source.key} className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-lg border",
                      tone === "positive" && "border-positive/25 bg-positive/10 text-positive",
                      tone === "caution" && "border-caution/25 bg-caution/10 text-caution",
                      tone === "negative" && "border-negative/25 bg-negative/10 text-negative",
                      tone === "neutral" && "border-edge bg-surface-3 text-content-faint",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <Badge tone={tone}>{LABELS[source.status] ?? source.status}</Badge>
                </div>
                <p className="mt-2 text-[12px] font-semibold text-content">{source.name}</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-content-muted">{source.detail}</p>
                <p className="mt-1.5 font-mono text-[9.5px] text-content-faint">Última sincronización: {when(source.lastSync)}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <div className="rounded-xl border border-edge bg-surface-1 px-3 py-2.5">
        <p className="text-[10.5px] leading-relaxed text-content-faint">
          Los estados se derivan de la configuración del servidor y de las respuestas reales de cada proveedor. Una fuente
          &quot;configurada pero sin datos&quot; tiene credenciales válidas y todavía no devolvió una muestra publicable.
        </p>
      </div>
    </div>
  );
}
