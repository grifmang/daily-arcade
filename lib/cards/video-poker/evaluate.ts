// Hand evaluator for video poker. Handles standard (JoB) and wild (Deuces) modes.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md sections 3-4

import { Rank, Suit, HandRank, type Card, type Hand } from "./types";

export interface EvaluateOptions {
  /** When non-null, that rank acts as a wild card (substitutes for any rank/suit). Use Rank.TWO for Deuces Wild. */
  wildRank: Rank | null;
}

export function evaluateHand(hand: Hand, opts: EvaluateOptions): HandRank {
  if (opts.wildRank == null) return evaluateStandard(hand);
  return evaluateWild(hand, opts.wildRank);
}

// ---------------------------------------------------------------------------
// Standard (no-wild) evaluation
// ---------------------------------------------------------------------------

function evaluateStandard(hand: Hand): HandRank {
  const ranks = hand.map(c => c.rank).sort((a, b) => a - b);
  const suits = hand.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(ranks);
  const isRoyalRanks =
    ranks[0] === Rank.TEN
    && ranks[1] === Rank.JACK
    && ranks[2] === Rank.QUEEN
    && ranks[3] === Rank.KING
    && ranks[4] === Rank.ACE;

  if (isFlush && isRoyalRanks) return HandRank.ROYAL_FLUSH;
  if (isFlush && isStraight) return HandRank.STRAIGHT_FLUSH;

  // Rank frequency histogram
  const freq = new Map<Rank, number>();
  for (const r of ranks) freq.set(r, (freq.get(r) ?? 0) + 1);
  const counts = [...freq.values()].sort((a, b) => b - a);

  if (counts[0] === 4) return HandRank.FOUR_OF_A_KIND;
  if (counts[0] === 3 && counts[1] === 2) return HandRank.FULL_HOUSE;
  if (isFlush) return HandRank.FLUSH;
  if (isStraight) return HandRank.STRAIGHT;
  if (counts[0] === 3) return HandRank.THREE_OF_A_KIND;
  if (counts[0] === 2 && counts[1] === 2) return HandRank.TWO_PAIR;

  // Pair — only pays as Jacks or Better if the pair rank is J/Q/K/A
  if (counts[0] === 2) {
    for (const [rank, count] of freq) {
      if (count === 2 && rank >= Rank.JACK) return HandRank.JACKS_OR_BETTER;
    }
  }

  return HandRank.NONE;
}

/** True if the 5 sorted ranks form a straight (consecutive, OR Ace-low A-2-3-4-5). */
function checkStraight(sortedRanks: readonly Rank[]): boolean {
  // Standard sequential
  let consecutive = true;
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i]! !== sortedRanks[i - 1]! + 1) { consecutive = false; break; }
  }
  if (consecutive) return true;

  // Ace-low special case: 2-3-4-5-A (sorted as [2,3,4,5,14])
  if (sortedRanks[0] === Rank.TWO && sortedRanks[1] === Rank.THREE
      && sortedRanks[2] === Rank.FOUR && sortedRanks[3] === Rank.FIVE
      && sortedRanks[4] === Rank.ACE) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Wild (deuce) evaluation
// ---------------------------------------------------------------------------

const ALL_RANKS: readonly Rank[] = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
  Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE,
];
const ALL_SUITS: readonly Suit[] = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];

function evaluateWild(hand: Hand, wildRank: Rank): HandRank {
  const wilds = hand.filter(c => c.rank === wildRank);
  const naturals = hand.filter(c => c.rank !== wildRank);

  // 4 wilds → always FOUR_DEUCES (regardless of fifth card)
  if (wilds.length === 4) return HandRank.FOUR_DEUCES;

  // 0 wilds → standard eval, then upgrade ROYAL_FLUSH to NATURAL_ROYAL_FLUSH;
  // demote pairs/two-pair (pairs do not pay in Deuces).
  if (wilds.length === 0) {
    const standard = evaluateStandard(hand);
    if (standard === HandRank.ROYAL_FLUSH) return HandRank.NATURAL_ROYAL_FLUSH;
    if (standard === HandRank.JACKS_OR_BETTER || standard === HandRank.TWO_PAIR) {
      return HandRank.NONE;
    }
    return standard;
  }

  // 1-3 wilds: enumerate substitutions, return the best resulting rank
  return bestWildSubstitution(naturals, wilds.length);
}

/**
 * Try every possible substitution for `wildCount` wild cards, evaluate
 * the resulting 5-card standard hand, and return the highest-paying
 * classification (with the Wild/Natural Royal split applied).
 *
 * For 1 wild: 52 substitutions. For 2 wilds: 52^2 = 2704. For 3: 52^3 = 140608.
 * Tractable for a per-hand evaluation; not in a Monte Carlo loop.
 */
function bestWildSubstitution(naturals: readonly Card[], wildCount: number): HandRank {
  let bestRank: HandRank = HandRank.NONE;

  // Generator over all 52^wildCount substitution tuples.
  const subs: Card[] = [];
  function recurse(): void {
    if (subs.length === wildCount) {
      const fullHand = [...naturals, ...subs] as Card[];
      const handTuple = fullHand as unknown as Hand;
      const standard = evaluateStandard(handTuple);
      const wildResult = upgradeForWildContext(standard, fullHand, wildCount);
      if (wildResult > bestRank) bestRank = wildResult;
      return;
    }
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        subs.push({ suit, rank });
        recurse();
        subs.pop();
      }
    }
  }
  recurse();
  return bestRank;
}

/**
 * Apply the wild-mode rank rewrite to a standard evaluation result, given
 * the substituted hand and the count of wilds used.
 *
 * - ROYAL_FLUSH with 1+ wilds → WILD_ROYAL_FLUSH
 * - 5 cards same rank → FIVE_OF_A_KIND (only reachable via wild substitution)
 * - JACKS_OR_BETTER and TWO_PAIR demote to NONE (pairs do not pay in Deuces)
 * - Otherwise the standard result passes through unchanged
 */
function upgradeForWildContext(standard: HandRank, fullHand: readonly Card[], wildCount: number): HandRank {
  if (standard === HandRank.ROYAL_FLUSH && wildCount > 0) return HandRank.WILD_ROYAL_FLUSH;

  // Five of a kind: any rank appearing 5 times across the substituted hand
  const freq = new Map<Rank, number>();
  for (const c of fullHand) freq.set(c.rank, (freq.get(c.rank) ?? 0) + 1);
  for (const count of freq.values()) {
    if (count === 5) return HandRank.FIVE_OF_A_KIND;
  }

  if (standard === HandRank.JACKS_OR_BETTER) return HandRank.NONE;
  if (standard === HandRank.TWO_PAIR) return HandRank.NONE;
  return standard;
}
