import { NextResponse } from "next/server";
import { AuditConflict } from "../../db/audit-store";
import { databaseConfigured } from "../snapshot-refresh";

export class AuditInputError extends Error {}
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
export function runId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AuditInputError("Identificador de auditoría inválido.");
  return id;
}
export async function readInput(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) throw new AuditInputError("Solicitud de otro origen rechazada.");
  const reader = request.body?.getReader();
  if (!reader) return {};
  let text = ""; let size = 0;
  try {
    const decoder = new TextDecoder();
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 64_000) { await reader.cancel(); throw new AuditInputError("Solicitud demasiado grande."); } text += decoder.decode(value, { stream: true }); }
    text += decoder.decode();
    const value = text ? JSON.parse(text) : {};
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch (error) { if (error instanceof AuditInputError) throw error; throw new AuditInputError("JSON inválido."); }
  finally { reader.releaseLock(); }
}
export async function auditHttp(action: () => Promise<Response>) {
  if (!databaseConfigured()) return json({ error: "Configura DATABASE_URL y ejecuta npm run db:migrate para habilitar las auditorías persistidas." }, 503);
  try { return await action(); }
  catch (error) {
    if (error instanceof AuditInputError) return json({ error: error.message }, 400);
    if (error instanceof AuditConflict) return json({ error: error.message }, 409);
    console.error("Audit operation failed:", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "La auditoría no está disponible. Verifica la conexión y aplica src/db/schema.sql (npm run db:migrate)." }, 503);
  }
}
