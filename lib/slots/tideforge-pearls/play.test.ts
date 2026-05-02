// Tests for the player-facing one-spin "play" helper that combines a base spin
// with optional bonus trace generation, ready for UI consumption.
import { describe, it, expect } from "vitest";
import { playSpin, type PlayResult } from "./play";
import { createSeededRng } from "./rng";
import { BET } from "./paytable";

describe("playSpin — return shape", () => {
  it("returns PlayResult with all required fields", () => {
    const r: PlayResult = playSpin(createSeededRng(1n));
    expect(r.baseGrid).toHaveLength(5);
    for (const col of r.baseGrid) expect(col).toHaveLength(4);
    expect(typeof r.baseWin).toBe("number");
    expect(typeof r.scatCount).toBe("number");
    expect(typeof r.bonusTriggered).toBe("boolean");
    expect(typeof r.bonusWin).toBe("number");
    expect(typeof r.bonusSpinCount).toBe("number");
    expect(typeof r.bonusFinalMeter).toBe("number");
    expect(typeof r.totalWin).toBe("number");
    // Bonus trace is always an array — empty when no bonus, non-empty when triggered.
    expect(Array.isArray(r.bonusTrace)).toBe(true);
  });

  it("totalWin = baseWin + bonusWin", () => {
    for (let s = 1n; s < 30n; s++) {
      const r = playSpin(createSeededRng(s));
      expect(r.totalWin).toBe(r.baseWin + r.bonusWin);
    }
  });

  it("non-trigger spins return an empty bonusTrace and bonusSpinCount=0", () => {
    // Find a non-trigger seed — most seeds don't trigger at ~0.65% trigger rate.
    for (let s = 1n; s < 1000n; s++) {
      const r = playSpin(createSeededRng(s));
      if (!r.bonusTriggered) {
        expect(r.bonusTrace).toEqual([]);
        expect(r.bonusSpinCount).toBe(0);
        expect(r.bonusWin).toBe(0);
        expect(r.bonusFinalMeter).toBe(0);
        return;
      }
    }
    throw new Error("Could not find a non-trigger seed in first 1000");
  });
});

describe("playSpin — bonus trace integrity (when triggered)", () => {
  it("a triggered bonus has a populated trace whose length matches bonusSpinCount", () => {
    // Search for a trigger seed.
    for (let s = 1n; s < 5000n; s++) {
      const r = playSpin(createSeededRng(s));
      if (r.bonusTriggered) {
        expect(r.bonusTrace.length).toBe(r.bonusSpinCount);
        expect(r.bonusSpinCount).toBeGreaterThanOrEqual(8); // 3+ scatters → 8 spins minimum
        return;
      }
    }
    throw new Error("Could not find a trigger seed in first 5000");
  });

  it("the sum of trace.spinWin equals bonusWin", () => {
    for (let s = 1n; s < 5000n; s++) {
      const r = playSpin(createSeededRng(s));
      if (r.bonusTriggered) {
        const summed = r.bonusTrace.reduce((acc, t) => acc + t.spinWin, 0);
        expect(summed).toBe(r.bonusWin);
        return;
      }
    }
  });

  it("trace meterAtStart values are monotonically non-decreasing", () => {
    for (let s = 1n; s < 5000n; s++) {
      const r = playSpin(createSeededRng(s));
      if (r.bonusTriggered && r.bonusTrace.length >= 2) {
        for (let i = 1; i < r.bonusTrace.length; i++) {
          const prev = r.bonusTrace[i - 1]!;
          const cur = r.bonusTrace[i]!;
          expect(cur.meterAtStart).toBeGreaterThanOrEqual(prev.meterAtStart);
        }
        return;
      }
    }
  });
});

describe("playSpin — determinism", () => {
  it("identical seeds produce identical PlayResults", () => {
    const a = playSpin(createSeededRng(20260501n));
    const b = playSpin(createSeededRng(20260501n));
    expect(a.totalWin).toBe(b.totalWin);
    expect(a.baseGrid).toEqual(b.baseGrid);
    expect(a.bonusTrace.length).toBe(b.bonusTrace.length);
  });

  it("the cost of a spin (the bet) is the BET constant", () => {
    expect(BET).toBe(60); // anchor: this is what the UI will subtract from credits
  });
});
