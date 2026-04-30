import { describe, it, expect } from "vitest";
import { prngForDate } from "./prng";

describe("prngForDate", () => {
  it("is deterministic per (date, salt)", () => {
    const a = prngForDate("2026-04-29", "salt").next();
    const b = prngForDate("2026-04-29", "salt").next();
    expect(a).toBe(b);
  });
  it("changes when date or salt changes", () => {
    const a = prngForDate("2026-04-29", "salt").next();
    const b = prngForDate("2026-04-30", "salt").next();
    const c = prngForDate("2026-04-29", "different").next();
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
