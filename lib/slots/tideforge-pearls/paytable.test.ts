// Tests for the locked paytable.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 3
import { describe, it, expect } from "vitest";
import { PAYTABLE, BET } from "./paytable";
import { Sym } from "./types";

describe("paytable — locked values (spec §3)", () => {
  it("BET is 60 credits per spin", () => {
    expect(BET).toBe(60);
  });

  it("PEARL pays 22 / 55 / 105 for 3/4/5 of a kind", () => {
    expect(PAYTABLE[Sym.PEARL]).toEqual({ 3: 22, 4: 55, 5: 105 });
  });

  it("ANGLER pays 13 / 30 / 62", () => {
    expect(PAYTABLE[Sym.ANGLER]).toEqual({ 3: 13, 4: 30, 5: 62 });
  });

  it("SQUID pays 9 / 22 / 50", () => {
    expect(PAYTABLE[Sym.SQUID]).toEqual({ 3: 9, 4: 22, 5: 50 });
  });

  it("COELA pays 7 / 17 / 38", () => {
    expect(PAYTABLE[Sym.COELA]).toEqual({ 3: 7, 4: 17, 5: 38 });
  });

  it("MANTA pays 4 / 11 / 25", () => {
    expect(PAYTABLE[Sym.MANTA]).toEqual({ 3: 4, 4: 11, 5: 25 });
  });

  it("LOW and HIGH royal buckets pay 1 / 2 / 3", () => {
    expect(PAYTABLE[Sym.LOW]).toEqual({ 3: 1, 4: 2, 5: 3 });
    expect(PAYTABLE[Sym.HIGH]).toEqual({ 3: 1, 4: 2, 5: 3 });
  });

  it("SCAT pays 60 only at 5+ scatter (3/4 are trigger-only)", () => {
    expect(PAYTABLE[Sym.SCAT]).toEqual({ 3: 0, 4: 0, 5: 60 });
  });
});
