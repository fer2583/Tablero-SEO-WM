"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, ExternalLink, Search } from "lucide-react";
import type { AuditData, PageAudit } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

type SortKey = "url" | "language" | "template" | "outcome" | "httpStatus" | "depth" | "impressions";
type Saved = { search?: string; filters?: Record<string, string>; sort?: { key: SortKey; direction: "asc" | "desc" } };

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "url", label: "URL" },
  { key: "language", label: "Idioma" },
  { key: "template", label: "Plantilla" },
  { key: "outcome", label: "Estado" },
  { key: "httpStatus", label: "HTTP", align: "right" },
  { key: "depth", label: "Profundidad", align: "right" },
  { key: "impressions", label: "Impresiones", align: "right" },
];

const sortValue = (page: PageAudit, key: SortKey): string | number => {
  if (key === "url") return page.url;
  if (key === "language") return page.language;
  if (key === "template") return page.template;
  if (key === "outcome") return page.outcome || page.status;
  if (key === "httpStatus") return page.httpStatus ?? 0;
  if (key === "depth") return page.depth ?? -1;
  return page.traffic?.impressions ?? 0;
};

const pathOf = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
};

const outcomeTone = (value: string) =>
  value === "html" || value === "live" ? "positive" : value === "http_error" || value === "error" ? "negative" : value === "redirect" ? "caution" : "neutral";

