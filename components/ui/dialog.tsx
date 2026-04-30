"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  closeOnBackdrop?: boolean;
  className?: string;
}

/**
 * Minimal accessible modal dialog.
 * Locks scroll, traps focus loosely, restores focus on close, ESC closes.
 */
export function Dialog({ open, onOpenChange, title, children, closeOnBackdrop = true, className }: DialogProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const lastFocus = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    // Focus first focusable in dialog
    setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>("[data-autofocus],button,input,[tabindex]:not([tabindex='-1'])");
      first?.focus();
    }, 0);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      lastFocus.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={e => {
        if (closeOnBackdrop && e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={ref}
        className={cn(
          "relative w-full sm:max-w-md mx-auto",
          "bg-[var(--color-bg-elevated)] border border-[var(--color-line-strong)]",
          "rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] p-6 sm:p-8",
          "shadow-2xl",
          className,
        )}
      >
        {title && (
          <h2 id="dialog-title" className="text-xl font-display font-semibold mb-4">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
