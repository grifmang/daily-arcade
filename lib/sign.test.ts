import { describe, it, expect } from "vitest";
import { sharePayload } from "./share-payload";

describe("sharePayload", () => {
  it("encodes fields in canonical order", () => {
    expect(
      sharePayload({ gameId: "word-volley", date: "2026-04-29", handle: "ALICE", discriminator: 0, score: 80, shareId: "abc" }),
    ).toBe("word-volley|2026-04-29|ALICE|0|80|abc");
  });
});
