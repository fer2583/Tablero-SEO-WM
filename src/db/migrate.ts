import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/db/client";

/** Executes the idempotent schema locally or from a controlled deployment step. */
export async function migrate() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.POSTGRES_URL_NON_POOLING) {
    throw new Error("DATABASE_URL no está configurada; migración cancelada.");
  }

  const schema = await readFile(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8");
  const statements = schema.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  const db = getDb();
  for (const statement of statements) await db.query(statement);
}
