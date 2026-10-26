"use client";

import { useMemo, useState } from "react";
import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import type { KeywordRow } from "@/lib/keywords";
import type { Density } from "@/components/filter-context";
import { cn } from "@/lib/utils";

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 });
const pct = (value: number) => percent.format(value).replace(/\s/g, "");

type ColKey = "query" | "page" | "position" | "clicks" | "impressions" | "ctr" | "clickDelta";

const COLUMNS: Array<{ key: ColKey; label: string; align: "left" | "right"; sortFn: "alphanumeric" | "basic"; className?: string }> = [
  { key: "query", label: "Consulta", align: "left", sortFn: "alphanumeric" },
  { key: "page", label: "Página", align: "left", sortFn: "alphanumeric", className: "hidden lg:table-cell" },
  { key: "position", label: "Pos.", align: "right", sortFn: "basic" },
  { key: "clicks", label: "Clics", align: "right", sortFn: "basic" },
  { key: "impressions", label: "Impr.", align: "right", sortFn: "basic", className: "hidden sm:table-cell" },
  { key: "ctr", label: "CTR", align: "right", sortFn: "basic" },
  { key: "clickDelta", label: "Δ clics", align: "right", sortFn: "basic" },
];

const pathOf = (value: string) => {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
};

const positionTone = (position: number) => {
  if (position <= 3) return "text-positive";
  if (position <= 10) return "text-content";
  if (position <= 20) return "text-caution";
  return "text-content-faint";
};

export function KeywordGrid({
  rows,
  density,
  onSelect,
}: {
  rows: KeywordRow[];
  density: Density;
  onSelect: (row: KeywordRow) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "clicks", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 });

  const columns = useMemo<Array<ColumnDef<typeof features, KeywordRow>>>(
    () =>
      COLUMNS.map((column) => ({
        id: column.key,
        accessorFn: (row: KeywordRow) => (column.key === "clickDelta" ? (row.clickDelta ?? 0) : row[column.key]),
        header: column.label,
        sortFn: column.sortFn,
        sortDescFirst: column.key !== "query" && column.key !== "page",
      })),
    [],
  );

  const table = useTable({
    features,
    columns,
    data: rows,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: (row, index) => `${row.query}||${row.page}||${index}`,
  });

  const pageRows = table.getRowModel().rows;
  const total = rows.length;
  const pageCount = Math.max(1, table.getPageCount());
  const pageIndex = table.state.pagination.pageIndex;
  const from = total ? pageIndex * pagination.pageSize + 1 : 0;
  const to = Math.min(total, (pageIndex + 1) * pagination.pageSize);
  const rowPadding = density === "compact" ? "py-1.5" : "py-2.5";

  if (!total) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-edge/70 px-6 py-14 text-center">
        <p className="text-[12.5px] font-medium text-content">Sin resultados para esta vista</p>
        <p className="mt-1 max-w-xs text-[11.5px] text-content-faint">Ajustá el período, los filtros o la búsqueda para ver consultas.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface-1">
      <div className="wm-scroll-x overflow-x-auto">
        <table className="w-full min-w-[640px]! border-collapse text-left">
          <thead>
            <tr className="border-b border-edge bg-surface-2/50">
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const config = COLUMNS.find((column) => column.key === header.column.id);
                if (!config) return null;
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-content-faint",
                      config.align === "right" ? "text-right" : "text-left",
                      config.className,
                    )}
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "wm-focus-ring inline-flex items-center gap-1 rounded transition-colors hover:text-content",
                        config.align === "right" && "flex-row-reverse",
                        sorted && "text-content",
                      )}
                    >
                      {config.label}
                      {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const keyword = row.original;
              const delta = keyword.clickDelta ?? 0;
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelect(keyword)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(keyword);
                    }
                  }}
                  tabIndex={0}
                  className={cn(
                    "wm-row wm-focus-ring cursor-pointer border-b border-edge/60 text-[12.5px] last:border-0",
                    rowPadding,
                  )}
                >
                  <td className="px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("size-1.5 shrink-0 rounded-full", keyword.brand === "brand" ? "bg-chart-2" : "bg-accent/70")}
                        aria-hidden
                      />
                      <span className="line-clamp-1 font-medium text-content">{keyword.query}</span>
                    </div>
                  </td>
                  <td className="hidden max-w-[280px] px-3 lg:table-cell">
                    <span className="line-clamp-1 font-mono text-[11px] text-content-faint" title={keyword.page}>
                      {pathOf(keyword.page)}
                    </span>
                  </td>
                  <td className="px-3 text-right font-mono tabular-nums">
                    <span className={positionTone(keyword.position)}>{decimal.format(keyword.position)}</span>
                  </td>
                  <td className="px-3 text-right font-mono tabular-nums text-content">{integer.format(keyword.clicks)}</td>
                  <td className="hidden px-3 text-right font-mono tabular-nums text-content-muted sm:table-cell">{integer.format(keyword.impressions)}</td>
                  <td className="px-3 text-right font-mono tabular-nums text-content-muted">{pct(keyword.ctr)}</td>
                  <td className="px-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 font-mono text-[11.5px] tabular-nums",
                        delta > 0 ? "text-positive" : delta < 0 ? "text-negative" : "text-content-faint",
                      )}
                    >
                      {delta > 0 ? <ArrowUp className="size-3" /> : delta < 0 ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
                      {delta === 0 ? "0" : integer.format(Math.abs(delta))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-edge bg-surface-2/30 px-3 py-2 text-[11px] text-content-faint">
        <p className="tnum">
          {from}–{to} de {integer.format(total)}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Página anterior"
            className="wm-focus-ring grid size-7 place-items-center rounded-md border border-edge text-content-muted transition-colors hover:border-edge-strong hover:text-content disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="tnum min-w-[62px] text-center">
            {pageIndex + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Página siguiente"
            className="wm-focus-ring grid size-7 place-items-center rounded-md border border-edge text-content-muted transition-colors hover:border-edge-strong hover:text-content disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
