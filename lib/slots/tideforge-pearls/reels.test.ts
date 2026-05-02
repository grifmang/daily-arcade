// Tests for reel-strip construction and the locked V27 reel compositions.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md sections 4.1, 4.2, 4.3, 4.4
import { describe, it, expect } from "vitest";
import {
  STRIP_LEN,
  buildStrip,
  BASE_REELS,
  BONUS_REELS,
  BASE_REEL_COMPOSITIONS,
  BONUS_REEL_COMPOSITIONS,
} from "./reels";
import { Sym } from "./types";

describe("reels — invariants (spec §4.1)", () => {
  it("strip length is 60", () => {
    expect(STRIP_LEN).toBe(60);
  });

  it("buildStrip rejects compositions whose counts do not sum to 60", () => {
    expect(() => buildStrip({ [Sym.PEARL]: 1 })).toThrow();
    expect(() => buildStrip({ [Sym.LOW]: 30, [Sym.HIGH]: 31 })).toThrow();
  });

  it("buildStrip is pure (same input -> byte-equal output)", () => {
    const c = { [Sym.PEARL]: 3, [Sym.ANGLER]: 5, [Sym.SQUID]: 5, [Sym.COELA]: 6, [Sym.MANTA]: 10, [Sym.LOW]: 15, [Sym.HIGH]: 15, [Sym.SCAT]: 1 };
    const a = buildStrip(c);
    const b = buildStrip(c);
    expect(a).toEqual(b);
    // Defensive: ensure separate instances (no aliasing)
    a[0] = Sym.MANTA;
    expect(b[0]).not.toBe(Sym.MANTA);
  });

  it("scatters are placed at evenly-spaced positions (no two within 4-row window)", () => {
    // 2 SCAT on length-60 strip -> positions 0 and 30
    const strip = buildStrip({ [Sym.PEARL]: 1, [Sym.LOW]: 28, [Sym.HIGH]: 29, [Sym.SCAT]: 2 });
    const scatPositions: number[] = [];
    for (let i = 0; i < strip.length; i++) if (strip[i] === Sym.SCAT) scatPositions.push(i);
    expect(scatPositions).toEqual([0, 30]);
    // No 4-row window contains both scatters
    for (let s = 0; s < strip.length; s++) {
      let count = 0;
      for (let i = 0; i < 4; i++) if (strip[(s + i) % strip.length] === Sym.SCAT) count++;
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});

describe("reels — base reels golden vectors (spec §4.2, §4.4)", () => {
  // Locked V27 base reels. Encoded as compact strings: P A S C M L H W * for the 9 symbols.
  const SHORT = ["P", "A", "S", "C", "M", "L", "H", "W", "*"];
  const stripToString = (s: ReadonlyArray<number>) => s.map((x) => SHORT[x]).join("");

  it("base reel 1 matches golden vector (V27 — 17/17 royals)", () => {
    expect(stripToString(BASE_REELS[0]!)).toBe(
      "*PPPAAAASSSSCCCCCMMMMMMMMMLLLLLLLLLLLLLLLLLHHHHHHHHHHHHHHHHH"
    );
  });

  it("base reel 2 matches golden vector", () => {
    expect(stripToString(BASE_REELS[1]!)).toBe(
      "*PPAAASSSSWCCCCCMMMMMMMLLLLLLL*WLLLLLLLLLLHHHHHHHHWHHHHHHHHH"
    );
  });

  it("base reel 3 matches golden vector", () => {
    expect(stripToString(BASE_REELS[2]!)).toBe(
      "*PPAAAAWSSSSCCCCMMMMMMWMLLLLLLLLLLLLLWLLLLHHHHHHHHHHWHHHHHHH"
    );
  });

  it("base reel 4 matches golden vector", () => {
    expect(stripToString(BASE_REELS[3]!)).toBe(
      "*PPAAASSSSWCCCCCMMMMMMMLLLLLLL*WLLLLLLLLLLHHHHHHHHWHHHHHHHHH"
    );
  });

  it("base reel 5 matches golden vector", () => {
    expect(stripToString(BASE_REELS[4]!)).toBe(
      "*PPPAAAASSSSCCCCCMMMMMMMMMLLLLLLLLLLLLLLLLLHHHHHHHHHHHHHHHHH"
    );
  });

  it("BASE_REEL_COMPOSITIONS counts match the spec table (§4.2)", () => {
    expect(BASE_REEL_COMPOSITIONS).toHaveLength(5);
    expect(BASE_REEL_COMPOSITIONS[0]).toEqual({
      [Sym.PEARL]: 3, [Sym.ANGLER]: 4, [Sym.SQUID]: 4, [Sym.COELA]: 5, [Sym.MANTA]: 9, [Sym.LOW]: 17, [Sym.HIGH]: 17, [Sym.SCAT]: 1,
    });
    expect(BASE_REEL_COMPOSITIONS[1]).toEqual({
      [Sym.PEARL]: 2, [Sym.ANGLER]: 3, [Sym.SQUID]: 4, [Sym.COELA]: 5, [Sym.MANTA]: 7, [Sym.LOW]: 17, [Sym.HIGH]: 17, [Sym.WILD]: 3, [Sym.SCAT]: 2,
    });
    expect(BASE_REEL_COMPOSITIONS[2]).toEqual({
      [Sym.PEARL]: 2, [Sym.ANGLER]: 4, [Sym.SQUID]: 4, [Sym.COELA]: 4, [Sym.MANTA]: 7, [Sym.LOW]: 17, [Sym.HIGH]: 17, [Sym.WILD]: 4, [Sym.SCAT]: 1,
    });
  });
});

describe("reels — bonus reels golden vectors (spec §4.3, §4.4)", () => {
  const SHORT = ["P", "A", "S", "C", "M", "L", "H", "W", "*"];
  const stripToString = (s: ReadonlyArray<number>) => s.map((x) => SHORT[x]).join("");

  it("bonus reel 1 matches golden vector", () => {
    expect(stripToString(BONUS_REELS[0]!)).toBe(
      "*PAAAAASSSSSSCCCCCCCCMMMMMMMMMMMLLLLLLLLLLLLLLHHHHHHHHHHHHHH"
    );
  });

  it("bonus reel 2 matches golden vector", () => {
    expect(stripToString(BONUS_REELS[1]!)).toBe(
      "*PAAAAASSSWSSSCCCCCCCMMMMMMMMMWMLLLLLLLLLLLLLHHHHHWHHHHHHHHH"
    );
  });

  it("bonus reel 3 matches golden vector", () => {
    expect(stripToString(BONUS_REELS[2]!)).toBe(
      "*PAAAAAWSSSSSSCCCCCCCMWMMMMMMMMLLLLLLWLLLLLLLHHHHHHHWHHHHHHH"
    );
  });

  it("bonus reel 4 matches golden vector", () => {
    expect(stripToString(BONUS_REELS[3]!)).toBe(
      "*PAAAAASSSWSSSCCCCCCCMMMMMMMMMWMLLLLLLLLLLLLLHHHHHWHHHHHHHHH"
    );
  });

  it("bonus reel 5 matches golden vector", () => {
    expect(stripToString(BONUS_REELS[4]!)).toBe(
      "*PPAAAAASSSSSSCCCCCCCCMMMMMMMMMMLLLLLLLLLLLLLLHHHHHHHHHHHHHH"
    );
  });

  it("BONUS_REEL_COMPOSITIONS counts match the spec table (§4.3)", () => {
    expect(BONUS_REEL_COMPOSITIONS).toHaveLength(5);
    expect(BONUS_REEL_COMPOSITIONS[0]).toEqual({
      [Sym.PEARL]: 1, [Sym.ANGLER]: 5, [Sym.SQUID]: 6, [Sym.COELA]: 8, [Sym.MANTA]: 11, [Sym.LOW]: 14, [Sym.HIGH]: 14, [Sym.SCAT]: 1,
    });
    expect(BONUS_REEL_COMPOSITIONS[2]).toEqual({
      [Sym.PEARL]: 1, [Sym.ANGLER]: 5, [Sym.SQUID]: 6, [Sym.COELA]: 7, [Sym.MANTA]: 9, [Sym.LOW]: 13, [Sym.HIGH]: 14, [Sym.WILD]: 4, [Sym.SCAT]: 1,
    });
  });

  it("every base reel and bonus reel is exactly STRIP_LEN long", () => {
    for (const r of BASE_REELS) expect(r).toHaveLength(STRIP_LEN);
    for (const r of BONUS_REELS) expect(r).toHaveLength(STRIP_LEN);
  });
});
