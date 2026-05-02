// Tests for the bonus state machine.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 6
import { describe, it, expect } from "vitest";
import {
  triggerSpins,
  retriggerSpins,
  buildConversionMap,
  rollWildMultsBonus,
  runBonus,
} from "./bonus";
import { Sym } from "./types";
import { createSeededRng } from "./rng";

describe("bonus — trigger amounts (spec §6.1)", () => {
  it("3 scatters award 8 free spins", () => {
    expect(triggerSpins(3)).toBe(8);
  });

  it("4 scatters award 15 free spins", () => {
    expect(triggerSpins(4)).toBe(15);
  });

  it("5 scatters award 20 free spins", () => {
    expect(triggerSpins(5)).toBe(20);
  });

  it("6+ scatters cap at 20 free spins (5+ tier)", () => {
    expect(triggerSpins(6)).toBe(20);
    expect(triggerSpins(20)).toBe(20);
  });

  it("0/1/2 scatters award 0 spins (no trigger)", () => {
    expect(triggerSpins(0)).toBe(0);
    expect(triggerSpins(1)).toBe(0);
    expect(triggerSpins(2)).toBe(0);
  });
});

describe("bonus — retriggers (spec §6.4)", () => {
  it("2 scatters mid-bonus add 5 spins", () => {
    expect(retriggerSpins(2)).toBe(5);
  });

  it("3+ scatters mid-bonus re-add the full trigger amount (8/15/20)", () => {
    expect(retriggerSpins(3)).toBe(8);
    expect(retriggerSpins(4)).toBe(15);
    expect(retriggerSpins(5)).toBe(20);
  });

  it("0 or 1 scatter does not retrigger", () => {
    expect(retriggerSpins(0)).toBe(0);
    expect(retriggerSpins(1)).toBe(0);
  });
});

describe("bonus — conversion map (spec §6.3)", () => {
  it("meter < 4 returns null (no conversion)", () => {
    expect(buildConversionMap(0)).toBeNull();
    expect(buildConversionMap(3)).toBeNull();
  });

  it("meter >= 4 converts ANGLER -> PEARL only", () => {
    const m = buildConversionMap(4);
    expect(m).toEqual({ [Sym.ANGLER]: Sym.PEARL });
  });

  it("meter >= 8 converts ANGLER and SQUID -> PEARL", () => {
    const m = buildConversionMap(8);
    expect(m).toEqual({ [Sym.ANGLER]: Sym.PEARL, [Sym.SQUID]: Sym.PEARL });
  });

  it("meter >= 13 converts ANGLER, SQUID, COELA -> PEARL (no MANTA conversion)", () => {
    const m = buildConversionMap(13);
    expect(m).toEqual({
      [Sym.ANGLER]: Sym.PEARL,
      [Sym.SQUID]: Sym.PEARL,
      [Sym.COELA]: Sym.PEARL,
    });
    // MANTA must NOT be in the map.
    expect((m as Record<number, number>)[Sym.MANTA]).toBeUndefined();
  });

  it("meter >= 20 (way past final threshold) still does not convert MANTA (spec §6.3)", () => {
    const m = buildConversionMap(20);
    expect((m as Record<number, number>)[Sym.MANTA]).toBeUndefined();
    expect((m as Record<number, number>)[Sym.COELA]).toBe(Sym.PEARL);
  });
});

