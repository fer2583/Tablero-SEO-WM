"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Bell,
  Brain,
  ChevronDown,
  Command as CommandIcon,
  FileText,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  RefreshCw,
  Rows3,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Command } from "cmdk";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import type { IntegrationFilters } from "@/lib/integrations";
import { cn } from "@/lib/utils";
import { FilterContext, type ConfigurationSource, type ConfigurationState, type FilterContextValue, type Density } from "./filter-context";
import { Button } from "./ui/button";
import { LiveDot } from "./ui/badge";

const navItems = [
  { href: "/", label: "Resumen", icon: LayoutDashboard, hint: "Vista general del estado SEO" },
  { href: "/search-console", label: "Search Console", icon: Search, hint: "Rendimiento de búsqueda orgánica" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, hint: "El tráfico que mueve el negocio" },
  { href: "/ai-search", label: "AI Search", icon: Sparkles, hint: "Tráfico y menciones en asistentes de IA" },
  { href: "/intelligence", label: "Intelligence", icon: Brain, hint: "Señales priorizadas por impacto" },
  { href: "/auditoria-tecnica", label: "Auditoría técnica", icon: ShieldCheck, hint: "Salud técnica, PageSpeed y CrUX" },
  { href: "/keywords", label: "Keywords", icon: Target, hint: "El lenguaje de tu audiencia" },
  { href: "/contenido", label: "Contenido", icon: FileText, hint: "Contenido que encuentra personas" },
  { href: "/alertas", label: "Alertas", icon: Bell, hint: "Señales para actuar a tiempo" },
  { href: "/configuracion", label: "Configuración", icon: Settings2, hint: "Estado real de las conexiones" },
] as const;

const configurationCacheKey = "whalemate:configuration:v1";
const densityKey = "whalemate:density:v1";
const densityEvent = "whalemate:density-change";

