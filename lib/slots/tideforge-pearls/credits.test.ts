// Tests for the slot-credits storage helpers.
// Spec: ARCHITECTURE.md §14.5 (local-only state schema), DECISIONS.md ADR-S4
import { describe, it, expect, beforeEach } from "vitest";
import {
  CREDITS_KEY,
  STATS_KEY,
  DEFAULT_CREDITS,
  EMPTY_STATS,
  loadCredits,
  saveCredits,
  loadStats,
  recordSpinStat,
  resetCredits,
  type SlotStats,
} from "./credits";

// Lightweight in-memory localStorage shim. Vitest runs Node by default, so
// `window` doesn't exist; we install a minimal shim before each test.
class MemStore {
  data = new Map<string, string>();
  getItem(k: string): string | null { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
  removeItem(k: string): void { this.data.delete(k); }
  clear(): void { this.data.clear(); }
}

beforeEach(() => {
  const w = globalThis as unknown as { window?: { localStorage: MemStore } };
  w.window = { localStorage: new MemStore() };
});

describe("credits — keys and defaults (ARCHITECTURE §14.5)", () => {
  it("uses the spec-mandated localStorage key shape", () => {
    expect(CREDITS_KEY).toBe("slots:tideforge-pearls:credits");
    expect(STATS_KEY).toBe("slots:tideforge-pearls:stats");
  });

  it("default starting balance is 1000 credits (ADR-S4)", () => {
    expect(DEFAULT_CREDITS).toBe(1000);
  });

  it("EMPTY_STATS has the spec-mandated shape with all zeros", () => {
    expect(EMPTY_STATS.spinsPlayed).toBe(0);
    expect(EMPTY_STATS.totalWagered).toBe(0);
    expect(EMPTY_STATS.totalWon).toBe(0);
    expect(EMPTY_STATS.bonusesTriggered).toBe(0);
    expect(EMPTY_STATS.bestSingleWin).toBe(0);
    expect(typeof EMPTY_STATS.lastResetAt).toBe("string");
  });
});

describe("credits — load/save round-trip", () => {
  it("loadCredits returns DEFAULT_CREDITS when key is unset", () => {
    expect(loadCredits()).toBe(DEFAULT_CREDITS);
  });

  it("save then load round-trips an integer", () => {
    saveCredits(742);
    expect(loadCredits()).toBe(742);
  });

  it("loadCredits clamps negative values to 0", () => {
    saveCredits(-50);
    expect(loadCredits()).toBe(0);
  });

  it("loadCredits returns DEFAULT_CREDITS on corrupt JSON", () => {
    const w = globalThis as unknown as { window: { localStorage: MemStore } };
    w.window.localStorage.setItem(CREDITS_KEY, "not-a-number");
    expect(loadCredits()).toBe(DEFAULT_CREDITS);
  });

  it("loadCredits floors fractional values to integer", () => {
    saveCredits(123.7);
    expect(loadCredits()).toBe(123);
  });
});

describe("credits — stats accumulation", () => {
  it("loadStats returns EMPTY_STATS when key is unset", () => {
    const s = loadStats();
    expect(s.spinsPlayed).toBe(0);
    expect(s.totalWagered).toBe(0);
    expect(s.totalWon).toBe(0);
  });

  it("recordSpinStat increments spinsPlayed and accumulates wager + win", () => {
    const next = recordSpinStat(EMPTY_STATS, { wager: 60, win: 100, bonusTriggered: false });
    expect(next.spinsPlayed).toBe(1);
    expect(next.totalWagered).toBe(60);
    expect(next.totalWon).toBe(100);
    expect(next.bonusesTriggered).toBe(0);
    expect(next.bestSingleWin).toBe(100);
  });

  it("recordSpinStat tracks bestSingleWin as a max over time", () => {
    let s: SlotStats = EMPTY_STATS;
    s = recordSpinStat(s, { wager: 60, win: 50, bonusTriggered: false });
    s = recordSpinStat(s, { wager: 60, win: 200, bonusTriggered: false });
    s = recordSpinStat(s, { wager: 60, win: 80, bonusTriggered: false });
    expect(s.bestSingleWin).toBe(200);
  });

  it("recordSpinStat increments bonusesTriggered when bonusTriggered is true", () => {
    let s: SlotStats = EMPTY_STATS;
    s = recordSpinStat(s, { wager: 60, win: 0, bonusTriggered: false });
    s = recordSpinStat(s, { wager: 60, win: 5000, bonusTriggered: true });
    s = recordSpinStat(s, { wager: 60, win: 0, bonusTriggered: false });
    s = recordSpinStat(s, { wager: 60, win: 200, bonusTriggered: true });
    expect(s.bonusesTriggered).toBe(2);
    expect(s.spinsPlayed).toBe(4);
  });

  it("recordSpinStat preserves lastResetAt across spins (only reset changes it)", () => {
    const start: SlotStats = { ...EMPTY_STATS, lastResetAt: "2026-05-01T00:00:00.000Z" };
    const next = recordSpinStat(start, { wager: 60, win: 0, bonusTriggered: false });
    expect(next.lastResetAt).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("credits — resetCredits", () => {
  it("resetCredits restores DEFAULT_CREDITS and zeros stats with a fresh lastResetAt", () => {
    saveCredits(50);
    const w = globalThis as unknown as { window: { localStorage: MemStore } };
    w.window.localStorage.setItem(STATS_KEY, JSON.stringify({
      spinsPlayed: 99, totalWagered: 5940, totalWon: 4000, bonusesTriggered: 3,
      bestSingleWin: 1500, lastResetAt: "2026-05-01T00:00:00.000Z",
    }));
    const before = Date.now();
    const result = resetCredits();
    const after = Date.now();

    expect(result.credits).toBe(DEFAULT_CREDITS);
    expect(result.stats.spinsPlayed).toBe(0);
    expect(result.stats.totalWagered).toBe(0);
    expect(result.stats.bestSingleWin).toBe(0);
    // lastResetAt was bumped to "now" within a second of the reset call.
    const t = Date.parse(result.stats.lastResetAt);
    expect(t).toBeGreaterThanOrEqual(before - 5);
    expect(t).toBeLessThanOrEqual(after + 5);

    // Persisted to localStorage too.
    expect(loadCredits()).toBe(DEFAULT_CREDITS);
    expect(loadStats().spinsPlayed).toBe(0);
  });
});
