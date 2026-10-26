"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type GridColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  filter?: { type: "text" | "select"; options?: string[] };
  width?: number;
  hideBelow?: "sm" | "md" | "lg" | "xl";
};

export function DataGrid<T>({
  rows,
  columns,
  rowKey,
  label = "tabla",
  pageSize = 15,
  minWidth = 640,
  searchPlaceholder,
  initialSort,
  actions,
  empty,
  footer,
  dense = false,
  onRowClick,
}: {
  rows: T[];
  columns: Array<GridColumn<T>>;
  rowKey: (row: T, index: number) => string;
  label?: string;
  pageSize?: number;
  minWidth?: number;
  searchPlaceholder?: string;
  initialSort?: { key: string; direction: "asc" | "desc" };
  actions?: React.ReactNode;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  dense?: boolean;
  onRowClick?: (row: T) => void;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(initialSort ?? null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (needle) {
        const haystack = columns.map((column) => String(column.value(row))).join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return columns.every((column) => {
        const active = filters[column.key];
        if (!active) return true;
        const value = String(column.value(row));
        return column.filter?.type === "select" ? value.toLowerCase() === active.toLowerCase() : value.toLowerCase().includes(active.toLowerCase());
      });
    });
    if (!sort) return next;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return next;
    return [...next].sort((left, right) => {
      const a = column.value(left);
      const b = column.value(right);
      const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "es");
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, filters, rows, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const filteredColumns = columns.filter((column) => column.filter);
  const hasToolbar = Boolean(searchPlaceholder || filteredColumns.length || actions);
  const cellPadding = dense ? "py-1.5" : "py-2.5";
  const responsive: Record<string, string> = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((state) => (state?.key === key ? { key, direction: state.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  };

  return (
    <div className="min-w-0">
      {hasToolbar ? (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {searchPlaceholder ? (
            <label className="relative min-w-[170px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-content-faint" />
              <input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="wm-focus-ring h-8 w-full rounded-lg border border-edge bg-surface-1 pl-8 pr-3 text-[11.5px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none"
              />
            </label>
          ) : null}
          {filteredColumns.map((column) =>
            column.filter?.type === "select" ? (
              <select
                key={column.key}
                aria-label={`Filtrar ${column.label}`}
                value={filters[column.key] ?? ""}
                onChange={(event) => {
                  setPage(1);
                  setFilters((state) => ({ ...state, [column.key]: event.target.value }));
                }}
                className="wm-focus-ring h-8 rounded-lg border border-edge bg-surface-1 px-2 text-[11px] text-content outline-none focus:border-accent/60"
              >
                <option value="">{column.label}: todos</option>
                {column.filter.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={column.key}
                aria-label={`Filtrar ${column.label}`}
                placeholder={column.label}
                value={filters[column.key] ?? ""}
                onChange={(event) => {
                  setPage(1);
                  setFilters((state) => ({ ...state, [column.key]: event.target.value }));
                }}
                className="wm-focus-ring h-8 w-[120px] rounded-lg border border-edge bg-surface-1 px-2 text-[11px] text-content placeholder:text-content-faint focus:border-accent/60 focus:outline-none"
              />
            ),
          )}
          {actions ? <div className="ml-auto flex items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}

      <div className="wm-scroll-x overflow-x-auto rounded-lg border border-edge">
        <table className="w-full border-collapse text-left text-[11.5px]" style={{ minWidth }} aria-label={label}>
          <thead>
            <tr className="border-b border-edge bg-surface-2/60">
              {columns.map((column) => {
                const sorted = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    className={cn("px-2.5 py-1.5", column.align === "right" ? "text-right" : "text-left", column.hideBelow && responsive[column.hideBelow])}
                  >
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
            {visible.map((row, index) => (
              <tr
                key={rowKey(row, (current - 1) * pageSize + index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn("wm-row border-b border-edge/60 last:border-0", onRowClick && "wm-focus-ring cursor-pointer")}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-2.5 align-middle",
                      cellPadding,
                      column.align === "right" ? "text-right font-mono tabular-nums" : "text-left",
                      column.hideBelow && responsive[column.hideBelow],
                      column.className,
                    )}
                  >
                    {column.render ? column.render(row) : String(column.value(row))}
                  </td>
                ))}
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <td colSpan={columns.length} className="px-2.5 py-8 text-center text-[11px] text-content-faint">
                  {empty ?? "Sin resultados para los filtros actuales."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-content-faint">
        <span className="tnum">
          {filtered.length ? (current - 1) * pageSize + 1 : 0}–{Math.min(filtered.length, current * pageSize)} de {filtered.length}
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
      {footer}
    </div>
  );
}
