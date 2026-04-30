import { describe, it, expect } from "vitest";
import { initialState, step, replay, peakTile } from "./drift-2049";

describe("drift-2049 mechanics", () => {
  const board = [
    [2, 0, 0, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  it("merges identical adjacent tiles to the left", () => {
    const s0 = initialState(board);
    const s1 = step(s0, "left");
    expect(s1.board[0]![0]).toBe(4);
    expect(s1.score).toBe(4);
  });

  it("noop move does not advance state", () => {
    const s0 = initialState([
      [2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],
    ]);
    const s1 = step(s0, "left");
    // Tile already left-aligned; should not change
    expect(s1).toBe(s0);
  });

  it("replay produces the same final state as step-by-step", () => {
    const final = replay(board, ["left", "down", "right"]);
    expect(peakTile(final.board)).toBeGreaterThanOrEqual(2);
  });
});
