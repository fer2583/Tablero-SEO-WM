"use client";

import { createContext, useContext } from "react";
import type { IntegrationFilters } from "@/lib/integrations";

export type ConfigurationSource = { key: string; name: string; status: "connected" | "configured" | "unavailable" | "error"; detail: string; lastSync: string | null };
export type ConfigurationState = { status: "loading" | "ready" | "error"; sources: ConfigurationSource[]; error?: string };
export type FilterContextValue = { filters: IntegrationFilters; refreshKey: number; updateFilter: (key: keyof IntegrationFilters, value: string) => void; refresh: () => void; configuration: ConfigurationState };
export const FilterContext = createContext<FilterContextValue | null>(null);
export function useDashboardFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error("useDashboardFilters debe usarse dentro de DashboardShell.");
  return context;
}
