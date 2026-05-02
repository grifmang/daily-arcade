// Tests for the hand evaluator — standard and wild modes.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md sections 3-4, 9
import { describe, it, expect } from "vitest";
import { evaluateHand } from "./evaluate";
import { Suit, Rank, HandRank, type Hand, type Card } from "./types";

// Compact card-builder helpers for readable golden vectors.
const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const S = Suit.SPADES, H = Suit.HEARTS, D = Suit.DIAMONDS, CL = Suit.CLUBS;
const T2 = Rank.TWO, T3 = Rank.THREE, T4 = Rank.FOUR, T5 = Rank.FIVE,
      T6 = Rank.SIX, T7 = Rank.SEVEN, T8 = Rank.EIGHT, T9 = Rank.NINE,
      TT = Rank.TEN, TJ = Rank.JACK, TQ = Rank.QUEEN, TK = Rank.KING,
      TA = Rank.ACE;
const hand = (a: Card, b: Card, cd: Card, d: Card, e: Card): Hand => [a, b, cd, d, e];

describe("evaluateHand — standard mode (Jacks or Better)", () => {
  // Royal Flush — golden vectors 1-4 (one per suit)
  it("Royal Flush — spades", () => {
    expect(evaluateHand(hand(c(TT,S), c(TJ,S), c(TQ,S), c(TK,S), c(TA,S)), { wildRank: null }))
      .toBe(HandRank.ROYAL_FLUSH);
  });
  it("Royal Flush — hearts", () => {
    expect(evaluateHand(hand(c(TT,H), c(TJ,H), c(TQ,H), c(TK,H), c(TA,H)), { wildRank: null }))
      .toBe(HandRank.ROYAL_FLUSH);
  });
  it("Royal Flush — diamonds", () => {
    expect(evaluateHand(hand(c(TT,D), c(TJ,D), c(TQ,D), c(TK,D), c(TA,D)), { wildRank: null }))
      .toBe(HandRank.ROYAL_FLUSH);
  });
  it("Royal Flush — clubs", () => {
    expect(evaluateHand(hand(c(TT,CL), c(TJ,CL), c(TQ,CL), c(TK,CL), c(TA,CL)), { wildRank: null }))
      .toBe(HandRank.ROYAL_FLUSH);
  });

  // Straight Flush — golden vectors 5-7
  it("Straight Flush (5-9 hearts)", () => {
    expect(evaluateHand(hand(c(T5,H), c(T6,H), c(T7,H), c(T8,H), c(T9,H)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT_FLUSH);
  });
  it("Ace-low Straight Flush (A-5 diamonds)", () => {
    expect(evaluateHand(hand(c(TA,D), c(T2,D), c(T3,D), c(T4,D), c(T5,D)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT_FLUSH);
  });
  it("Straight Flush (9-K spades)", () => {
    expect(evaluateHand(hand(c(T9,S), c(TT,S), c(TJ,S), c(TQ,S), c(TK,S)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT_FLUSH);
  });

  // Four of a Kind — golden vectors 8-9
  it("Four of a Kind (four aces + king)", () => {
    expect(evaluateHand(hand(c(TA,S), c(TA,H), c(TA,D), c(TA,CL), c(TK,S)), { wildRank: null }))
      .toBe(HandRank.FOUR_OF_A_KIND);
  });
  it("Four of a Kind (four sevens + two)", () => {
    expect(evaluateHand(hand(c(T7,S), c(T7,H), c(T7,D), c(T7,CL), c(T2,S)), { wildRank: null }))
      .toBe(HandRank.FOUR_OF_A_KIND);
  });

  // Full House — golden vectors 10-11
  it("Full House (three queens + pair of fives)", () => {
    expect(evaluateHand(hand(c(TQ,S), c(TQ,H), c(TQ,D), c(T5,CL), c(T5,S)), { wildRank: null }))
      .toBe(HandRank.FULL_HOUSE);
  });
  it("Full House (three threes + pair of kings)", () => {
    expect(evaluateHand(hand(c(T3,S), c(T3,H), c(T3,D), c(TK,CL), c(TK,S)), { wildRank: null }))
      .toBe(HandRank.FULL_HOUSE);
  });

  // Flush — golden vectors 12-13
  it("Flush (all clubs, not in sequence)", () => {
    expect(evaluateHand(hand(c(T2,CL), c(T5,CL), c(T7,CL), c(T9,CL), c(TJ,CL)), { wildRank: null }))
      .toBe(HandRank.FLUSH);
  });
  it("Flush (all hearts, not in sequence)", () => {
    expect(evaluateHand(hand(c(T3,H), c(T6,H), c(T8,H), c(TT,H), c(TK,H)), { wildRank: null }))
      .toBe(HandRank.FLUSH);
  });

  // Straight — golden vectors 14-16
  it("Straight (mixed suits, 4-8)", () => {
    expect(evaluateHand(hand(c(T4,S), c(T5,H), c(T6,D), c(T7,CL), c(T8,S)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT);
  });
  it("Ace-low Straight (A-5 mixed suits)", () => {
    expect(evaluateHand(hand(c(TA,S), c(T2,H), c(T3,D), c(T4,CL), c(T5,S)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT);
  });
  it("Ace-high Straight broadway (10-A mixed suits)", () => {
    expect(evaluateHand(hand(c(TT,S), c(TJ,H), c(TQ,D), c(TK,CL), c(TA,S)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT);
  });

  // Three of a Kind — golden vectors 17-18
  it("Three of a Kind (three sevens)", () => {
    expect(evaluateHand(hand(c(T7,S), c(T7,H), c(T7,D), c(TJ,CL), c(T2,S)), { wildRank: null }))
      .toBe(HandRank.THREE_OF_A_KIND);
  });
  it("Three of a Kind (three tens)", () => {
    expect(evaluateHand(hand(c(TT,S), c(TT,H), c(TT,D), c(T4,CL), c(T6,S)), { wildRank: null }))
      .toBe(HandRank.THREE_OF_A_KIND);
  });

  // Two Pair — golden vectors 19-20
  it("Two Pair (jacks and threes)", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(T3,D), c(T3,CL), c(TK,S)), { wildRank: null }))
      .toBe(HandRank.TWO_PAIR);
  });
  it("Two Pair (eights and fours)", () => {
    expect(evaluateHand(hand(c(T8,S), c(T8,H), c(T4,D), c(T4,CL), c(T9,S)), { wildRank: null }))
      .toBe(HandRank.TWO_PAIR);
  });

  // Jacks or Better — golden vectors 21-24
  it("Jacks or Better — pair of queens", () => {
    expect(evaluateHand(hand(c(TQ,S), c(TQ,H), c(T3,D), c(T5,CL), c(T7,S)), { wildRank: null }))
      .toBe(HandRank.JACKS_OR_BETTER);
  });
  it("Jacks or Better — pair of jacks", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(T4,D), c(T6,CL), c(T9,S)), { wildRank: null }))
      .toBe(HandRank.JACKS_OR_BETTER);
  });
  it("Jacks or Better — pair of kings", () => {
    expect(evaluateHand(hand(c(TK,S), c(TK,H), c(T2,D), c(T5,CL), c(T8,S)), { wildRank: null }))
      .toBe(HandRank.JACKS_OR_BETTER);
  });
  it("Jacks or Better — pair of aces", () => {
    expect(evaluateHand(hand(c(TA,S), c(TA,H), c(T3,D), c(T7,CL), c(TJ,S)), { wildRank: null }))
      .toBe(HandRank.JACKS_OR_BETTER);
  });

  // NONE — golden vectors 25-28
  it("NONE — pair of tens (below jacks)", () => {
    expect(evaluateHand(hand(c(TT,S), c(TT,H), c(T3,D), c(T5,CL), c(T7,S)), { wildRank: null }))
      .toBe(HandRank.NONE);
  });
  it("NONE — pair of nines (below jacks)", () => {
    expect(evaluateHand(hand(c(T9,S), c(T9,H), c(T2,D), c(T4,CL), c(T6,S)), { wildRank: null }))
      .toBe(HandRank.NONE);
  });
  it("NONE — high-card hand with no straight or flush", () => {
    expect(evaluateHand(hand(c(T2,S), c(T7,H), c(T9,D), c(TJ,CL), c(TK,S)), { wildRank: null }))
      .toBe(HandRank.NONE);
  });
  it("does NOT classify A-K-2-3-4 as a straight (no wraparound)", () => {
    expect(evaluateHand(hand(c(TA,S), c(TK,H), c(T2,D), c(T3,CL), c(T4,S)), { wildRank: null }))
      .toBe(HandRank.NONE);
  });
});

describe("evaluateHand — wild mode (Deuces Wild)", () => {
  const wildOpts = { wildRank: Rank.TWO };

  // Natural Royal Flush (no deuces) — golden vectors 29-30
  it("NATURAL_ROYAL_FLUSH (no deuces) — hearts", () => {
    expect(evaluateHand(hand(c(TT,H), c(TJ,H), c(TQ,H), c(TK,H), c(TA,H)), wildOpts))
      .toBe(HandRank.NATURAL_ROYAL_FLUSH);
  });
  it("NATURAL_ROYAL_FLUSH (no deuces) — spades", () => {
    expect(evaluateHand(hand(c(TT,S), c(TJ,S), c(TQ,S), c(TK,S), c(TA,S)), wildOpts))
      .toBe(HandRank.NATURAL_ROYAL_FLUSH);
  });

  // Four Deuces — golden vectors 31-32
  it("FOUR_DEUCES — all four 2s + king", () => {
    expect(evaluateHand(hand(c(T2,S), c(T2,H), c(T2,D), c(T2,CL), c(TK,S)), wildOpts))
      .toBe(HandRank.FOUR_DEUCES);
  });
  it("FOUR_DEUCES — all four 2s + 3 of clubs", () => {
    expect(evaluateHand(hand(c(T2,S), c(T2,H), c(T2,D), c(T2,CL), c(T3,CL)), wildOpts))
      .toBe(HandRank.FOUR_DEUCES);
  });

  // Wild Royal Flush — golden vectors 33-35
  it("WILD_ROYAL_FLUSH — J-Q-K-A hearts + 2 of clubs (deuce fills 10)", () => {
    expect(evaluateHand(hand(c(TJ,H), c(TQ,H), c(TK,H), c(TA,H), c(T2,CL)), wildOpts))
      .toBe(HandRank.WILD_ROYAL_FLUSH);
  });
  it("WILD_ROYAL_FLUSH — 10-J-Q-A spades + 2 of hearts (deuce fills K)", () => {
    expect(evaluateHand(hand(c(TT,S), c(TJ,S), c(TQ,S), c(T2,H), c(TA,S)), wildOpts))
      .toBe(HandRank.WILD_ROYAL_FLUSH);
  });
  it("WILD_ROYAL_FLUSH — 10-Q-K-A diamonds + 2 of clubs (deuce fills J)", () => {
    expect(evaluateHand(hand(c(TT,D), c(T2,CL), c(TQ,D), c(TK,D), c(TA,D)), wildOpts))
      .toBe(HandRank.WILD_ROYAL_FLUSH);
  });

  // Five of a Kind — golden vectors 36-38
  it("FIVE_OF_A_KIND — three kings + two deuces", () => {
    expect(evaluateHand(hand(c(TK,S), c(TK,H), c(TK,D), c(T2,CL), c(T2,S)), wildOpts))
      .toBe(HandRank.FIVE_OF_A_KIND);
  });
  it("FIVE_OF_A_KIND — four 8s + deuce", () => {
    expect(evaluateHand(hand(c(T8,S), c(T8,H), c(T8,D), c(T8,CL), c(T2,H)), wildOpts))
      .toBe(HandRank.FIVE_OF_A_KIND);
  });
  it("FIVE_OF_A_KIND — two queens + three deuces", () => {
    expect(evaluateHand(hand(c(TQ,S), c(TQ,H), c(T2,D), c(T2,CL), c(T2,S)), wildOpts))
      .toBe(HandRank.FIVE_OF_A_KIND);
  });

  // Straight Flush with wilds — golden vectors 39-40
  it("STRAIGHT_FLUSH (one deuce filling 7) — 5-6-2-8-9 spades", () => {
    expect(evaluateHand(hand(c(T5,S), c(T6,S), c(T2,D), c(T8,S), c(T9,S)), wildOpts))
      .toBe(HandRank.STRAIGHT_FLUSH);
  });
  it("STRAIGHT_FLUSH (one deuce filling 6) — 3-4-5-2-7 hearts", () => {
    expect(evaluateHand(hand(c(T3,H), c(T4,H), c(T5,H), c(T2,CL), c(T7,H)), wildOpts))
      .toBe(HandRank.STRAIGHT_FLUSH);
  });

  // Four of a Kind — golden vectors 41-43
  it("FOUR_OF_A_KIND (natural — no deuces) — four aces + king", () => {
    expect(evaluateHand(hand(c(TA,S), c(TA,H), c(TA,D), c(TA,CL), c(TK,S)), wildOpts))
      .toBe(HandRank.FOUR_OF_A_KIND);
  });
  it("FOUR_OF_A_KIND (one deuce) — three jacks + 2 + king", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(TJ,D), c(T2,CL), c(TK,S)), wildOpts))
      .toBe(HandRank.FOUR_OF_A_KIND);
  });
  it("FOUR_OF_A_KIND (two deuces) — two fives + two deuces + nine", () => {
    expect(evaluateHand(hand(c(T5,S), c(T5,H), c(T2,D), c(T2,CL), c(T9,S)), wildOpts))
      .toBe(HandRank.FOUR_OF_A_KIND);
  });

  // Full House — golden vectors 44-45
  it("FULL_HOUSE — three sevens + pair of jacks", () => {
    expect(evaluateHand(hand(c(T7,S), c(T7,H), c(T7,D), c(TJ,CL), c(TJ,S)), wildOpts))
      .toBe(HandRank.FULL_HOUSE);
  });
  it("FULL_HOUSE — pair of queens + pair of fives + deuce", () => {
    // Two pair plus a deuce — best assignment makes this a full house
    expect(evaluateHand(hand(c(TQ,S), c(TQ,H), c(T5,D), c(T5,CL), c(T2,S)), wildOpts))
      .toBe(HandRank.FULL_HOUSE);
  });

  // Flush — golden vectors 46-47
  it("FLUSH — all spades, no straight, no deuces", () => {
    expect(evaluateHand(hand(c(T3,S), c(T6,S), c(T8,S), c(TJ,S), c(TK,S)), wildOpts))
      .toBe(HandRank.FLUSH);
  });
  it("FLUSH — 4-7-9-K hearts + 2 of hearts (deuce as flush card or upgrade — best stays Flush)", () => {
    // The deuce here is in the same suit; substitution must pick the highest-paying
    // outcome. With 4♥-7♥-9♥-K♥ + 2♥, no straight is reachable; result stays FLUSH.
    expect(evaluateHand(hand(c(T4,H), c(T7,H), c(T9,H), c(T2,H), c(TK,H)), wildOpts))
      .toBe(HandRank.FLUSH);
  });

  // Straight — golden vectors 48-49
  it("STRAIGHT — 4-5-6-7-8 mixed suits, no deuces", () => {
    expect(evaluateHand(hand(c(T4,S), c(T5,H), c(T6,D), c(T7,CL), c(T8,S)), wildOpts))
      .toBe(HandRank.STRAIGHT);
  });
  it("STRAIGHT — 3-4-5-2-7 mixed suits (deuce as 6)", () => {
    expect(evaluateHand(hand(c(T3,S), c(T4,H), c(T5,D), c(T2,CL), c(T7,S)), wildOpts))
      .toBe(HandRank.STRAIGHT);
  });

  // Three of a Kind — golden vectors 50-51
  it("THREE_OF_A_KIND — pair of nines + deuce + off-cards", () => {
    expect(evaluateHand(hand(c(T9,S), c(T9,H), c(T2,D), c(T5,CL), c(T7,S)), wildOpts))
      .toBe(HandRank.THREE_OF_A_KIND);
  });
  it("THREE_OF_A_KIND — natural three jacks", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(TJ,D), c(T5,CL), c(T9,S)), wildOpts))
      .toBe(HandRank.THREE_OF_A_KIND);
  });

  // NONE — golden vectors 52-55
  it("NONE — pair of jacks (no deuces) — pairs do NOT pay in Deuces Wild", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(T3,D), c(T5,CL), c(T7,S)), wildOpts))
      .toBe(HandRank.NONE);
  });
  it("NONE — pair of aces (no deuces) — pairs do NOT pay in Deuces Wild", () => {
    expect(evaluateHand(hand(c(TA,S), c(TA,H), c(T4,D), c(T6,CL), c(T8,S)), wildOpts))
      .toBe(HandRank.NONE);
  });
  it("NONE — two pair (no deuces) — does NOT pay in Deuces Wild", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(T3,D), c(T3,CL), c(T7,S)), wildOpts))
      .toBe(HandRank.NONE);
  });
  it("NONE — high-card junk hand (no deuces, no straight, no flush)", () => {
    expect(evaluateHand(hand(c(T3,S), c(T7,H), c(T9,D), c(TJ,CL), c(TK,S)), wildOpts))
      .toBe(HandRank.NONE);
  });
});