function readDensity(): Density {
  try {
    return localStorage.getItem(densityKey) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

function subscribeDensity(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(densityEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(densityEvent, onChange);
  };
}

function persistDensity(next: Density) {
  try {
    localStorage.setItem(densityKey, next);
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  window.dispatchEvent(new Event(densityEvent));
}
let configurationRequest: Promise<{ sources: ConfigurationSource[] }> | null = null;

function loadConfiguration() {
  if (!configurationRequest) {
    configurationRequest = fetch("/api/configuration", { cache: "no-store" }).then(async (response) => {
      const data = (await response.json()) as { sources?: ConfigurationSource[]; error?: string };
      if (!response.ok || !data.sources) throw new Error(data.error ?? "No se pudo consultar la configuración.");
      return { sources: data.sources };
    });
  }
  return configurationRequest;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="wm-app grid min-h-screen place-items-center text-content-muted">Cargando dashboard…</div>}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const density = useSyncExternalStore(subscribeDensity, readDensity, () => "comfortable" as Density);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [configuration, setConfiguration] = useState<FilterContextValue["configuration"]>({ status: "loading", sources: [] });

  const rawDays = Number(searchParams.get("days"));
  const defaultDays = pathname.startsWith("/search-console") ? 30 : 28;
  const filters: IntegrationFilters = {
    days: ([7, 28, 30, 60, 90].includes(rawDays) ? rawDays : defaultDays) as IntegrationFilters["days"],
    language: (searchParams.get("language") ?? "all") as IntegrationFilters["language"],
    country: searchParams.get("country") ?? "all",
    device: (searchParams.get("device") ?? "all") as IntegrationFilters["device"],
    page: searchParams.get("page") ?? undefined,
    query: searchParams.get("query") ?? undefined,
    compare: (searchParams.get("compare") === "year" ? "year" : "previous") as IntegrationFilters["compare"],
  };

  const updateFilter = useCallback(
    (key: keyof IntegrationFilters, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
      router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (configuration.status !== "loading") return;
    let cancelled = false;
    const resolve = async () => {
      try {
        const cached = sessionStorage.getItem(configurationCacheKey);
        const parsed = cached ? (JSON.parse(cached) as { sources?: ConfigurationSource[] }) : null;
        if (parsed?.sources) {
          if (!cancelled) setConfiguration({ status: "ready", sources: parsed.sources });
          return;
        }
      } catch {
        /* Storage can be unavailable in private browsing. */
      }
      try {
        const data = await loadConfiguration();
        try {
          sessionStorage.setItem(configurationCacheKey, JSON.stringify(data));
        } catch {
          /* Storage can be unavailable in private browsing. */
        }
        if (!cancelled) setConfiguration({ status: "ready", sources: data.sources });
      } catch (reason) {
        if (!cancelled) setConfiguration({ status: "error", sources: [], error: reason instanceof Error ? reason.message : "Error de conexión." });
      }
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [configuration.status]);

  const setDensity = useCallback((next: Density) => {
    persistDensity(next);
  }, []);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const context: FilterContextValue = {
    filters,
    refreshKey,
    updateFilter,
    refresh,
    configuration,
    density,
    setDensity,
    openCommand: () => setCommandOpen(true),
  };

  const activeItem = navItems.find((item) => isActive(pathname, item.href)) ?? navItems[0];

  return (
    <FilterContext.Provider value={context}>
      <div className="wm-app flex min-h-screen">
        <Sidebar pathname={pathname} configuration={configuration} />

        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              className="fixed inset-0 z-50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
              <motion.div
                className="absolute inset-y-0 left-0 w-[280px] border-r border-edge bg-surface-1"
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
              >
                <SidebarContent pathname={pathname} configuration={configuration} onNavigate={() => setMobileOpen(false)} />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-edge bg-surface-0/85 backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-full max-w-[1560px] items-center gap-3 px-4 sm:px-6 lg:px-10">
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}>
                <Menu size={18} />
              </Button>

              <div className="flex min-w-0 items-center gap-2.5">
                <span className="hidden text-[11px] text-content-faint sm:inline">SEO Control Center</span>
                <span className="hidden text-content-faint sm:inline">/</span>
                <span className="truncate text-[13px] font-medium text-content">{activeItem.label}</span>
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => setCommandOpen(true)}
                  className="group hidden h-9 items-center gap-2 rounded-lg border border-edge bg-surface-2 px-3 text-[12px] text-content-faint transition-colors hover:border-edge-strong hover:text-content-muted sm:flex"
                >
                  <Search size={14} />
                  <span>Buscar o navegar</span>
                  <kbd className="ml-3 rounded border border-edge bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-content-muted">⌘K</kbd>
                </button>

                <Button variant="ghost" size="icon" aria-label="Abrir paleta de comandos" className="sm:hidden" onClick={() => setCommandOpen(true)}>
                  <CommandIcon size={17} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={density === "compact" ? "Usar densidad cómoda" : "Usar densidad compacta"}
                  title={density === "compact" ? "Densidad compacta" : "Densidad cómoda"}
                  onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
                >
                  <Rows3 size={17} className={density === "compact" ? "text-accent" : undefined} />
                </Button>

                <Button variant="ghost" size="icon" aria-label="Actualizar datos" title="Actualizar datos" onClick={refresh}>
                  <RefreshCw size={17} />
                </Button>

                <span className="ml-1 hidden items-center gap-1.5 rounded-md border border-edge bg-surface-2 px-2 py-1 text-[10px] text-content-muted md:flex">
                  <LiveDot />
                  Fuentes reales
                </span>

                <Button variant="ghost" size="icon" aria-label="Notificaciones" className="relative">
                  <Bell size={17} />
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-negative" />
                </Button>

                <span className="ml-1 grid size-8 place-items-center rounded-full border border-edge bg-surface-3 text-[10px] font-semibold text-content">WM</span>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1560px] flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-10">{children}</main>
        </div>
      </div>

      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={(href) => {
          setCommandOpen(false);
          router.push(href);
        }}
        onRefresh={() => {
          refresh();
          setCommandOpen(false);
          toast.success("Datos actualizados", { description: "Se volvió a consultar la fuente seleccionada." });
        }}
        onToggleDensity={() => {
          const next = density === "compact" ? "comfortable" : "compact";
          setDensity(next);
          setCommandOpen(false);
          toast(`Densidad ${next === "compact" ? "compacta" : "cómoda"}`, { description: "La preferencia se guarda en este navegador." });
        }}
        onPeriod={(days) => {
          updateFilter("days", String(days));
          setCommandOpen(false);
          toast(`Período: últimos ${days} días`);
        }}
      />
    </FilterContext.Provider>
  );
}

function Sidebar({ pathname, configuration }: { pathname: string; configuration: ConfigurationState }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 border-r border-edge bg-surface-1 lg:block">
      <SidebarContent pathname={pathname} configuration={configuration} />
    </aside>
  );
}

