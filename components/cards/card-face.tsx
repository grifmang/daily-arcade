"use client";
// A single playing-card face — rank+suit glyphs only, no character art.
// Supports two modes:
//   1. Static display (no onClick) — just a div with role="img"
//   2. Click-to-hold (onClick provided) — rendered as <button aria-pressed>

import * as React from "react";
import { Suit, Rank, type Card } from "@/lib/cards/video-poker";
import { cn } from "@/lib/utils";

const RANK_LABEL: Record<Rank, string> = {
  [Rank.TWO]:   "2",  [Rank.THREE]: "3",  [Rank.FOUR]:  "4",
  [Rank.FIVE]:  "5",  [Rank.SIX]:   "6",  [Rank.SEVEN]: "7",
  [Rank.EIGHT]: "8",  [Rank.NINE]:  "9",  [Rank.TEN]:   "10",
  [Rank.JACK]:  "J",  [Rank.QUEEN]: "Q",  [Rank.KING]:  "K",
  [Rank.ACE]:   "A",
};

const SUIT_GLYPH: Record<Suit, string> = {
  [Suit.SPADES]:   "♠",
  [Suit.HEARTS]:   "♥",
  [Suit.DIAMONDS]: "♦",
  [Suit.CLUBS]:    "♣",
};

const SUIT_NAME: Record<Suit, string> = {
  [Suit.SPADES]:   "spades",
  [Suit.HEARTS]:   "hearts",
  [Suit.DIAMONDS]: "diamonds",
  [Suit.CLUBS]:    "clubs",
};

function isRed(suit: Suit) {
  return suit === Suit.HEARTS || suit === Suit.DIAMONDS;
}

export interface CardFaceProps {
  card: Card;
  /** Visual highlight state */
  highlight?: "hold" | "win" | "wild" | null;
  className?: string;
  /** Cabinet-VP mode: if provided, card renders as a clickable <button> */
  onClick?: () => void;
  /** aria-pressed value for the hold-button mode */
  held?: boolean;
  /** Disables click interaction (e.g. during draw or idle phase) */
  disabled?: boolean;
}

export function CardFace({ card, highlight, className, onClick, held, disabled }: CardFaceProps) {
  const rankLabel = RANK_LABEL[card.rank];
  const suitGlyph = SUIT_GLYPH[card.suit];
  const suitName  = SUIT_NAME[card.suit];
  const red       = isRed(card.suit);
  const ariaLabel = onClick
    ? `${rankLabel} of ${suitName}${held ? " — held" : ""}`
    : `${rankLabel} of ${suitName}`;

  // Suit color inline — uses VP tokens when available, falls back to legacy.
  const suitColor = red
    ? "color: var(--card-vp-suit-red, var(--card-suit-red))"
    : "color: var(--card-vp-suit-black, var(--card-suit-black))";

  // Shared inner content
  const inner = (
    <>
      {/* Top-left rank + suit */}
      <div
        className="absolute top-[5%] left-[8%] flex flex-col items-center leading-none"
        aria-hidden="true"
      >
        <span className="font-bold text-[clamp(0.85rem,2.4vw,1.6rem)] leading-none">{rankLabel}</span>
        <span className="text-[clamp(0.7rem,2vw,1.3rem)] leading-none">{suitGlyph}</span>
      </div>
      {/* Center suit glyph */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="text-[clamp(1.8rem,5vw,3.4rem)] leading-none">{suitGlyph}</span>
      </div>
      {/* Bottom-right rank + suit (rotated) */}
      <div
        className="absolute bottom-[5%] right-[8%] flex flex-col items-center leading-none rotate-180"
        aria-hidden="true"
      >
        <span className="font-bold text-[clamp(0.85rem,2.4vw,1.6rem)] leading-none">{rankLabel}</span>
        <span className="text-[clamp(0.7rem,2vw,1.3rem)] leading-none">{suitGlyph}</span>
      </div>
    </>
  );

  const sharedStyle = { style: { [red ? "--suit-color" : "--suit-color"]: "" } };
  void sharedStyle;

  if (onClick) {
    // Cabinet VP mode: interactive button for click-to-hold.
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={held ?? false}
        aria-label={ariaLabel}
        className={cn(
          "card-vp-face relative w-full",
          // aspect ratio enforced by parent container
          highlight === "win"  && "card-vp-face-win",
          highlight === "wild" && "card-vp-face-wild",
          disabled && "cursor-default",
          className,
        )}
        style={{ color: red ? "var(--card-vp-suit-red, #c1331a)" : "var(--card-vp-suit-black, #0a0b10)" } as React.CSSProperties}
      >
        {inner}
      </button>
    );
  }

  // Static display mode (no interaction).
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "card-face relative aspect-[2/3] w-full rounded-md border bg-[var(--card-face-bg)]",
        "flex flex-col items-center justify-between p-2 sm:p-3 select-none",
        highlight === "hold" && "card-face-hold",
        highlight === "win"  && "card-face-win",
        highlight === "wild" && "card-face-wild",
        className,
      )}
      style={{ color: red ? "var(--card-suit-red)" : "var(--card-suit-black)" } as React.CSSProperties}
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
