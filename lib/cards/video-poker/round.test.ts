// Tests for the round state machine.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md section 7
// Architecture: ARCHITECTURE.md section 15.6
import { describe, it, expect } from "vitest";
import { startRound, applyHolds } from "./round";
import { JOB_PAYTABLE } from "./paytable";
import { createSeededRng } from "./rng";
import { HandRank, Rank, Suit } from "./types";

describe("round — startRound", () => {
  it("returns a 5-card initial hand and the remaining 47-card deck", () => {
    const r = startRound(createSeededRng(20260501n));
    expect(r.hand).toHaveLength(5);
    expect(r.remainingDeck).toHaveLength(47);
  });

  it("is deterministic given the same seed", () => {
    const a = startRound(createSeededRng(7n));
    const b = startRound(createSeededRng(7n));
    expect(a.hand).toEqual(b.hand);
    expect(a.remainingDeck).toEqual(b.remainingDeck);
  });
});

describe("round — applyHolds", () => {
  it("with all 5 cards held, returns the same hand", () => {
    const start = startRound(createSeededRng(1n));
    const result = applyHolds(start, [true, true, true, true, true], JOB_PAYTABLE, 5);
    expect(result.finalHand).toEqual(start.hand);
  });

  it("with all 5 cards discarded, returns 5 fresh cards from the remaining deck", () => {
    const start = startRound(createSeededRng(2n));
    const result = applyHolds(start, [false, false, false, false, false], JOB_PAYTABLE, 5);
    // Final hand should be the first 5 cards of remainingDeck
    expect(result.finalHand).toEqual(start.remainingDeck.slice(0, 5));
  });

  it("with 2 held + 3 discarded, the 3 discarded slots are replaced by remainingDeck[0..2] in order", () => {
    const start = startRound(createSeededRng(3n));
    const holds = [true, false, true, false, false];
    const result = applyHolds(start, holds, JOB_PAYTABLE, 5);
    // Held positions stay
    expect(result.finalHand[0]).toEqual(start.hand[0]);
    expect(result.finalHand[2]).toEqual(start.hand[2]);
    // Discarded positions replaced with deck[0], deck[1], deck[2] in order
    expect(result.finalHand[1]).toEqual(start.remainingDeck[0]);
    expect(result.finalHand[3]).toEqual(start.remainingDeck[1]);
    expect(result.finalHand[4]).toEqual(start.remainingDeck[2]);
  });

  it("classifies the final hand and computes the payout via the supplied paytable + bet", () => {
    const start = startRound(createSeededRng(20260501n));
    const result = applyHolds(start, [false, false, false, false, false], JOB_PAYTABLE, 5);
    expect(result.handRank).toBeGreaterThanOrEqual(HandRank.NONE);
    expect(result.handRank).toBeLessThanOrEqual(HandRank.NATURAL_ROYAL_FLUSH);
    expect(result.payout).toBeGreaterThanOrEqual(0);
  });

  it("computes JoB Royal Flush payout correctly for bet=5 (4000 credits)", () => {
    // Manually construct a Royal Flush hand by short-circuiting the round.
    const start = {
      hand: [
        { suit: Suit.SPADES, rank: Rank.TEN },
        { suit: Suit.SPADES, rank: Rank.JACK },
        { suit: Suit.SPADES, rank: Rank.QUEEN },
        { suit: Suit.SPADES, rank: Rank.KING },
        { suit: Suit.SPADES, rank: Rank.ACE },
      ] as const,
      remainingDeck: [],
    };
    const result = applyHolds(start, [true, true, true, true, true], JOB_PAYTABLE, 5);
    expect(result.handRank).toBe(HandRank.ROYAL_FLUSH);
    expect(result.payout).toBe(4000);
  });

  it("throws when holds.length is not exactly 5", () => {
    const start = startRound(createSeededRng(1n));
    expect(() => applyHolds(start, [true, true, true], JOB_PAYTABLE, 1)).toThrow();
  });
});
