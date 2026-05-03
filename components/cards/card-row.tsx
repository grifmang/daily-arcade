"use client";
import * as React from "react";
import { CardFace } from "./card-face";
import { CardBack } from "./card-back";
import type { Card } from "@/lib/cards/video-poker";
import { cn } from "@/lib/utils";

export interface CardRowProps {
  cards: ReadonlyArray<Card | null>;
  highlights?: ReadonlyArray<"hold" | "win" | "wild" | null>;
  motif?: "classic" | "deuce";
  /** When provided, cards render in VP-cabinet interactive mode */
  holds?: ReadonlyArray<boolean>;
  onToggleHold?: (index: number) => void;
  /** Disables all card interactions (idle / drawn phases) */
  holdDisabled?: boolean;
}

export function CardRow({
  cards,
  highlights,
  motif,
  holds,
  onToggleHold,
  holdDisabled,
}: CardRowProps) {
  const vpMode = onToggleHold != null;

  if (!vpMode) {
    // Legacy / static mode — simple grid, no hold interaction.
    return (
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {cards.map((card, i) => (
          <div key={i}>
            {card == null
              ? <CardBack motif={motif} />
              : <CardFace card={card} highlight={highlights?.[i] ?? null} />}
          </div>
        ))}
      </div>
    );
  }

  // VP Cabinet mode: click-to-hold cards with HELD banner above.
  return (
    <div className="grid grid-cols-5 gap-1.5" style={{ columnGap: "clamp(4px, 1vw, 10px)" }}>
      {cards.map((card, i) => {
        const held    = holds?.[i] ?? false;
        const hl      = highlights?.[i] ?? null;
        // "win" and "wild" are passed through to CardFace; "hold" is rendered
        // via the HELD banner + the existing aria-pressed outline, not via
        // the CardFace highlight prop.
        const faceHl: "win" | "wild" | null =
          hl === "win" ? "win" : hl === "wild" ? "wild" : null;

        return (
          <div key={i} className="flex flex-col gap-0.5">
            {/* HELD banner — always occupies space to prevent layout shift */}
            <div
              className={cn(
                "card-vp-held-banner",
                !held && "invisible",
              )}
              aria-hidden="true"
            >
              HELD
            </div>

            {/* Card — aspect ratio container */}
            <div className="relative w-full" style={{ paddingBottom: "140%" }}>
              <div className="absolute inset-0">
                {card == null ? (
                  <div className="card-vp-back w-full h-full" aria-hidden="true" />
                ) : (
                  <CardFace
                    card={card}
                    highlight={faceHl}
                    onClick={() => onToggleHold(i)}
                    held={held}
                    disabled={holdDisabled}
                    className="w-full h-full"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
