/**
 * Submit-flow integration tests.
 * We patch process.env to deterministic dev defaults and exercise the action's branches.
 *
 * NOTE: actions.ts uses next/headers and "use server", so this test runs in jsdom-compatible
 * Node mode by mocking the headers module surface.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";

// Mock next/headers to a permissive shape with controllable IP
const headerStore = new Map<string, string>([["x-forwarded-for", "203.0.113.7"]]);
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (k: string) => headerStore.get(k.toLowerCase()) ?? null,
  }),
}));

// Mock server-only to a no-op for test env
vi.mock("server-only", () => ({}));

// Mock the Turnstile verifier so these tests don't make outbound network
// calls. Verifier-specific behavior is tested in lib/turnstile.test.ts.
vi.mock("./turnstile", () => ({
  verifyTurnstile: vi.fn(async (token: string) =>
    token === "FAIL_TOKEN"
      ? { ok: false, codes: ["mocked-failure"] }
      : { ok: true },
  ),
}));

// Critical: we want deterministic seeds independent of real secrets.
beforeAll(() => {
  process.env.SHARE_SIGNING_SECRET = "0".repeat(64);
  process.env.IP_HASH_SALT_BASE = "1".repeat(64);
  process.env.CRON_SECRET = "test-secret";
});

describe("submitScore — word-volley", () => {
  it("rejects malformed input", async () => {
    const { submitScore } = await import("./actions");
    const res = await submitScore({ gameId: "word-volley" });
    expect(res.ok).toBe(false);
  });

  it("rejects submissions for past dates", async () => {
    const { submitScore } = await import("./actions");
    const res = await submitScore({
      gameId: "word-volley",
      date: "1999-01-01",
      handle: "ALICE",
      metadata: { guesses: ["AAAAA"] },
      turnstileToken: "test",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/today/);
  });

  it("rejects unsolved Word Volley submissions", async () => {
    const { submitScore } = await import("./actions");
    const { utcDateString } = await import("./utils");
    const today = utcDateString();
    const res = await submitScore({
      gameId: "word-volley",
      date: today,
      handle: "ALICE",
      metadata: { guesses: ["AAAAA"] }, // never the target
      turnstileToken: "test",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Game not won|Invalid|won/);
  });
});

describe("submitScore — drift-2049 replay verification", () => {
  it("accepts a valid empty-move-list with score 0", async () => {
    const { submitScore } = await import("./actions");
    const { utcDateString } = await import("./utils");
    const today = utcDateString();
    const res = await submitScore({
      gameId: "drift-2049",
      date: today,
      handle: "BOB",
      metadata: { moves: [] },
      turnstileToken: "test",
    });
    // empty moves → final state == initial → score 0; accepted
    expect(res.ok).toBe(true);
    expect(res.score).toBe(0);
  });

  it("rejects malformed moves", async () => {
    const { submitScore } = await import("./actions");
    const { utcDateString } = await import("./utils");
    const today = utcDateString();
    const res = await submitScore({
      gameId: "drift-2049",
      date: today,
      handle: "BOB",
      metadata: { moves: ["jump"] },
      turnstileToken: "test",
    });
    expect(res.ok).toBe(false);
  });
});

describe("submitScore — snap-trivia", () => {
  it("rejects impossibly fast submissions", async () => {
    const { submitScore } = await import("./actions");
    const { seedForToday } = await import("./seed");
    const { utcDateString } = await import("./utils");
    const today = utcDateString();
    const ids = seedForToday().snapTrivia.questionIds;
    const res = await submitScore({
      gameId: "snap-trivia",
      date: today,
      handle: "CARA",
      metadata: {
        answers: ids.map(qid => ({ questionId: qid, choice: 0, msTaken: 100 })),
      },
      turnstileToken: "test",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/fast/);
  });

  it("rejects unknown question IDs", async () => {
    const { submitScore } = await import("./actions");
    const { utcDateString } = await import("./utils");
    const today = utcDateString();
    const res = await submitScore({
      gameId: "snap-trivia",
      date: today,
      handle: "CARA",
      metadata: {
        answers: [
          { questionId: 999, choice: 0, msTaken: 5000 },
          { questionId: 998, choice: 0, msTaken: 5000 },
          { questionId: 997, choice: 0, msTaken: 5000 },
          { questionId: 996, choice: 0, msTaken: 5000 },
          { questionId: 995, choice: 0, msTaken: 5000 },
        ],
      },
      turnstileToken: "test",
    });
    expect(res.ok).toBe(false);
  });
});

describe("handle collision discriminator", () => {
  it("returns increasing discriminators for repeated handles on same day", async () => {
    const { submitScore } = await import("./actions");
    const { utcDateString } = await import("./utils");
    const today = utcDateString();
    headerStore.set("x-forwarded-for", "198.51.100.1");
    const a = await submitScore({
      gameId: "drift-2049",
      date: today,
      handle: "TWIN",
      metadata: { moves: [] },
      turnstileToken: "test",
    });
    headerStore.set("x-forwarded-for", "198.51.100.2");
    const b = await submitScore({
      gameId: "drift-2049",
      date: today,
      handle: "TWIN",
      metadata: { moves: [] },
      turnstileToken: "test",
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.discriminator).toBe(0);
    expect(b.discriminator).toBeGreaterThan(0);
  });
});

describe("submitScore — Turnstile gating", () => {
  it("rejects when turnstileToken is absent (Zod schema)", async () => {
    const { submitScore } = await import("./actions");
    const { utcDateString } = await import("./utils");
    const today = utcDateString();
    const res = await submitScore({
      gameId: "drift-2049",
      date: today,
      handle: "NOTOK",
      metadata: { moves: [] },
      // turnstileToken intentionally omitted
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Invalid|verify/i);
  });

  it("rejects when verifier returns ok:false", async () => {
    const { submitScore } = await import("./actions");
    const { utcDateString } = await import("./utils");
    const today = utcDateString();
    const res = await submitScore({
      gameId: "drift-2049",
      date: today,
      handle: "BLOCKED",
      metadata: { moves: [] },
      turnstileToken: "FAIL_TOKEN",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/verify/i);
  });

  it("Turnstile gate runs before any other check (rejects past-date submission only because of turnstile)", async () => {
    // FAIL_TOKEN should reject before the date validation runs.
    const { submitScore } = await import("./actions");
    const res = await submitScore({
      gameId: "drift-2049",
      date: "1999-01-01", // would otherwise produce a "today" error
      handle: "BLOCKED",
      metadata: { moves: [] },
      turnstileToken: "FAIL_TOKEN",
    });
    expect(res.ok).toBe(false);
    // The verify-failure message must win over the date-error message.
    expect(res.error).toMatch(/verify/i);
    expect(res.error).not.toMatch(/today/i);
  });
});

describe("claimHandle — Turnstile gating", () => {
  it("requires turnstileToken", async () => {
    const { claimHandle } = await import("./actions");
    const res = await claimHandle({ handle: "ALICE" });
    expect(res.ok).toBe(false);
  });

  it("rejects when verifier returns ok:false", async () => {
    const { claimHandle } = await import("./actions");
    const res = await claimHandle({ handle: "ALICE", turnstileToken: "FAIL_TOKEN" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/verify/i);
  });

  it("accepts a clean handle with valid token", async () => {
    const { claimHandle } = await import("./actions");
    const res = await claimHandle({ handle: "ALICE", turnstileToken: "test" });
    expect(res.ok).toBe(true);
    expect(res.handle).toBe("ALICE");
  });
});
