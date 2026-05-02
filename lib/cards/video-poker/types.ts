// Shared types for the video-poker engine.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md sections 1-2

export enum Suit {
  SPADES = "S",
  HEARTS = "H",
  DIAMONDS = "D",
  CLUBS = "C",
}

export enum Rank {
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14,
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

/** A 5-card dealt hand. Always exactly 5 cards. */
export type Hand = readonly [Card, Card, Card, Card, Card];

/** A 52-card deck (or remaining deck) as an ordered array. */
export type Deck = readonly Card[];

/**
 * Hand classification, ordered worst (NONE=0) to best within each mode.
 * Standard mode (JoB) returns 0..9. Wild mode (Deuces) returns
 * {0, 3..8} ∪ {10..13}; never returns ROYAL_FLUSH (9).
 */
export enum HandRank {
  NONE = 0,
  JACKS_OR_BETTER = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
  FIVE_OF_A_KIND = 10,
  FOUR_DEUCES = 11,
  WILD_ROYAL_FLUSH = 12,
  NATURAL_ROYAL_FLUSH = 13,
}

/** Display name for each rank, for UI consumption. */
export const HAND_RANK_NAME: Record<HandRank, string> = {
  [HandRank.NONE]: "no win",
  [HandRank.JACKS_OR_BETTER]: "jacks or better",
  [HandRank.TWO_PAIR]: "two pair",
  [HandRank.THREE_OF_A_KIND]: "three of a kind",
  [HandRank.STRAIGHT]: "straight",
  [HandRank.FLUSH]: "flush",
  [HandRank.FULL_HOUSE]: "full house",
  [HandRank.FOUR_OF_A_KIND]: "four of a kind",
  [HandRank.STRAIGHT_FLUSH]: "straight flush",
  [HandRank.ROYAL_FLUSH]: "royal flush",
  [HandRank.FIVE_OF_A_KIND]: "five of a kind",
  [HandRank.FOUR_DEUCES]: "four deuces",
  [HandRank.WILD_ROYAL_FLUSH]: "wild royal flush",
  [HandRank.NATURAL_ROYAL_FLUSH]: "natural royal flush",
};
