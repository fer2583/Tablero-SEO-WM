"use client";

import { createContext, useContext } from "react";
import type { IntegrationFilters } from "@/lib/integrations";

export type FilterContextValue = { filters: IntegrationFilters; refreshKey: number; updateFilter: (key: keyof IntegrationFilters, value: string) => void; refresh: () => void };
export const FilterContext = createContext<FilterContextValue | null>(null);
export function useDashboardFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error("useDashboardFilters debe usarse dentro de DashboardShell.");
  return context;
}
