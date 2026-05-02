// Tests for the slot RNG contract.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 7
import { describe, it, expect } from "vitest";
import { createSeededRng, createCryptoRng } from "./rng";

describe("rng — seeded determinism (spec §7)", () => {
  it("createSeededRng with the same seed returns identical sequences", () => {
    const a = createSeededRng(20260501n);
    const b = createSeededRng(20260501n);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("nextInt(n) returns values in [0, n) for any n >= 1", () => {
    const rng = createSeededRng(1n);
    for (let n = 1; n <= 60; n++) {
      for (let i = 0; i < 50; i++) {
        const v = rng.nextInt(n);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(n);
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it("next() returns values in [0, 1)", () => {
    const rng = createSeededRng(123n);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds produce different sequences", () => {
    const a = createSeededRng(1n);
    const b = createSeededRng(2n);
    let differences = 0;
    for (let i = 0; i < 20; i++) {
      if (a.next() !== b.next()) differences++;
    }
    expect(differences).toBeGreaterThan(15); // overwhelmingly different
  });

  it("nextInt(1) returns 0 without spinning a rejection loop (seeded + crypto)", () => {
    // Regression for the n=1 edge case: previously the crypto RNG's rejection
    // loop hung because (0x100000000 % 1) === 0 truncated `limit` to 0.
    const seeded = createSeededRng(42n);
    const crypto = createCryptoRng();
    for (let i = 0; i < 20; i++) {
      expect(seeded.nextInt(1)).toBe(0);
      expect(crypto.nextInt(1)).toBe(0);
    }
  });

  it("nextInt(power-of-2) terminates fast — regression against the >>> 0 truncation bug", () => {
    // Same latent bug as the cards RNG: when max is a power of 2,
    // `0x100000000 % max === 0`, so `limit = 2^32`, and `>>> 0` truncates that to 0,
    // making the rejection loop infinite. Tideforge's call sites only use nextInt(60)
    // so they never tripped this in production, but lock the regression at the source.
    const seeded = createSeededRng(123n);
    const crypto = createCryptoRng();
    for (const max of [2, 4, 8, 16, 32, 64, 128, 1024, 65536]) {
      for (let i = 0; i < 50; i++) {
        const s = seeded.nextInt(max);
        const c = crypto.nextInt(max);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThan(max);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(max);
      }
    }
  });
});
