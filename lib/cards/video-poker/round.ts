// Round state machine for video poker.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md section 7
// Architecture: ARCHITECTURE.md section 15.6

import { type Card, type Hand, HandRank, Rank } from "./types";
import { createDeck, shuffle } from "./deck";
import type { SlotRng } from "./rng";
import { evaluateHand } from "./evaluate";
import { computePayout, type Paytable, DEUCES_PAYTABLE } from "./paytable";

export interface RoundStart {
  /** The 5-card initial hand dealt to the player. */
  hand: Hand;
  /** The remaining 47 cards (positions 5..51 of the shuffled deck). */
  remainingDeck: readonly Card[];
}

export interface RoundResult {
  /** The 5-card final hand after holds were resolved. */
  finalHand: Hand;
  /** Classification of the final hand. */
  handRank: HandRank;
  /** Credits awarded (already factors in bet and the 5-coin top-tier bonus). */
  payout: number;
}

/**
 * Start a new round: shuffle a fresh deck, deal 5 cards, return the initial hand
 * and the rest of the deck for use during the draw step.
 */
export function startRound(rng: SlotRng): RoundStart {
  const shuffled = shuffle(createDeck(), rng);
  const hand = shuffled.slice(0, 5) as unknown as Hand;
  const remainingDeck = shuffled.slice(5);
  return { hand, remainingDeck };
}

/**
 * Apply hold flags to the start of a round. Held cards stay; un-held cards
 * are replaced from the remaining deck (in order). The final hand is then
 * classified via the paytable's evaluator mode (wild for Deuces, standard otherwise),
 * and the payout is computed.
 */
export function applyHolds(
  start: { hand: Hand | readonly Card[]; remainingDeck: readonly Card[] },
  holds: readonly boolean[],
  paytable: Paytable,
  bet: number,
): RoundResult {
  if (holds.length !== 5) {
    throw new Error(`applyHolds: expected 5 hold flags (got ${holds.length})`);
  }

  const finalCards: Card[] = [];
  let drawCursor = 0;
  for (let i = 0; i < 5; i++) {
    if (holds[i]) {
      finalCards.push(start.hand[i]!);
    } else {
      const replacement = start.remainingDeck[drawCursor];
      if (replacement == null) {
        throw new Error(
          `applyHolds: not enough cards in remainingDeck (need ${5 - i}, have ${start.remainingDeck.length - drawCursor})`,
        );
      }
      finalCards.push(replacement);
      drawCursor++;
    }
  }
  const finalHand = finalCards as unknown as Hand;

  // Wild mode iff this is the Deuces paytable; otherwise standard mode.
  // Reference-equality contract: see paytable.ts header.
  const wildRank = paytable === DEUCES_PAYTABLE ? Rank.TWO : null;
  const handRank = evaluateHand(finalHand, { wildRank });
  const payout = computePayout(handRank, paytable, bet);

  return { finalHand, handRank, payout };
}
