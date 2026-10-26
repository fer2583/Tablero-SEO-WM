"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_8px_24px_-12px_rgba(61,123,255,.9)] hover:bg-accent-strong",
        secondary: "border border-edge bg-surface-3 text-content hover:bg-surface-4",
        outline: "border border-edge bg-transparent text-content-muted hover:border-edge-strong hover:text-content",
        ghost: "text-content-muted hover:bg-surface-3 hover:text-content",
        danger: "border border-negative/40 bg-negative/10 text-negative hover:bg-negative/20",
      },
      size: {
        sm: "h-8 px-3 text-[12px]",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
