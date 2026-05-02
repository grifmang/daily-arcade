"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface BetSelectorProps {
  bet: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

export function BetSelector({ bet, onChange, disabled }: BetSelectorProps) {
  return (
    <div role="group" aria-label="Bet per hand" className="flex items-center gap-1">
      <span className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono mr-2">bet:</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          disabled={disabled}
          aria-pressed={bet === n}
          className={cn(
            "h-8 w-8 rounded-sm border font-mono text-sm",
            bet === n ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]" : "border-[var(--color-line-strong)] hover:border-[var(--color-fg)]",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
