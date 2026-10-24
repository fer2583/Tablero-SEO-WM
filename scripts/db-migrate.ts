import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "../src/db/client";

async function main() {
  loadEnvConfig(process.cwd());
  const schema = await readFile(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(schema);
    await client.query("COMMIT");
    console.log("Esquema actualizado. Los snapshots existentes se conservaron.");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await db.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Falló la migración."); process.exitCode = 1; });
