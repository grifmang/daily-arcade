"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface HoldToggleProps {
  held: boolean;
  onToggle: () => void;
  disabled?: boolean;
  position: number; // 1-5, for ARIA
}

export function HoldToggle({ held, onToggle, disabled, position }: HoldToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={held}
      aria-label={`${held ? "Release hold on" : "Hold"} card ${position}`}
      className={cn(
        "h-9 w-full rounded-sm border font-display text-xs uppercase tracking-wider",
        held ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]" : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {held ? "held" : "hold"}
    </button>
  );
}
