// Tests for the per-game localStorage helpers.
// Spec: ARCHITECTURE.md section 15.4
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCredits, saveCredits, loadStats, saveStats, recordHand,
  resetCredits, resetStats, DEFAULT_CREDITS, EMPTY_STATS,
  creditsKey, statsKey,
} from "./credits";
import { HandRank } from "./types";

class MemStore implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
}

beforeEach(() => {
  // @ts-expect-error — set up a minimal `window.localStorage` for the module
  globalThis.window = { localStorage: new MemStore() };
});

describe("credits — keys", () => {
  it("creditsKey is namespaced per game slug", () => {
    expect(creditsKey("jacks-or-better")).toBe("cards:jacks-or-better:credits");
    expect(creditsKey("deuces-wild")).toBe("cards:deuces-wild:credits");
  });
  it("statsKey is namespaced per game slug", () => {
    expect(statsKey("jacks-or-better")).toBe("cards:jacks-or-better:stats");
    expect(statsKey("deuces-wild")).toBe("cards:deuces-wild:stats");
  });
});

describe("credits — load/save round trip", () => {
  it("loadCredits returns DEFAULT_CREDITS when storage is empty", () => {
    expect(loadCredits("jacks-or-better")).toBe(DEFAULT_CREDITS);
  });
  it("saveCredits then loadCredits round-trips", () => {
    saveCredits("jacks-or-better", 1234);
    expect(loadCredits("jacks-or-better")).toBe(1234);
  });
  it("loadCredits guards against non-numeric values", () => {
    globalThis.window.localStorage.setItem(creditsKey("jacks-or-better"), '"hello"');
    expect(loadCredits("jacks-or-better")).toBe(DEFAULT_CREDITS);
  });
  it("loadCredits floors fractional values", () => {
    saveCredits("jacks-or-better", 99.7);
    expect(loadCredits("jacks-or-better")).toBe(99);
  });
});

describe("credits — stats round trip", () => {
  it("loadStats returns EMPTY_STATS when storage is empty", () => {
    expect(loadStats("jacks-or-better")).toEqual({ ...EMPTY_STATS, rankHits: {} });
  });
  it("saveStats then loadStats round-trips", () => {
    const stats = {
      handsPlayed: 50,
      totalWagered: 250,
      totalWon: 200,
      bestSingleWin: 100,
      rankHits: { [HandRank.FLUSH]: 3, [HandRank.FULL_HOUSE]: 1 },
    };
    saveStats("jacks-or-better", stats);
    expect(loadStats("jacks-or-better")).toEqual(stats);
  });
});

describe("credits — recordHand", () => {
  it("increments counters and updates bestSingleWin", () => {
    const next = recordHand(EMPTY_STATS, 5, 25, HandRank.TWO_PAIR);
    expect(next.handsPlayed).toBe(1);
    expect(next.totalWagered).toBe(5);
    expect(next.totalWon).toBe(25);
    expect(next.bestSingleWin).toBe(25);
    expect(next.rankHits[HandRank.TWO_PAIR]).toBe(1);
  });
  it("preserves bestSingleWin when a smaller win lands", () => {
    const after100 = recordHand(EMPTY_STATS, 5, 100, HandRank.FOUR_OF_A_KIND);
    const after10 = recordHand(after100, 5, 10, HandRank.JACKS_OR_BETTER);
    expect(after10.bestSingleWin).toBe(100);
  });
});

describe("credits — reset", () => {
  it("resetCredits restores DEFAULT_CREDITS", () => {
    saveCredits("jacks-or-better", 1);
    resetCredits("jacks-or-better");
    expect(loadCredits("jacks-or-better")).toBe(DEFAULT_CREDITS);
  });
  it("resetStats restores EMPTY_STATS", () => {
    saveStats("jacks-or-better", { handsPlayed: 99, totalWagered: 99, totalWon: 99, bestSingleWin: 99, rankHits: {} });
    resetStats("jacks-or-better");
    expect(loadStats("jacks-or-better")).toEqual({ ...EMPTY_STATS, rankHits: {} });
  });
  it("reset of one game does not affect the other", () => {
    saveCredits("jacks-or-better", 100);
    saveCredits("deuces-wild", 200);
    resetCredits("jacks-or-better");
    expect(loadCredits("jacks-or-better")).toBe(DEFAULT_CREDITS);
    expect(loadCredits("deuces-wild")).toBe(200);
  });
});
