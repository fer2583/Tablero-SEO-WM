"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { KeywordRow } from "@/lib/keywords";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 });
const pct = (value: number) => percent.format(value).replace(/\s/g, "");

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-content-faint">{label}</p>
      <p className={cn("mt-1 font-mono text-[16px] font-semibold tabular-nums", tone ?? "text-content")}>{value}</p>
    </div>
  );
}

export function KeywordSheet({ row, onClose }: { row: KeywordRow | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!row) return;
    try {
      await navigator.clipboard.writeText(row.query);
      setCopied(true);
      toast.success("Consulta copiada");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("No se pudo copiar la consulta");
    }
  };

  return (
    <Dialog.Root open={row != null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="wm-backdrop fixed inset-0 z-50 bg-[#02060f]/75 backdrop-blur-[2px]" />
        <Dialog.Popup className="wm-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col overflow-y-auto border-l border-edge-strong bg-surface-1 shadow-[-24px_0_60px_-20px_rgba(0,0,0,.9)] outline-none">
          {row ? (
            <>
              <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-edge bg-surface-1/95 px-4 py-3.5 backdrop-blur">
                <div className="min-w-0">
                  <Dialog.Title className="truncate text-[15px] font-semibold text-content">{row.query}</Dialog.Title>
                  <Dialog.Description className="mt-0.5 truncate font-mono text-[10.5px] text-content-faint">{row.page}</Dialog.Description>
                </div>
                <Dialog.Close
                  aria-label="Cerrar detalle"
                  className="wm-focus-ring grid size-7 shrink-0 place-items-center rounded-md border border-edge text-content-muted transition-colors hover:border-edge-strong hover:text-content"
                >
                  <X className="size-3.5" />
                </Dialog.Close>
              </header>

              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={row.brand === "brand" ? "accent" : "neutral"}>{row.brand === "brand" ? "Marca" : "No marca"}</Badge>
                  <Badge tone={row.position <= 3 ? "positive" : row.position <= 10 ? "neutral" : "caution"}>
                    Posición {decimal.format(row.position)}
                  </Badge>
                  {row.clickDelta != null && row.clickDelta !== 0 ? (
                    <Badge tone={row.clickDelta > 0 ? "positive" : "negative"}>
                      {row.clickDelta > 0 ? "+" : ""}
                      {integer.format(row.clickDelta)} clics vs. período anterior
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Clics" value={integer.format(row.clicks)} />
                  <Metric label="Impresiones" value={integer.format(row.impressions)} />
                  <Metric label="CTR" value={pct(row.ctr)} />
                  <Metric label="Posición media" value={decimal.format(row.position)} />
                </div>

                <section className="rounded-lg border border-accent/25 bg-accent/[0.06] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">Oportunidad estimada</p>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="font-mono text-[22px] font-semibold tabular-nums text-content">
                      {row.potentialClicks == null ? "—" : `+${integer.format(row.potentialClicks)}`}
                    </span>
                    <span className="text-[11px] text-content-muted">clics/mes recuperables</span>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-content-faint">
                    CTR esperado en posición {decimal.format(row.position)}:{" "}
                    {row.expectedCtr == null ? "—" : pct(row.expectedCtr)}. Estimación basada en curva de CTR por
                    posición, no en datos observados.
                  </p>
                </section>

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-content-faint">Página que posiciona</p>
                  <a
                    href={row.page}
                    target="_blank"
                    rel="noreferrer"
                    className="wm-focus-ring group flex items-start gap-2 rounded-lg border border-edge bg-surface-2/40 px-3 py-2 transition-colors hover:border-edge-strong"
                  >
                    <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-content-faint group-hover:text-accent" />
                    <span className="break-all font-mono text-[11px] text-content-muted group-hover:text-content">{row.page}</span>
                  </a>
                </div>
              </div>

              <footer className="mt-auto flex items-center gap-2 border-t border-edge bg-surface-2/30 px-4 py-3">
                <Button variant="secondary" size="sm" onClick={copy} className="gap-1.5">
                  {copied ? <Check className="size-3.5 text-positive" /> : <Copy className="size-3.5" />}
                  Copiar consulta
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
                  Cerrar
                </Button>
              </footer>

              <p className="border-t border-edge/60 px-4 py-2 text-[9.5px] leading-relaxed text-content-faint">
                Fuente: Google Search Console API, sin caché. Métricas del período seleccionado en el tablero.
              </p>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
