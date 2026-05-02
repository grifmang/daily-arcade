"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface BetSelectorProps {
  bet: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  /** Render the VP-cabinet BET UP / BET MAX button pair (default: false = legacy 1-5 grid) */
  vpMode?: boolean;
}

export function BetSelector({ bet, onChange, disabled, vpMode }: BetSelectorProps) {
  if (vpMode) {
    // VP Cabinet mode: BET UP (cycle 1→2→3→4→5→1) and BET MAX (jump to 5).
    function betUp() {
      onChange(bet >= 5 ? 1 : bet + 1);
    }
    function betMax() {
      onChange(5);
    }
    return (
      <>
        <button
          type="button"
          onClick={betUp}
          disabled={disabled}
          aria-label={`Bet up — current bet ${bet}`}
          className={cn("btn-vp", disabled && "opacity-45 cursor-not-allowed")}
        >
          BET UP
        </button>
        <button
          type="button"
          onClick={betMax}
          disabled={disabled}
          aria-label="Bet max — set bet to 5"
          className={cn("btn-vp", disabled && "opacity-45 cursor-not-allowed")}
        >
          BET MAX
        </button>
      </>
    );
  }

  // Legacy mode: 1-5 button grid.
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
            bet === n
              ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]"
              : "border-[var(--color-line-strong)] hover:border-[var(--color-fg)]",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
