"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ToastInfo {
  id: number;
  text: string;
  tone?: "default" | "success" | "error";
}

const ToastContext = React.createContext<{
  push: (text: string, tone?: ToastInfo["tone"]) => void;
}>({ push: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastInfo[]>([]);
  const push = React.useCallback((text: string, tone: ToastInfo["tone"] = "default") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col items-center sm:items-end gap-2"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto rounded-[var(--radius-md)] border px-4 py-3 text-sm font-mono shadow-lg",
              "bg-[var(--color-bg-elevated)] border-[var(--color-line-strong)] text-[var(--color-fg)]",
              t.tone === "success" && "border-[var(--color-good)] text-[var(--color-good)]",
              t.tone === "error" && "border-[var(--color-bad)] text-[var(--color-bad)]",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}