function SidebarContent({
  pathname,
  configuration,
  onNavigate,
}: {
  pathname: string;
  configuration: ConfigurationState;
  onNavigate?: () => void;
}) {
  const connected = configuration.sources.filter((source) => source.status === "connected" || source.status === "configured").length;
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className="flex items-center justify-between px-2">
        <Link href="/" className="flex items-center" onClick={onNavigate}>
          <Image src="/whalemate-logo-header.webp" alt="WhaleMate" width={168} height={26} priority className="h-auto w-[168px] brightness-0 invert" />
        </Link>
        {onNavigate ? (
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar menú" onClick={onNavigate}>
            <X size={16} />
          </Button>
        ) : null}
      </div>

      <div className="mt-6 flex items-center gap-2.5 rounded-lg border border-edge bg-surface-2 p-2.5">
        <span className="grid size-8 place-items-center rounded-md bg-accent-soft text-[12px] font-bold text-accent">W</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-content">WhaleMate</span>
          <span className="block truncate text-[10px] text-content-faint">whalemate.com</span>
        </span>
        <ChevronDown size={14} className="text-content-faint" />
      </div>

      <nav aria-label="Navegación principal" className="mt-5 flex flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors",
                active ? "text-content" : "text-content-muted hover:bg-surface-2 hover:text-content",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="wm-nav-active"
                  className="absolute inset-0 rounded-lg border border-edge bg-surface-3"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Icon size={16} className={cn("relative shrink-0", active ? "text-accent" : "text-content-faint")} />
              <span className="relative truncate">{label}</span>
              {active ? <span className="relative ml-auto size-1.5 rounded-full bg-accent" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        <Link
          href="/intelligence"
          onClick={onNavigate}
          className="group block w-full rounded-lg border border-accent/25 bg-accent-soft p-3 text-left transition-colors hover:border-accent/45"
        >
          <span className="flex items-center gap-2 text-[11px] font-medium text-accent">
            <Sparkles size={13} /> Intelligence
          </span>
          <span className="mt-1.5 block text-[10.5px] leading-relaxed text-content-muted">
            Señales priorizadas por impacto.
          </span>
        </Link>

        <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface-2 px-2.5 py-2">
          <LiveDot tone={configuration.status === "error" ? "negative" : connected ? "positive" : "caution"} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10.5px] text-content-muted">
              {configuration.status === "loading" ? "Verificando fuentes…" : `${connected} fuentes conectadas`}
            </span>
            <span className="block truncate text-[9.5px] text-content-faint">Datos reales, sin mocks</span>
          </span>
          <PanelLeftClose size={13} className="text-content-faint" />
        </div>

        <button className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2">
          <span className="grid size-7 place-items-center rounded-full border border-edge bg-surface-3 text-[9.5px] font-semibold text-content">WM</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] text-content">WhaleMate</span>
            <span className="block truncate text-[9.5px] text-content-faint">SEO Team</span>
          </span>
          <ChevronDown size={13} className="text-content-faint" />
        </button>
      </div>
    </div>
  );
}

function CommandMenu({
  open,
  onOpenChange,
  onNavigate,
  onRefresh,
  onToggleDensity,
  onPeriod,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (href: string) => void;
  onRefresh: () => void;
  onToggleDensity: () => void;
  onPeriod: (days: number) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="wm-backdrop fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <Dialog.Popup className="wm-dialog fixed left-1/2 top-[14vh] z-[61] w-[min(640px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-edge-strong bg-surface-1 shadow-[0_40px_120px_-20px_rgba(0,0,0,.9)]">
          <Dialog.Title className="sr-only">Paleta de comandos</Dialog.Title>
          <Command label="Paleta de comandos" loop className="flex flex-col">
            <div className="flex items-center gap-2.5 border-b border-edge px-4">
              <Search size={16} className="text-content-faint" />
              <Command.Input
                autoFocus
                placeholder="Buscar secciones, acciones o períodos…"
                className="h-12 w-full bg-transparent text-[13px] text-content outline-none placeholder:text-content-faint"
              />
              <kbd className="rounded border border-edge bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-content-faint">esc</kbd>
            </div>
            <Command.List className="max-h-[52vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-[12px] text-content-faint">Sin resultados.</Command.Empty>

              <Command.Group heading="Navegar" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-content-faint">
                {navItems.map(({ href, label, icon: Icon, hint }) => (
                  <Command.Item
                    key={href}
                    value={`${label} ${hint}`}
                    onSelect={() => onNavigate(href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-content-muted aria-selected:bg-surface-3 aria-selected:text-content"
                  >
                    <Icon size={15} className="text-content-faint" />
                    <span>{label}</span>
                    <span className="ml-auto hidden text-[10.5px] text-content-faint sm:block">{hint}</span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Separator className="my-1.5 h-px bg-edge" />

              <Command.Group heading="Período" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-content-faint">
                {[7, 28, 30, 90].map((days) => (
                  <Command.Item
                    key={days}
                    value={`últimos ${days} días período ${days}`}
                    onSelect={() => onPeriod(days)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-content-muted aria-selected:bg-surface-3 aria-selected:text-content"
                  >
                    <span className="text-content-faint">◷</span>
                    Últimos {days} días
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Separator className="my-1.5 h-px bg-edge" />

              <Command.Group heading="Acciones" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-content-faint">
                <Command.Item
                  value="actualizar datos refresh recargar"
                  onSelect={onRefresh}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-content-muted aria-selected:bg-surface-3 aria-selected:text-content"
                >
                  <RefreshCw size={15} className="text-content-faint" />
                  Actualizar datos
                </Command.Item>
                <Command.Item
                  value="densidad compacta cómoda"
                  onSelect={onToggleDensity}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-content-muted aria-selected:bg-surface-3 aria-selected:text-content"
                >
                  <Rows3 size={15} className="text-content-faint" />
                  Alternar densidad
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
