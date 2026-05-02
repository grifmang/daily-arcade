// Tests for the 1024-ways evaluator.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 5
import { describe, it, expect } from "vitest";
import { evaluateWays } from "./ways";
import { Sym, type SymbolId } from "./types";

// Helper: build a 5x4 grid (column-major) from a compact array of arrays.
// Each inner array is one column of 4 cells (top to bottom).
function grid(cols: SymbolId[][]): SymbolId[][] {
  if (cols.length !== 5) throw new Error("grid needs 5 columns");
  for (const c of cols) if (c.length !== 4) throw new Error("each column needs 4 rows");
  return cols.map((c) => [...c]);
}

const fillCol = (s: SymbolId): SymbolId[] => [s, s, s, s];

describe("evaluateWays — basic semantics (spec §5)", () => {
  it("returns 0 win on an empty/all-LOW grid that has no run on reel 1", () => {
    // LOW is on reel 1 — pays at 3OAK
    const g = grid([fillCol(Sym.LOW), fillCol(Sym.HIGH), fillCol(Sym.HIGH), fillCol(Sym.HIGH), fillCol(Sym.HIGH)]);
    const r = evaluateWays(g);
    // LOW only on reel 1, runLen would be 1 -> no pay
    // HIGH absent on reel 1 -> no HIGH pay
    expect(r.totalWin).toBe(0);
    expect(r.scatCount).toBe(0);
  });

  it("all-PEARL grid pays exactly 105 * 1024 = 107520 (5OAK PEARL with full ways)", () => {
    const g = grid([
      fillCol(Sym.PEARL),
      fillCol(Sym.PEARL),
      fillCol(Sym.PEARL),
      fillCol(Sym.PEARL),
      fillCol(Sym.PEARL),
    ]);
    const r = evaluateWays(g);
    expect(r.totalWin).toBe(105 * 1024);
    expect(r.scatCount).toBe(0);
  });

  it("PEARL run of 3 isolated, no other paying lines -> exactly the PEARL 3OAK pay", () => {
    // To isolate PEARL: reel 1 is all PEARL (so no other symbol can run from reel 1),
    // reels 2 and 3 each have a PEARL only in row 0 with non-tier filler everywhere else.
    // Use LOW filler to avoid creating MANTA/HIGH/etc. runs.
    // Reel 4 is non-PEARL, breaking the PEARL run.
    const g = grid([
      fillCol(Sym.PEARL),
      [Sym.PEARL, Sym.LOW, Sym.LOW, Sym.LOW],
      [Sym.PEARL, Sym.LOW, Sym.LOW, Sym.LOW],
      fillCol(Sym.HIGH),  // run-breaker (HIGH not on reel 1, so no HIGH pay)
      fillCol(Sym.HIGH),
    ]);
    const r = evaluateWays(g);
    // PEARL counts: [4,1,1,0,0] -> runLen 3, ways 4*1*1 = 4, pay 22 -> 88.
    // LOW only on cols 1/2 (not reel 0) -> no LOW pay.
    // HIGH on cols 3/4 only -> not on reel 0, no HIGH pay.
    expect(r.totalWin).toBe(4 * 22);
  });
});

describe("evaluateWays — wild substitution (spec §5)", () => {
  it("WILD on reel 2 enables 4OAK PEARL when PEARL appears on reels 1/3/4", () => {
    // Reel 1 is all PEARL so no other tier symbol on reel 1 — only PEARL pays.
    // Filler is LOW (only on reel 5) so LOW can't run either.
    const g = grid([
      fillCol(Sym.PEARL),
      [Sym.WILD,  Sym.LOW, Sym.LOW, Sym.LOW],
      [Sym.PEARL, Sym.LOW, Sym.LOW, Sym.LOW],
      [Sym.PEARL, Sym.LOW, Sym.LOW, Sym.LOW],
      fillCol(Sym.HIGH),  // run-breaker; HIGH not on reel 0, no HIGH pay
    ]);
    const r = evaluateWays(g);
    // PEARL counts: [4, 1 (wild), 1, 1, 0] -> runLen 4, ways 4*1*1*1=4, pay 55 -> 220.
    expect(r.totalWin).toBe(4 * 55);
  });

  it("'all-wild reel 1' defensive rule: no pay if reel 1 has zero non-wild of the symbol", () => {
    // Construct a hypothetical (impossible with real strips) all-wild reel 1.
    // The evaluator must NOT pay every paying symbol simultaneously.
    const g = grid([
      fillCol(Sym.WILD),  // synthetic — real reels never put WILD on reel 1
      fillCol(Sym.PEARL),
      fillCol(Sym.PEARL),
      fillCol(Sym.PEARL),
      fillCol(Sym.PEARL),
    ]);
    const r = evaluateWays(g);
    // Per spec §5: "if not hasNonWild[0]: skip" — every paying symbol should be skipped.
    // Net result: 0 win.
    expect(r.totalWin).toBe(0);
  });
});

