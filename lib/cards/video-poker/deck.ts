// Deck creation and Fisher-Yates shuffle.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md sections 1, 11

import { Suit, Rank, type Card, type Deck } from "./types";
import type { SlotRng } from "./rng";

const SUITS: readonly Suit[] = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
const RANKS: readonly Rank[] = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
  Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE,
];

/** Build a fresh ordered 52-card deck (suit-major, rank-minor). */
export function createDeck(): Deck {
  const out: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      out.push({ suit, rank });
    }
  }
  return out;
}

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate input.
 * Bias-free given a bias-free `rng.nextInt`.
 */
export function shuffle(deck: Deck, rng: SlotRng): Deck {
  const out: Card[] = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
