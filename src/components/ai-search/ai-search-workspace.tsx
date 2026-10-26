"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, RefreshCw, Sparkles } from "lucide-react";
import type { IntegrationResponse } from "@/lib/integrations";
import type { AiSearchData } from "@/lib/ai-search";
import { useDashboardFilters } from "@/components/filter-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import { AiTrafficView } from "./ai-traffic-view";
import { AiMentionsView } from "./ai-mentions-view";
import { cn } from "@/lib/utils";

const EMPTY: AiSearchData = {
  period: { start: "", end: "", previousStart: "", previousEnd: "" },
  metrics: { sessions: 0, users: 0, conversions: 0, engagementRate: 0 },
  previous: { sessions: 0, users: 0, conversions: 0, engagementRate: 0 },
  totalSessions: 0,
  previousTotalSessions: 0,
  share: 0,
  previousShare: 0,
  sources: [],
  platforms: [],
  landingPages: [],
  daily: [],
  aiStatus: "unavailable",
  generatedAt: "",
};

const formatDay = (value: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed).replace(" de ", " ");
};

export function AiSearchWorkspace() {
  const { filters, updateFilter, refresh, refreshKey } = useDashboardFilters();
  const [tab, setTab] = useState<"traffic" | "mentions">("traffic");
  const [payload, setPayload] = useState<IntegrationResponse<AiSearchData> | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");

  const url = useMemo(() => `/api/ai-search?days=${filters.days}&language=${filters.language}&country=${filters.country}&device=${filters.device}`, [filters.country, filters.days, filters.device, filters.language]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: IntegrationResponse<AiSearchData>) => {
        setPayload(value);
        setLoadedUrl(url);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPayload({ status: "unavailable", data: EMPTY, error: "No se pudo conectar con el tráfico de IA.", generatedAt: "" });
        setLoadedUrl(url);
      });
    return () => controller.abort();
  }, [url, refreshKey]);

  const response = payload ?? { status: "unavailable" as const, data: EMPTY, error: "Consultando GA4.", generatedAt: "" };
  const loading = loadedUrl !== url;
  const period = response.data.period.start ? `${formatDay(response.data.period.start)} – ${formatDay(response.data.period.end)}` : "Período no disponible";

  return (
    <div className="wm-rise space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-edge bg-surface-2 text-accent">
              <Bot className="size-3.5" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">AI Search</p>
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-content">Tráfico y menciones de IA</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
            <span>{period}</span>
            <Badge tone={response.status === "live" ? "positive" : response.status === "no_data" ? "caution" : "negative"}>
              {response.status === "live" ? "GA4 conectado" : response.status === "no_data" ? "Sin referidos IA" : "No disponible"}
            </Badge>
            <span className="text-content-faint">Referidos reales + menciones verificadas</span>
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Actualizar
        </Button>
      </header>

      {tab === "traffic" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterPill label="Periodo" value={String(filters.days)} onChange={(value) => updateFilter("days", value)} options={[["7", "7 días"], ["28", "28 días"], ["30", "30 días"], ["60", "60 días"], ["90", "90 días"]]} />
          <FilterPill label="Idioma" value={filters.language} onChange={(value) => updateFilter("language", value)} options={[["all", "Todos"], ["es", "Español"], ["en", "Inglés"], ["pt", "Portugués"]]} />
          <FilterPill label="País" value={filters.country} onChange={(value) => updateFilter("country", value)} options={[["all", "Todos"], ["ES", "España"], ["MX", "México"], ["US", "EE. UU."], ["GB", "Reino Unido"], ["PT", "Portugal"], ["AR", "Argentina"]]} />
          <FilterPill label="Dispositivo" value={filters.device} onChange={(value) => updateFilter("device", value)} options={[["all", "Todos"], ["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]]} />
        </div>
      ) : null}

      <div aria-label="Vistas de AI Search" className="flex w-full gap-1 rounded-lg border border-edge bg-surface-1 p-1">
        <button
          type="button"
          aria-pressed={tab === "traffic"}
          onClick={() => setTab("traffic")}
          className={cn("wm-focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors", tab === "traffic" ? "bg-surface-3 text-content shadow-sm" : "text-content-muted hover:text-content")}
        >
          <Bot className="size-3.5" /> Tráfico IA
        </button>
        <button
          type="button"
          aria-pressed={tab === "mentions"}
          onClick={() => setTab("mentions")}
          className={cn("wm-focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors", tab === "mentions" ? "bg-surface-3 text-content shadow-sm" : "text-content-muted hover:text-content")}
        >
          <Sparkles className="size-3.5" /> Menciones IA
        </button>
      </div>

      {tab === "traffic" ? <AiTrafficView response={response} loading={loading} /> : <AiMentionsView key={refreshKey} />}

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-content-faint">
        <p>Fuentes: GA4 (referidos de asistentes) + registro manual de menciones. Sin APIs de pago.</p>
        {response.generatedAt ? <p>{new Date(response.generatedAt).toLocaleString("es-ES")}</p> : null}
      </footer>
    </div>
  );
}