describe("evaluateWays — multiple symbols on the same spin (spec §5)", () => {
  it("ANGLER + LOW + HIGH on different runs all contribute independently", () => {
    // Reel 1: 1 ANGLER + 1 LOW + 1 HIGH + 1 MANTA (filler)
    // Reel 2: 1 ANGLER + 1 LOW + 1 HIGH + 1 MANTA
    // Reel 3: 1 ANGLER + 1 LOW + 1 HIGH + 1 MANTA
    // Reel 4-5: HIGH only -> ANGLER and LOW runs end at 3, HIGH runs full 5
    const r123: SymbolId[] = [Sym.ANGLER, Sym.LOW, Sym.HIGH, Sym.MANTA];
    const g = grid([r123, r123, r123, fillCol(Sym.HIGH), fillCol(Sym.HIGH)]);
    const r = evaluateWays(g);
    // ANGLER 3OAK: ways 1*1*1 = 1, pay 13 -> 13
    // LOW 3OAK: ways 1*1*1 = 1, pay 1 -> 1
    // HIGH 5OAK: counts [1,1,1,4,4], ways 1*1*1*4*4 = 16, pay 3 -> 48
    // MANTA: 3OAK from cells; counts [1,1,1,0,0]; runLen 3; ways 1*1*1=1; pay 4 -> 4
    // Total: 13 + 1 + 48 + 4 = 66
    expect(r.totalWin).toBe(66);
  });
});

describe("evaluateWays — bonus mode (spec §5, §6)", () => {
  it("conversion map (meter >= 8) makes SQUID-row contribute toward PEARL pay", () => {
    // After meter>=8, SQUID converts to PEARL.
    // Grid: PEARL on reel 1 + SQUID elsewhere -> PEARL 5OAK after conversion.
    const g = grid([
      fillCol(Sym.PEARL),
      fillCol(Sym.SQUID),
      fillCol(Sym.SQUID),
      fillCol(Sym.SQUID),
      fillCol(Sym.SQUID),
    ]);
    const conversionMap: Partial<Record<SymbolId, SymbolId>> = {
      [Sym.ANGLER]: Sym.PEARL,
      [Sym.SQUID]: Sym.PEARL,
    };
    const r = evaluateWays(g, { conversionMap });
    // After conversion: every cell is PEARL. Counts [4,4,4,4,4]. Ways 1024. Pay 105.
    expect(r.totalWin).toBe(105 * 1024);
  });

  it("wild multiplier on a single column applies once to the way pay", () => {
    // Reel 1 is all PEARL to isolate (no other tier on reel 1 -> only PEARL pays).
    const g = grid([
      fillCol(Sym.PEARL),
      [Sym.WILD,  Sym.LOW, Sym.LOW, Sym.LOW],
      [Sym.PEARL, Sym.LOW, Sym.LOW, Sym.LOW],
      fillCol(Sym.HIGH),  // breaks PEARL run on reel 4
      fillCol(Sym.HIGH),
    ]);
    // Wild multiplier on col 1 = x3.
    const r = evaluateWays(g, { wildMultPerCol: [1, 3, 1, 1, 1] });
    // PEARL counts: [4, 1, 1, 0, 0] -> runLen 3, ways 4*1*1=4, pay 22, mult x3 -> 264.
    expect(r.totalWin).toBe(4 * 22 * 3);
  });

  it("wild multipliers across cols 2 and 3 compound (x3 * x3 = x9)", () => {
    // Reel 1 is all PEARL to isolate.
    const g = grid([
      fillCol(Sym.PEARL),
      [Sym.WILD,  Sym.LOW, Sym.LOW, Sym.LOW],
      [Sym.WILD,  Sym.LOW, Sym.LOW, Sym.LOW],
      [Sym.PEARL, Sym.LOW, Sym.LOW, Sym.LOW],
      fillCol(Sym.HIGH),  // breaks PEARL run on reel 5
    ]);
    const r = evaluateWays(g, { wildMultPerCol: [1, 3, 3, 1, 1] });
    // PEARL counts: [4, 1, 1, 1, 0] -> runLen 4, ways 4*1*1*1=4, pay 55, mult 3*3=9 -> 1980.
    expect(r.totalWin).toBe(4 * 55 * 9);
  });
});

describe("evaluateWays — scatter pay (spec §3, §5)", () => {
  it("3 scatters trigger but pay 0 from PAYTABLE[SCAT][3]", () => {
    // Reel 1 has SCAT row 0 + PEARL rows 1-3 (so only PEARL is a candidate on reel 1,
    // and reels 2/3 don't have PEARL, so PEARL run breaks at length 1, no pay).
    // Reels 4 and 5 are HIGH (not on reel 0) — no HIGH pay.
    const g = grid([
      [Sym.SCAT, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.SCAT, Sym.LOW, Sym.LOW, Sym.LOW],
      [Sym.SCAT, Sym.LOW, Sym.LOW, Sym.LOW],
      fillCol(Sym.HIGH),
      fillCol(Sym.HIGH),
    ]);
    const r = evaluateWays(g);
    expect(r.scatCount).toBe(3);
    // PEARL counts: [3, 0, 0, 0, 0] -> runLen 1, < 3, skip. No PEARL pay.
    // LOW only on cols 1/2 (not reel 0) -> no LOW pay.
    // HIGH only on cols 3/4 (not reel 0) -> no HIGH pay.
    // SCAT pay at 3 = 0 per PAYTABLE.
    expect(r.totalWin).toBe(0);
  });

  it("5 scatters add the flat 60 coin scatter pay on top of any line wins", () => {
    const g = grid([
      [Sym.SCAT, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.SCAT, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.SCAT, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.SCAT, Sym.PEARL, Sym.PEARL, Sym.PEARL],
      [Sym.SCAT, Sym.PEARL, Sym.PEARL, Sym.PEARL],
    ]);
    const r = evaluateWays(g);
    expect(r.scatCount).toBe(5);
    // PEARL 5OAK with counts [3,3,3,3,3] -> ways 243, pay 105 -> 25515.
    // Plus scatter pay 60.
    expect(r.totalWin).toBe(243 * 105 + 60);
  });
});
