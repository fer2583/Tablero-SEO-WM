"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type TableFilter = "text" | "select" | "number";
export type TableColumn<T> = {
  key: string;
  label: string;
  sortValue?: (row: T) => string | number;
  render?: (row: T) => React.ReactNode;
  filter?: TableFilter;
  options?: string[];
};

export function DataTable<T>({
  rows,
  columns,
  rowKey = (_, index) => String(index),
  label = "tabla",
  pageSize = 8,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey?: (row: T, index: number) => string;
  label?: string;
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const updateFilter = (key: string, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const filtered = useMemo(() => rows.filter((row) => {
    const searchable = columns.map((column) => String(column.sortValue?.(row) ?? "")).join(" ").toLowerCase();
    if (search && !searchable.includes(search.toLowerCase())) return false;
    return columns.every((column) => {
      const value = filters[column.key];
      if (!value) return true;
      const rowValue = String(column.sortValue?.(row) ?? "");
      if (column.filter === "number") {
        const [min, max] = value.split(":").map(Number);
        const number = Number(column.sortValue?.(row));
        return (!Number.isFinite(min) || number >= min) && (!Number.isFinite(max) || number <= max);
      }
      return rowValue.toLowerCase().includes(value.toLowerCase());
    });
  }), [columns, filters, rows, search]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (!sort) return 0;
    const left = sortValue(columns, sort.key, a); const right = sortValue(columns, sort.key, b);
    const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "es");
    return sort.direction === "asc" ? result : -result;
  }), [columns, filtered, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);
  const toggleSort = (key: string) => setSort((current) => current?.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  return <div className="data-table-wrap">
     <div className="table-tools"><label className="table-search"><Search size={14} /><span className="sr-only">Buscar en {label}</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Buscar en ${label}`} /></label><span className="table-count">{filtered.length} resultados</span></div>
    <div className="column-filters">{columns.filter((column) => column.filter).map((column) => column.filter === "select" ? <label key={column.key}><span>{column.label}</span><select value={filters[column.key] ?? ""} onChange={(event) => updateFilter(column.key, event.target.value)}><option value="">Todos</option>{column.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> : <label key={column.key}><span>{column.label}</span><input placeholder={column.filter === "number" ? "min:max" : "Filtrar"} value={filters[column.key] ?? ""} onChange={(event) => updateFilter(column.key, event.target.value)} /></label>)}</div>
    <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}><button className="sort-button" onClick={() => toggleSort(column.key)} aria-label={`Ordenar ${column.label}`}><span>{column.label}</span>{sort?.key === column.key ? sort.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ChevronsUpDown size={13} />}</button></th>)}</tr></thead><tbody>{visible.length ? visible.map((row, index) => <tr key={rowKey(row, index)}>{columns.map((column, columnIndex) => <td key={column.key}>{column.render ? column.render(row) : <>{columnIndex === 0 ? <b>{String(column.sortValue?.(row) ?? "")}</b> : String(column.sortValue?.(row) ?? "")}</>}</td>)}</tr>) : <tr><td colSpan={columns.length}><div className="table-empty">Sin resultados para los filtros actuales.</div></td></tr>}</tbody></table></div>
    {pages > 1 && <div className="table-pagination"><span>Página {page} de {pages}</span><div><button className="outline-button small" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><button className="outline-button small" disabled={page === pages} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></div>}
  </div>;
}

function sortValue<T>(columns: TableColumn<T>[], key: string, row: T) { return columns.find((column) => column.key === key)?.sortValue?.(row) ?? ""; }
