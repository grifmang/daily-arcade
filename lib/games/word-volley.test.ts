import { describe, it, expect } from "vitest";
import { gradeGuess, scoreFromGuesses, shareGrid } from "./word-volley";

describe("word-volley/gradeGuess", () => {
  it("all green when guess equals target", () => {
    expect(gradeGuess("CRANE", "CRANE")).toEqual(["green","green","green","green","green"]);
  });
  it("yellow only counts once per duplicate letter", () => {
    // target ROBIN, guess BBOOK:
    //   B[0] yellow (target has B at 2), B[1] grey (B already consumed),
    //   O[2] yellow (target has O at 1), O[3] grey (O consumed), K grey
    expect(gradeGuess("BBOOK", "ROBIN")).toEqual(["yellow","grey","yellow","grey","grey"]);
  });
  it("greens consume target letters before yellows are assigned", () => {
    // target ALLOY guess LLAMA:
    //   L[0] vs A: grey-pending; L[1] vs L: green; A[2] vs L: grey-pending;
    //   M[3] vs O: grey; A[4] vs Y: grey-pending
    // After greens consume: target remaining = A,L,O,Y (one L was consumed at pos 1).
    //   Yellow pass: L[0]→yellow (A,L,O,Y has L), A[2]→yellow (has A, consumed), M[3]→grey,
    //   A[4]→grey (A already consumed)
    expect(gradeGuess("LLAMA", "ALLOY")).toEqual(["yellow","green","yellow","grey","grey"]);
  });
});

describe("word-volley/scoreFromGuesses", () => {
  it("loses when no row is all-green", () => {
    const grades = [
      ["grey","grey","grey","grey","grey"],
      ["yellow","grey","grey","grey","grey"],
    ] as const;
    const r = scoreFromGuesses(grades.map(g => [...g]) as never);
    expect(r.won).toBe(false);
    expect(r.score).toBe(0);
  });
  it("scores 100 for a 1-guess win, 50 for 6-guess win", () => {
    const win = ["green","green","green","green","green"] as const;
    expect(scoreFromGuesses([[...win]] as never).score).toBe(100);
    const r6 = scoreFromGuesses([
      ["grey","grey","grey","grey","grey"],
      ["grey","grey","grey","grey","grey"],
      ["grey","grey","grey","grey","grey"],
      ["grey","grey","grey","grey","grey"],
      ["grey","grey","grey","grey","grey"],
      [...win],
    ].map(r => [...r]) as never);
    expect(r6.score).toBe(50);
  });
});

describe("word-volley/shareGrid", () => {
  it("renders emoji rows", () => {
    const g = shareGrid([
      ["green","yellow","grey","grey","grey"],
      ["green","green","green","green","green"],
    ] as never);
    expect(g).toBe("🟩🟨⬛⬛⬛\n🟩🟩🟩🟩🟩");
  });
});