function readSaved(storageKey: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function AuditPagesView({ data, disabled, recheck }: { data: AuditData; disabled: boolean; recheck: (urls: string[]) => void }) {
  const storageKey = "audit-pages-filters-v1";
  const [initial] = useState<Saved | null>(() => readSaved(storageKey));
  const [search, setSearch] = useState(initial?.search ?? "");
  const [filters, setFilters] = useState<Record<string, string>>(initial?.filters ?? {});
  const [sort, setSort] = useState<Saved["sort"]>(initial?.sort ?? { key: "url", direction: "asc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PageAudit | null>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = data.crawler.audited.filter((row) => {
      if (needle) {
        const haystack = `${row.url} ${row.language} ${row.template} ${row.outcome || row.status}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;
        if (!String(sortValue(row, key as SortKey)).toLowerCase().includes(value.toLowerCase())) return false;
      }
      return true;
    });
    if (!sort) return filtered;
    return [...filtered].sort((left, right) => {
      const a = sortValue(left, sort.key);
      const b = sortValue(right, sort.key);
      const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "es");
      return sort.direction === "asc" ? result : -result;
    });
  }, [data.crawler.audited, filters, search, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const setFilter = (key: string, value: string) => {
    setPage(1);
    setFilters((state) => ({ ...state, [key]: value }));
  };
  const toggleSort = (key: SortKey) => {
    setPage(1);
    setSort((state) => (state?.key === key ? { key, direction: state.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ search, filters, sort }));
    } catch {
      /* Storage may be disabled. */
    }
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data.crawler.audited, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "audit-pages.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const incoming = selected ? data.crawler.audited.filter((item) => item.links?.some((link) => link.url === selected.url)) : [];
  const issues = selected ? data.crawler.issues.filter((item) => item.url === selected.url) : [];

  return (
    <>
      <Section
        title={`Páginas · ${rows.length}`}
        detail="Seleccioná una URL para ver su diagnóstico completo."
        action={
          <Button variant="outline" size="sm" onClick={exportJson} className="gap-1.5">
            <Download className="size-3.5" /> Exportar JSON
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-content-faint" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Buscar en páginas"
              aria-label="Buscar en páginas"
              className="wm-focus-ring h-8 w-full rounded-lg border border-edge bg-surface-1 pl-8 pr-3 text-[11.5px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none"
            />
          </label>
          <select
            aria-label="Filtrar idioma"
            value={filters.language ?? ""}
            onChange={(event) => setFilter("language", event.target.value)}
            className="wm-focus-ring h-8 rounded-lg border border-edge bg-surface-1 px-2 text-[11px] text-content outline-none focus:border-accent/60"
          >
            <option value="">Idioma: todos</option>
            {["ES", "EN", "PT-BR"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            aria-label="Filtrar plantilla"
            placeholder="Plantilla"
            value={filters.template ?? ""}
            onChange={(event) => setFilter("template", event.target.value)}
            className="wm-focus-ring h-8 w-[120px] rounded-lg border border-edge bg-surface-1 px-2 text-[11px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none"
          />
          <input
            aria-label="Filtrar estado"
            placeholder="Estado"
            value={filters.outcome ?? ""}
            onChange={(event) => setFilter("outcome", event.target.value)}
            className="wm-focus-ring h-8 w-[110px] rounded-lg border border-edge bg-surface-1 px-2 text-[11px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none"
          />
          <Button variant="secondary" size="sm" onClick={save}>
            Guardar filtros
          </Button>
        </div>

        <div className="wm-scroll-x mt-2 overflow-x-auto rounded-lg border border-edge">
          <table className="w-full min-w-[720px]! border-collapse text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-edge bg-surface-2/60">
                {COLUMNS.map((column) => {
                  const sorted = sort?.key === column.key;
                  return (
                    <th key={column.key} scope="col" className={cn("px-2.5 py-1.5", column.align === "right" ? "text-right" : "text-left")}>
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          "wm-focus-ring inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.07em] text-content-faint transition-colors hover:text-content",
                          column.align === "right" && "flex-row-reverse",
                          sorted && "text-content",
                        )}
                      >
                        {column.label}
                        {sorted ? sort?.direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.url} className="wm-row border-b border-edge/60 last:border-0">
                  <td className="max-w-[280px] px-2.5 py-1.5">
                    <button
                      type="button"
                      aria-label={row.url}
                      title={row.url}
                      onClick={() => setSelected(row)}
                      className="wm-focus-ring block max-w-full truncate rounded font-mono text-[11px] text-accent hover:underline"
                    >
                      {row.url}
                    </button>
                  </td>
                  <td className="px-2.5 py-1.5 text-content-muted">{row.language}</td>
                  <td className="px-2.5 py-1.5 text-content-muted">{row.template}</td>
                  <td className="px-2.5 py-1.5">
                    <Badge tone={outcomeTone(row.outcome || row.status)}>{row.outcome || row.status}</Badge>
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-content-muted">{row.httpStatus ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-content-muted">{row.depth ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-content-muted">{row.traffic?.impressions == null ? "—" : integer.format(row.traffic.impressions)}</td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-2.5 py-8 text-center text-[11px] text-content-faint">
                    Sin resultados para los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-content-faint">
          <span className="tnum">
            {rows.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{Math.min(rows.length, current * PAGE_SIZE)} de {integer.format(rows.length)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, current - 1))}
              disabled={current === 1}
              aria-label="Página anterior"
              className="wm-focus-ring grid size-7 place-items-center rounded-md border border-edge text-content-muted transition-colors hover:border-edge-strong hover:text-content disabled:opacity-35"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="tnum min-w-[62px] text-center">
              {current} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount, current + 1))}
              disabled={current === pageCount}
              aria-label="Página siguiente"
              className="wm-focus-ring grid size-7 place-items-center rounded-md border border-edge text-content-muted transition-colors hover:border-edge-strong hover:text-content disabled:opacity-35"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </Section>

      {selected ? (
        <Section
          title={pathOf(selected.url)}
          detail={selected.url}
          action={
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" disabled={disabled} onClick={() => void recheck([selected.url])}>
                Reauditar URL
              </Button>
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="wm-focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-content-muted hover:text-content"
              >
                Abrir página <ExternalLink className="size-3" />
              </a>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label="Cerrar detalle">
                Cerrar
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={outcomeTone(selected.outcome || selected.status)}>{selected.outcome || selected.status}</Badge>
              <Badge tone="neutral">HTTP {selected.httpStatus ?? "—"}</Badge>
              <Badge tone="neutral">{selected.template}</Badge>
              <Badge tone="neutral">{selected.language}</Badge>
              {selected.indexable === false ? <Badge tone="negative">No indexable</Badge> : null}
            </div>

            <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <Field label="Title" value={selected.title || "Ausente"} />
              <Field label="Description" value={selected.metaDescription || "Ausente"} />
              <Field label="Canonical" value={selected.canonical || "Sin declaración"} mono />
              <Field label="Robots" value={`${selected.robotsMeta || "Sin meta"} · ${selected.xRobotsTag || "Sin cabecera"}`} />
              <Field label="H1" value={selected.h1.join(" · ") || "Ausente"} />
              <Field label="JSON-LD" value={`${selected.jsonLd} bloques · ${selected.schemaEntities ?? "?"} entidades`} />
              <Field label="Respuesta" value={`${integer.format(selected.durationMs)} ms · ${selected.wordCount ?? "?"} palabras`} />
              <Field label="Profundidad" value={selected.depth == null ? "No alcanzada desde la home" : String(selected.depth)} />
            </dl>

            {selected.traffic ? (
              <div className="rounded-lg border border-accent/25 bg-accent/[0.06] px-3 py-2.5 text-[11px] text-content-muted">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">Tráfico de la landing</span>
                <p className="mt-1">
                  {integer.format(selected.traffic.impressions)} impresiones · {integer.format(selected.traffic.clicks)} clics · {integer.format(selected.traffic.users)} usuarios
                </p>
                <p className="text-[10px] text-content-faint">
                  {selected.traffic.start} a {selected.traffic.end}
                </p>
              </div>
            ) : null}

            {selected.error ? <p className="rounded-lg border border-negative/30 bg-negative/10 px-2.5 py-1.5 text-[11px] text-negative">{selected.error}</p> : null}

            <details className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
              <summary className="cursor-pointer text-[11.5px] font-medium text-content">Enlaces entrantes</summary>
              <div className="mt-2 space-y-1">
                {incoming.length ? incoming.map((item) => <p key={item.url} className="break-all font-mono text-[10.5px] text-content-faint">{item.url}</p>) : <p className="text-[10.5px] text-content-faint">Sin enlaces entrantes detectados en el crawl.</p>}
              </div>
            </details>

            <details className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
              <summary className="cursor-pointer text-[11.5px] font-medium text-content">Enlaces salientes ({selected.links?.length || 0})</summary>
              <div className="mt-2 space-y-1">
                {selected.links?.map((link) => (
                  <p key={`${link.url}-${link.text}`} className="break-all text-[10.5px] text-content-faint">
                    <span className="text-content-muted">{link.text || "(sin texto)"}</span>: {link.url}
                  </p>
                ))}
              </div>
            </details>

            <details className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
              <summary className="cursor-pointer text-[11.5px] font-medium text-content">Hreflang</summary>
              <div className="mt-2 space-y-1">
                {selected.hreflang?.length ? selected.hreflang.map((item) => <p key={`${item.language}-${item.url}`} className="break-all text-[10.5px] text-content-faint">{item.language}: {item.url}</p>) : <p className="text-[10.5px] text-content-faint">Sin declaraciones hreflang.</p>}
              </div>
            </details>

            {issues.length ? (
              <div className="space-y-1.5">
                {issues.map((issue) => (
                  <div key={issue.id} className="rounded-lg border border-caution/25 bg-caution/[0.06] px-3 py-2">
                    <p className="text-[11px] font-medium text-caution">
                      {issue.severity} · {issue.issue}
                    </p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-content-faint">{issue.evidence}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-1.5">
      <dt className="text-[9.5px] uppercase tracking-[0.07em] text-content-faint">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-[11px] leading-relaxed text-content-muted", mono && "font-mono text-[10.5px]")}>{value}</dd>
    </div>
  );
}
