"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        closeButton
        toastOptions={{
          style: {
            background: "#0a1b3a",
            border: "1px solid #2a4d82",
            color: "#e9f0ff",
          },
        }}
      />
    </NuqsAdapter>
  );
}
