// Locked paytables for 9/6 Jacks or Better and NSUD Deuces Wild.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md section 5
//
// These values are widely-published facts about standard casino paytables;
// they encode no copyrightable creative expression.
//
// LOAD-BEARING: the paytable constants are looked up by reference identity
// in two places — `TOP_TIER_BY_PAYTABLE.get(paytable)` below (for the bet=5
// Royal Flush bonus) and `paytable === DEUCES_PAYTABLE` in round.ts (for
// wild-mode evaluator routing). Do NOT spread, shallow-copy, or hand-roll a
// Paytable-shaped value — pass these constants directly. If you need a
// third paytable variant, add it as a new exported constant here, register
// it in TOP_TIER_BY_PAYTABLE if it has a top-tier bet-5 bonus, and update
// round.ts's wild-mode detection if it uses wilds.

import { HandRank } from "./types";

/** Per-coin payout for a hand at bet=1. Top tier (Royal Flush variants) is replaced by 4000 at bet=5. */
export type Paytable = Readonly<Record<HandRank, number>>;

/** 9/6 Jacks or Better. ~99.54% RTP under optimal-strategy play. */
export const JOB_PAYTABLE: Paytable = Object.freeze({
  [HandRank.NONE]: 0,
  [HandRank.JACKS_OR_BETTER]: 1,
  [HandRank.TWO_PAIR]: 2,
  [HandRank.THREE_OF_A_KIND]: 3,
  [HandRank.STRAIGHT]: 4,
  [HandRank.FLUSH]: 6,
  [HandRank.FULL_HOUSE]: 9,
  [HandRank.FOUR_OF_A_KIND]: 25,
  [HandRank.STRAIGHT_FLUSH]: 50,
  [HandRank.ROYAL_FLUSH]: 250,
  [HandRank.FIVE_OF_A_KIND]: 0,
  [HandRank.FOUR_DEUCES]: 0,
  [HandRank.WILD_ROYAL_FLUSH]: 0,
  [HandRank.NATURAL_ROYAL_FLUSH]: 0,
});

/** NSUD ("Not So Ugly Deuces") Deuces Wild. ~99.73% RTP under optimal-strategy play. */
export const DEUCES_PAYTABLE: Paytable = Object.freeze({
  [HandRank.NONE]: 0,
  [HandRank.JACKS_OR_BETTER]: 0,
  [HandRank.TWO_PAIR]: 0,
  [HandRank.THREE_OF_A_KIND]: 1,
  [HandRank.STRAIGHT]: 2,
  [HandRank.FLUSH]: 2,
  [HandRank.FULL_HOUSE]: 3,
  [HandRank.FOUR_OF_A_KIND]: 4,
  [HandRank.STRAIGHT_FLUSH]: 13,
  [HandRank.ROYAL_FLUSH]: 0,
  [HandRank.FIVE_OF_A_KIND]: 16,
  [HandRank.FOUR_DEUCES]: 200,
  [HandRank.WILD_ROYAL_FLUSH]: 25,
  [HandRank.NATURAL_ROYAL_FLUSH]: 250,
});

/** Top-tier rank that triggers the 5-coin bonus (jumps from 250×5=1250 to 4000). */
export const TOP_TIER_BY_PAYTABLE: ReadonlyMap<Paytable, HandRank> = new Map([
  [JOB_PAYTABLE, HandRank.ROYAL_FLUSH],
  [DEUCES_PAYTABLE, HandRank.NATURAL_ROYAL_FLUSH],
]);

/** Compute the credit payout for a (rank, paytable, bet) combination. */
export function computePayout(rank: HandRank, paytable: Paytable, bet: number): number {
  if (!Number.isInteger(bet) || bet < 1 || bet > 5) {
    throw new Error(`computePayout: bet must be integer 1..5 (got ${bet})`);
  }
  const perCoin = paytable[rank];
  const topTier = TOP_TIER_BY_PAYTABLE.get(paytable);
  if (bet === 5 && topTier != null && rank === topTier) {
    return 4000;
  }
  return perCoin * bet;
}
