// Transcription tests for the locked paytables, plus computePayout tests.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md sections 5, 10
import { describe, it, expect } from "vitest";
import { JOB_PAYTABLE, DEUCES_PAYTABLE, computePayout } from "./paytable";
import { HandRank } from "./types";

describe("JOB_PAYTABLE — 9/6 Jacks or Better", () => {
  const cases: ReadonlyArray<[HandRank, number]> = [
    [HandRank.NONE, 0],
    [HandRank.JACKS_OR_BETTER, 1],
    [HandRank.TWO_PAIR, 2],
    [HandRank.THREE_OF_A_KIND, 3],
    [HandRank.STRAIGHT, 4],
    [HandRank.FLUSH, 6],
    [HandRank.FULL_HOUSE, 9],
    [HandRank.FOUR_OF_A_KIND, 25],
    [HandRank.STRAIGHT_FLUSH, 50],
    [HandRank.ROYAL_FLUSH, 250],
  ];
  for (const [rank, expected] of cases) {
    it(`${HandRank[rank]} pays ${expected}`, () => {
      expect(JOB_PAYTABLE[rank]).toBe(expected);
    });
  }
  it("wild-mode ranks are 0 in JoB paytable", () => {
    expect(JOB_PAYTABLE[HandRank.FIVE_OF_A_KIND]).toBe(0);
    expect(JOB_PAYTABLE[HandRank.FOUR_DEUCES]).toBe(0);
    expect(JOB_PAYTABLE[HandRank.WILD_ROYAL_FLUSH]).toBe(0);
    expect(JOB_PAYTABLE[HandRank.NATURAL_ROYAL_FLUSH]).toBe(0);
  });
});

describe("DEUCES_PAYTABLE — NSUD Deuces Wild", () => {
  const cases: ReadonlyArray<[HandRank, number]> = [
    [HandRank.NONE, 0],
    [HandRank.THREE_OF_A_KIND, 1],
    [HandRank.STRAIGHT, 2],
    [HandRank.FLUSH, 2],
    [HandRank.FULL_HOUSE, 3],
    [HandRank.FOUR_OF_A_KIND, 4],
    [HandRank.STRAIGHT_FLUSH, 13],
    [HandRank.FIVE_OF_A_KIND, 16],
    [HandRank.WILD_ROYAL_FLUSH, 25],
    [HandRank.FOUR_DEUCES, 200],
    [HandRank.NATURAL_ROYAL_FLUSH, 250],
  ];
  for (const [rank, expected] of cases) {
    it(`${HandRank[rank]} pays ${expected}`, () => {
      expect(DEUCES_PAYTABLE[rank]).toBe(expected);
    });
  }
  it("standard pair / two-pair / standard royal do not pay in Deuces", () => {
    expect(DEUCES_PAYTABLE[HandRank.JACKS_OR_BETTER]).toBe(0);
    expect(DEUCES_PAYTABLE[HandRank.TWO_PAIR]).toBe(0);
    expect(DEUCES_PAYTABLE[HandRank.ROYAL_FLUSH]).toBe(0);
  });
});

describe("computePayout", () => {
  it("scales linearly with bet for non-top-tier hands (JoB Four of a Kind)", () => {
    expect(computePayout(HandRank.FOUR_OF_A_KIND, JOB_PAYTABLE, 1)).toBe(25);
    expect(computePayout(HandRank.FOUR_OF_A_KIND, JOB_PAYTABLE, 2)).toBe(50);
    expect(computePayout(HandRank.FOUR_OF_A_KIND, JOB_PAYTABLE, 3)).toBe(75);
    expect(computePayout(HandRank.FOUR_OF_A_KIND, JOB_PAYTABLE, 4)).toBe(100);
    expect(computePayout(HandRank.FOUR_OF_A_KIND, JOB_PAYTABLE, 5)).toBe(125);
  });
  it("scales linearly with bet for non-top-tier hands (Deuces Four Deuces)", () => {
    expect(computePayout(HandRank.FOUR_DEUCES, DEUCES_PAYTABLE, 1)).toBe(200);
    expect(computePayout(HandRank.FOUR_DEUCES, DEUCES_PAYTABLE, 5)).toBe(1000);
  });
  it("JoB Royal Flush: 250, 500, 750, 1000, 4000 at bets 1..5", () => {
    expect(computePayout(HandRank.ROYAL_FLUSH, JOB_PAYTABLE, 1)).toBe(250);
    expect(computePayout(HandRank.ROYAL_FLUSH, JOB_PAYTABLE, 2)).toBe(500);
    expect(computePayout(HandRank.ROYAL_FLUSH, JOB_PAYTABLE, 3)).toBe(750);
    expect(computePayout(HandRank.ROYAL_FLUSH, JOB_PAYTABLE, 4)).toBe(1000);
    expect(computePayout(HandRank.ROYAL_FLUSH, JOB_PAYTABLE, 5)).toBe(4000);
  });
  it("Deuces Natural Royal Flush: 250, 500, 750, 1000, 4000 at bets 1..5", () => {
    expect(computePayout(HandRank.NATURAL_ROYAL_FLUSH, DEUCES_PAYTABLE, 1)).toBe(250);
    expect(computePayout(HandRank.NATURAL_ROYAL_FLUSH, DEUCES_PAYTABLE, 2)).toBe(500);
    expect(computePayout(HandRank.NATURAL_ROYAL_FLUSH, DEUCES_PAYTABLE, 3)).toBe(750);
    expect(computePayout(HandRank.NATURAL_ROYAL_FLUSH, DEUCES_PAYTABLE, 4)).toBe(1000);
    expect(computePayout(HandRank.NATURAL_ROYAL_FLUSH, DEUCES_PAYTABLE, 5)).toBe(4000);
  });
  it("Deuces Wild Royal Flush does NOT trigger the bet-5 bonus (pays 25 × 5 = 125)", () => {
    expect(computePayout(HandRank.WILD_ROYAL_FLUSH, DEUCES_PAYTABLE, 5)).toBe(125);
  });
  it("NONE always pays 0 regardless of bet", () => {
    expect(computePayout(HandRank.NONE, JOB_PAYTABLE, 1)).toBe(0);
    expect(computePayout(HandRank.NONE, JOB_PAYTABLE, 5)).toBe(0);
    expect(computePayout(HandRank.NONE, DEUCES_PAYTABLE, 5)).toBe(0);
  });
  it("throws on bet=0", () => {
    expect(() => computePayout(HandRank.FLUSH, JOB_PAYTABLE, 0)).toThrow();
  });
  it("throws on bet=6", () => {
    expect(() => computePayout(HandRank.FLUSH, JOB_PAYTABLE, 6)).toThrow();
  });
  it("throws on fractional bet", () => {
    expect(() => computePayout(HandRank.FLUSH, JOB_PAYTABLE, 1.5)).toThrow();
  });
  it("throws on negative bet", () => {
    expect(() => computePayout(HandRank.FLUSH, JOB_PAYTABLE, -1)).toThrow();
  });
});
