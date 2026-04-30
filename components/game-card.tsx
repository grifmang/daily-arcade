"use client";
import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useCompletedToday } from "@/lib/hooks/use-streak";
import { GAME_LABELS, GAME_TAGLINES, GAME_GLYPHS, type GameId } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCENTS: Record<GameId, string> = {
  "word-volley": "text-[var(--color-tile-green)]",
  "drift-2049": "text-[var(--color-cyan)]",
  "snap-trivia": "text-[var(--color-amber)]",
};

export function GameCard({ gameId }: { gameId: GameId }) {
  const completed = useCompletedToday();
  const isDone = !!completed[gameId];
  return (
    <Link
      href={`/g/${gameId}`}
      className={cn(
        "group relative flex items-center justify-between gap-4 p-5 sm:p-6",
        "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-elevated)]",
        "hover:border-[var(--color-line-strong)] hover:bg-[var(--color-bg-overlay)]",
        "transition-colors duration-[var(--motion-fast)]",
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <span
          aria-hidden
          className={cn(
            "grid place-items-center w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-bg)]",
            "border border-[var(--color-line-strong)] text-2xl",
            ACCENTS[gameId],
          )}
        >
          {GAME_GLYPHS[gameId]}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-lg sm:text-xl truncate">{GAME_LABELS[gameId]}</h3>
            {isDone && (
              <span
                className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-good)]"
                aria-label="Completed today"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                done
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-fg-muted)] truncate">{GAME_TAGLINES[gameId]}</p>
        </div>
      </div>
      <ChevronRight
        className="w-5 h-5 text-[var(--color-fg-dim)] group-hover:text-[var(--color-accent)] group-hover:translate-x-0.5 transition-transform"
        aria-hidden
      />
    </Link>
  );
}
