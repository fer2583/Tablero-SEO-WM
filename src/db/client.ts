import "server-only";

import { createPool } from "@vercel/postgres";

const globalForDb = globalThis as typeof globalThis & {
  whaleMateDb?: ReturnType<typeof createPool>;
};

export function getDb() {
  if (globalForDb.whaleMateDb) return globalForDb.whaleMateDb;

  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("DATABASE_URL no está configurada.");

  globalForDb.whaleMateDb = createPool({ connectionString });
  return globalForDb.whaleMateDb;
}
