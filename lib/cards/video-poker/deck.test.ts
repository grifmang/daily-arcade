// Tests for deck creation and shuffle.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md section 11
import { describe, it, expect } from "vitest";
import { createDeck, shuffle } from "./deck";
import { createSeededRng } from "./rng";
import { Suit, type Deck } from "./types";

describe("createDeck", () => {
  it("returns 52 cards", () => {
    const d = createDeck();
    expect(d).toHaveLength(52);
  });

  it("contains every (suit, rank) combination exactly once", () => {
    const d = createDeck();
    const seen = new Set<string>();
    for (const c of d) seen.add(`${c.suit}-${c.rank}`);
    expect(seen.size).toBe(52);
  });

  it("returns a fresh array on each call (no shared mutation)", () => {
    const a = createDeck();
    const b = createDeck();
    expect(a).not.toBe(b);
  });
});

describe("shuffle", () => {
  it("returns a 52-card array containing the same cards in a different order", () => {
    const rng = createSeededRng(20260501n);
    const d = createDeck();
    const s = shuffle(d, rng);
    expect(s).toHaveLength(52);
    // Same multiset of cards
    const ids = (deck: Deck) => deck.map(c => `${c.suit}-${c.rank}`).sort();
    expect(ids(s)).toEqual(ids(d));
    // Order should differ for any reasonable RNG (Fisher-Yates with a real shuffle)
    expect(s.map(c => `${c.suit}-${c.rank}`)).not.toEqual(d.map(c => `${c.suit}-${c.rank}`));
  });

  it("is deterministic given the same seed", () => {
    const a = shuffle(createDeck(), createSeededRng(42n));
    const b = shuffle(createDeck(), createSeededRng(42n));
    expect(a).toEqual(b);
  });

  it("does not mutate the input deck", () => {
    const d = createDeck();
    const dCopy = [...d];
    shuffle(d, createSeededRng(1n));
    expect(d).toEqual(dCopy);
  });

  it("shuffle uniformity — chi-square test on position 0 over 10000 shuffles", () => {
    const rng = createSeededRng(99n);
    const counts = new Map<number, number>();
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const s = shuffle(createDeck(), rng);
      const first = s[0]!;
      const suitIdx =
        first.suit === Suit.SPADES ? 0
        : first.suit === Suit.HEARTS ? 1
        : first.suit === Suit.DIAMONDS ? 2
        : 3;
      const key = first.rank * 4 + suitIdx;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Chi-square against uniform distribution over 52 cells
    const expected = N / 52;
    let chi2 = 0;
    // Iterate over the realized cell-key range (rank 2..14, suit 0..3) — 52 cells.
    for (let rank = 2; rank <= 14; rank++) {
      for (let suit = 0; suit < 4; suit++) {
        const cell = rank * 4 + suit;
        const observed = counts.get(cell) ?? 0;
        chi2 += ((observed - expected) ** 2) / expected;
      }
    }
    // 95% threshold for 51 dof is ~68.7. Our test should comfortably pass.
    expect(chi2).toBeLessThan(100);
  });
});
