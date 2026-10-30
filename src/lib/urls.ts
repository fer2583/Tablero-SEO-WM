/**
 * Clave estable para cruzar URLs de GSC (absolutas) con landing pages de GA4
 * (a menudo sólo path). Sin esto el cruce por igualdad de string pierde páginas
 * por protocolo, `www`, slash final, query o fragmento.
 */
export function pageKey(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://placeholder.invalid");
    let path = decodeURIComponent(url.pathname);
    path = path.replace(/\/+$/, "");
    return (path || "/").toLowerCase();
  } catch {
    const withoutQuery = raw.split("?")[0].split("#")[0];
    const path = withoutQuery.replace(/\/+$/, "");
    return (path || "/").toLowerCase();
  }
}

/** Devuelve la URL canónica para mostrar, preservando la original. */
export function displayUrl(input: string | null | undefined): string {
  return (input ?? "").trim();
}
