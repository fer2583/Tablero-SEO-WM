"use client";

import { Settings2 } from "lucide-react";
import type { AuditData } from "@/lib/audit";
import type { RunView } from "@/lib/crawler/service";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";

export function AuditSettingsView({ data, run, maxUrls, setMaxUrls }: { data: AuditData; run: RunView | null; maxUrls: number; setMaxUrls: (value: number) => void }) {
  return (
    <div className="space-y-3">
      <Section
        title="Configuración y cobertura"
        detail="La nueva configuración se aplica a la próxima corrida."
        action={<Settings2 className="size-4 text-content-faint" />}
      >
        <label className="flex flex-wrap items-center gap-2 text-[11.5px] text-content-muted">
          Máximo de URLs
          <input
            type="number"
            min={1}
            max={10000}
            value={maxUrls}
            onChange={(event) => setMaxUrls(Number(event.target.value))}
            className="wm-focus-ring h-8 w-28 rounded-lg border border-edge bg-surface-1 px-2 font-mono text-[11px] tabular-nums text-content focus:border-accent/60 focus:outline-none"
          />
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Row label="Reglas" value={data.rulesVersion || "Snapshot anterior a v2"} />
          <Row label="Robots" value={data.crawler.robots} />
          <Row label="Sitemap" value={data.sitemap.status} />
        </div>

        <p className="mt-2 text-[10.5px] leading-relaxed text-content-faint">
          {run
            ? `Lote ${run.config.batchSize}; concurrencia ${run.config.concurrency}; parámetros ${run.config.maxQueryUrls}; profundidad ${run.config.maxDepth}.`
            : "Configuración de servidor pendiente de una corrida nueva."}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone={data.sources.psi === "live" ? "positive" : "caution"}>PSI · {data.sources.psi}</Badge>
          <Badge tone={data.sources.crux === "live" ? "positive" : "caution"}>CrUX · {data.sources.crux}</Badge>
          <Badge tone={data.sources.gsc === "live" ? "positive" : "caution"}>GSC · {data.sources.gsc}</Badge>
        </div>
      </Section>

      <Section title={`Exclusiones (${data.crawler.excluded?.length || 0})`} detail="URLs descartadas por robots, límites o reglas de alcance.">
        {data.crawler.excluded?.length ? (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {data.crawler.excluded.map((item) => (
              <p key={item.url} className="break-all text-[10.5px] text-content-faint">
                <span className="text-caution">{item.reason}</span>: <span className="font-mono">{item.url}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="px-1 py-4 text-center text-[10.5px] text-content-faint">Sin exclusiones registradas.</p>
        )}
      </Section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-1.5">
      <p className="text-[9.5px] uppercase tracking-[0.07em] text-content-faint">{label}</p>
      <p className="mt-0.5 break-words text-[11px] text-content-muted">{value}</p>
    </div>
  );
}
