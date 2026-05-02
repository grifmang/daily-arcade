"use client";
import * as React from "react";
import { CardFace } from "./card-face";
import { CardBack } from "./card-back";
import type { Card } from "@/lib/cards/video-poker";

export interface CardRowProps {
  cards: ReadonlyArray<Card | null>; // null = face-down (during deal animation)
  highlights?: ReadonlyArray<"hold" | "win" | "wild" | null>;
  motif?: "classic" | "deuce";
}

export function CardRow({ cards, highlights, motif }: CardRowProps) {
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
