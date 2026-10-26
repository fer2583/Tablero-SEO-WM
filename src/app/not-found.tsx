import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-0 px-6 text-content">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-faint">Error 404</p>
        <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight">Esta página no existe</h1>
        <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-content-muted">
          La sección que buscás no está disponible en el tablero.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex h-8 items-center rounded-lg border border-edge bg-surface-3 px-3 text-[12px] font-medium text-content transition-colors hover:bg-surface-4"
        >
          Volver al resumen
        </Link>
      </div>
    </div>
  );
}
