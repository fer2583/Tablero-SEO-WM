import "server-only";

import { acquireSynchronizationLock, getSynchronization, releaseSynchronizationLock, saveSynchronization } from "@/db/queries";

export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
export type SnapshotState = "fresh" | "stale" | "running" | "unavailable";

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING);
}

export function snapshotState(lastSnapshotAt: string | null, synchronization: { status: string; lastSuccessAt: string | null; lockExpiresAt: string | null } | null): SnapshotState {
  if (!lastSnapshotAt) return "unavailable";
  if (synchronization?.status === "running" || (synchronization?.lockExpiresAt && new Date(synchronization.lockExpiresAt).getTime() > Date.now())) return "running";
  return Date.now() - new Date(lastSnapshotAt).getTime() > SNAPSHOT_TTL_MS ? "stale" : "fresh";
}

export async function controlledRefresh<T>(input: {
  source: string;
  force: boolean;
  snapshotAt: string | null;
  read: () => Promise<T | null>;
  refresh: () => Promise<T>;
  persist: (value: T) => Promise<void>;
}) {
  if (!databaseConfigured()) return { mode: "live" as const, value: null, state: "unavailable" as const };
  const synchronization = await getSynchronization(input.source);
  const state = snapshotState(input.snapshotAt, synchronization);
  const current = await input.read();
  if (current && state === "running") return { mode: "snapshot" as const, value: current, state };
  if (!input.force && current && (state === "fresh" || state === "running")) return { mode: "snapshot" as const, value: current, state };
  if (!input.force && current && state === "stale") {
    void executeRefresh(input).catch(() => undefined);
    return { mode: "snapshot" as const, value: current, state: "stale" as const };
  }
  const refreshed = await executeRefresh(input);
  return { mode: "snapshot" as const, value: refreshed, state: "fresh" as const };
}

async function executeRefresh<T>(input: { source: string; refresh: () => Promise<T>; persist: (value: T) => Promise<void> }) {
  const token = crypto.randomUUID();
  if (!(await acquireSynchronizationLock(input.source, token))) {
    const current = await getSynchronization(input.source);
    if (current?.status === "running") throw new Error("La fuente ya se está actualizando.");
    throw new Error("No se pudo adquirir el lock de sincronización.");
  }
  try {
    const value = await input.refresh();
    await input.persist(value);
    await saveSynchronization({ source: input.source, status: "success" });
    return value;
  } catch (error) {
    await saveSynchronization({ source: input.source, status: "error", error: error instanceof Error ? error.message : "Error de sincronización" });
    throw error;
  } finally {
    await releaseSynchronizationLock(input.source, token);
  }
}
