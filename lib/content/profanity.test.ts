import { describe, it, expect } from "vitest";
import { validateHandle } from "./profanity";

describe("validateHandle", () => {
  it("accepts simple alphanumeric handles", () => {
    expect(validateHandle("ALICE")).toEqual({ ok: true, handle: "ALICE" });
    expect(validateHandle("user_42")).toEqual({ ok: true, handle: "user_42" });
  });
  it("rejects too short / too long", () => {
    expect(validateHandle("AB")).toMatchObject({ ok: false });
    expect(validateHandle("A".repeat(13))).toMatchObject({ ok: false });
  });
  it("rejects non-alphanumeric", () => {
    expect(validateHandle("hi-there")).toMatchObject({ ok: false });
    expect(validateHandle("you 2")).toMatchObject({ ok: false });
  });
  it("rejects blocked terms", () => {
    expect(validateHandle("admin")).toMatchObject({ ok: false });
    expect(validateHandle("FUCK")).toMatchObject({ ok: false });
  });
});
