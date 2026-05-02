"use client";
// A single playing-card face rendered as inline SVG.
// Suit + rank only. No theming knobs — uses the parent's CSS context for colors.

import * as React from "react";
import { Suit, Rank, type Card } from "@/lib/cards/video-poker";
import { cn } from "@/lib/utils";

const RANK_LABEL: Record<Rank, string> = {
  [Rank.TWO]: "2", [Rank.THREE]: "3", [Rank.FOUR]: "4", [Rank.FIVE]: "5",
  [Rank.SIX]: "6", [Rank.SEVEN]: "7", [Rank.EIGHT]: "8", [Rank.NINE]: "9",
  [Rank.TEN]: "10", [Rank.JACK]: "J", [Rank.QUEEN]: "Q", [Rank.KING]: "K",
  [Rank.ACE]: "A",
};

const SUIT_GLYPH: Record<Suit, string> = {
  [Suit.SPADES]: "♠",
  [Suit.HEARTS]: "♥",
  [Suit.DIAMONDS]: "♦",
  [Suit.CLUBS]: "♣",
};

const SUIT_COLOR_CLASS: Record<Suit, string> = {
  [Suit.SPADES]: "text-[var(--card-suit-black)]",
  [Suit.HEARTS]: "text-[var(--card-suit-red)]",
  [Suit.DIAMONDS]: "text-[var(--card-suit-red)]",
  [Suit.CLUBS]: "text-[var(--card-suit-black)]",
};

export interface CardFaceProps {
  card: Card;
  highlight?: "hold" | "win" | "wild" | null;
  className?: string;
}

export function CardFace({ card, highlight, className }: CardFaceProps) {
  const rankLabel = RANK_LABEL[card.rank];
  const suitGlyph = SUIT_GLYPH[card.suit];
  const ariaLabel = `${rankLabel} of ${card.suit === Suit.SPADES ? "spades" : card.suit === Suit.HEARTS ? "hearts" : card.suit === Suit.DIAMONDS ? "diamonds" : "clubs"}`;
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "card-face relative aspect-[2/3] w-full rounded-md border bg-[var(--card-face-bg)]",
        "flex flex-col items-center justify-between p-2 sm:p-3 select-none",
        SUIT_COLOR_CLASS[card.suit],
        highlight === "hold" && "card-face-hold",
        highlight === "win" && "card-face-win",
        highlight === "wild" && "card-face-wild",
        className,
      )}
    >
      <div className="self-start font-display text-xl sm:text-2xl font-bold leading-none">
        {rankLabel}
      </div>
      <div className="text-3xl sm:text-5xl leading-none" aria-hidden="true">{suitGlyph}</div>
      <div className="self-end font-display text-xl sm:text-2xl font-bold leading-none rotate-180">
        {rankLabel}
      </div>
    </div>
  );
}
