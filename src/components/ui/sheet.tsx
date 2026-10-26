"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-[520px]",
  modal = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  modal?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()} modal={modal}>
      <Dialog.Portal>
        {modal ? <Dialog.Backdrop className="wm-backdrop fixed inset-0 z-50 bg-[#02060f]/75 backdrop-blur-[2px]" /> : null}
        <Dialog.Popup
          className={cn(
            "wm-drawer fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-y-auto border-l border-edge-strong bg-surface-1 shadow-[-24px_0_60px_-20px_rgba(0,0,0,.9)] outline-none",
            width,
          )}
        >
          <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-edge bg-surface-1/95 px-4 py-3.5 backdrop-blur">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[13.5px] font-semibold text-content">{title}</Dialog.Title>
              {subtitle ? <Dialog.Description className="mt-0.5 truncate font-mono text-[10.5px] text-content-faint">{subtitle}</Dialog.Description> : null}
            </div>
            <Dialog.Close
              aria-label="Cerrar detalle"
              className="wm-focus-ring grid size-7 shrink-0 place-items-center rounded-md border border-edge text-content-muted transition-colors hover:border-edge-strong hover:text-content"
            >
              <X className="size-3.5" />
            </Dialog.Close>
          </header>
          <div className="flex-1 px-4 py-4">{children}</div>
          {footer ? <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-edge bg-surface-1/95 px-4 py-3 backdrop-blur">{footer}</footer> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