describe("bonus — wild multiplier rules (spec §6.2)", () => {
  it("a column with no wild contributes multiplier 1", () => {
    const grid = [
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL], // no wild
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
    ];
    const rng = createSeededRng(1n);
    const mults = rollWildMultsBonus(grid, rng);
    expect(mults[1]).toBe(1);
    expect(mults[2]).toBe(1);
    expect(mults[3]).toBe(1);
  });

  it("a column with one wild contributes either x2 or x3 (not 1)", () => {
    const grid = [
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.WILD,  Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
    ];
    const rng = createSeededRng(1n);
    const mults = rollWildMultsBonus(grid, rng);
    expect([2, 3]).toContain(mults[1]);
    expect(mults[2]).toBe(1);
    expect(mults[3]).toBe(1);
  });

  it("a column with THREE wilds still rolls only ONE multiplier (no within-column compound, spec §6.2)", () => {
    const grid = [
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.WILD,  Sym.WILD,  Sym.WILD,  Sym.PEARL], // 3 wilds in col 2
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
    ];
    const rng = createSeededRng(1n);
    const mults = rollWildMultsBonus(grid, rng);
    // Even with 3 wilds, the column rolls a single 2 or 3 — never 4, 6, 8, 9, 27, etc.
    expect([2, 3]).toContain(mults[2]);
  });

  it("wilds are only rolled on cols 1/2/3 (the wild-eligible columns); cols 0 and 4 stay at 1", () => {
    // Even if a wild somehow appeared on col 0 or 4 (impossible with real strips),
    // rollWildMultsBonus must not contribute a multiplier on those columns.
    const grid = [
      [Sym.WILD,  Sym.PEARL, Sym.PEARL, Sym.PEARL], // col 0
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.WILD,  Sym.PEARL, Sym.PEARL, Sym.PEARL], // col 4
    ];
    const rng = createSeededRng(1n);
    const mults = rollWildMultsBonus(grid, rng);
    expect(mults[0]).toBe(1);
    expect(mults[4]).toBe(1);
  });

  it("rollWildMultsBonus is deterministic given the same seed", () => {
    const grid = [
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.WILD,  Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.WILD,  Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.WILD,  Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.PEARL, Sym.PEARL, Sym.PEARL, Sym.PEARL],
    ];
    const a = rollWildMultsBonus(grid, createSeededRng(99n));
    const b = rollWildMultsBonus(grid, createSeededRng(99n));
    expect(a).toEqual(b);
  });
});

describe("bonus — runBonus state machine (spec §6)", () => {
  it("a bonus session terminates when spins run out (no retriggers)", () => {
    // Use a fixed seed; the locked bonus reels make retriggers rare so most sessions
    // terminate at the initial spin count.
    const rng = createSeededRng(20260501n);
    const result = runBonus(rng, 8); // 3-scat trigger
    expect(result.bonusSpinCount).toBeGreaterThanOrEqual(8);
    expect(result.bonusSpinCount).toBeLessThanOrEqual(500); // safety cap from spec §6.4
    expect(result.totalWin).toBeGreaterThanOrEqual(0);
    expect(result.finalMeter).toBeGreaterThanOrEqual(0);
  });

  it("runBonus is deterministic given the same seed and trigger amount", () => {
    const a = runBonus(createSeededRng(42n), 15);
    const b = runBonus(createSeededRng(42n), 15);
    expect(a.totalWin).toBe(b.totalWin);
    expect(a.bonusSpinCount).toBe(b.bonusSpinCount);
    expect(a.finalMeter).toBe(b.finalMeter);
  });

  it("meter accumulates from per-spin PEARL counts; never decreases", () => {
    const rng = createSeededRng(7n);
    const result = runBonus(rng, 20, { trace: true });
    // Reconstruct meter progression from the trace
    let m = 0;
    for (const t of result.trace ?? []) {
      // Meter at start of spin t is the cumulative PEARL count from prior spins.
      // The trace records the meter value used to build the conversion map for that spin.
      expect(t.meterAtStart).toBeGreaterThanOrEqual(m);
      m = t.meterAtStart + t.pearlsThisSpin;
    }
    expect(result.finalMeter).toBe(m);
  });

  it("conversion at meter=8 fires once SQUID converts; SQUID symbols then pay as PEARL on subsequent spins", () => {
    // We assert the contract via runBonus's trace: any spin where meterAtStart >= 8
    // must use a conversion map that includes SQUID -> PEARL.
    const rng = createSeededRng(20260501n);
    const result = runBonus(rng, 20, { trace: true });
    for (const t of result.trace ?? []) {
      if (t.meterAtStart >= 8) {
        expect(t.conversionMap).toBeTruthy();
        expect(t.conversionMap?.[Sym.SQUID]).toBe(Sym.PEARL);
      }
      if (t.meterAtStart >= 13) {
        expect(t.conversionMap?.[Sym.COELA]).toBe(Sym.PEARL);
      }
      // MANTA must never convert (spec §6.3)
      expect(t.conversionMap?.[Sym.MANTA]).toBeUndefined();
    }
  });

  it("safety cap at 500 spins is never exceeded", () => {
    // Run many bonus sessions with diverse seeds; assert the safety cap holds.
    for (let s = 1; s < 50; s++) {
      const r = runBonus(createSeededRng(BigInt(s)), 20);
      expect(r.bonusSpinCount).toBeLessThanOrEqual(500);
    }
  });
});
