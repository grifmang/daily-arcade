"use server";

import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { z } from "zod";
import { utcDateString, isValidIsoDate } from "./utils";
import { validateHandle } from "./content/profanity";
import { sign, sharePayload } from "./sign";
import { store } from "./store";
import { hashIp, rateLimit } from "./rate-limit";
import { buildDailySeed } from "./seed";
import { TRIVIA_QUESTIONS } from "./content/trivia";
import { gradeGuess, scoreFromGuesses } from "./games/word-volley";
import { score as scoreTrivia, isImpossiblyFast, type AnswerSubmission } from "./games/snap-trivia";
import { replay, peakTile, type Move } from "./games/drift-2049";
import { verifyTurnstile } from "./turnstile";
import type { GameId } from "./types";

const GameIdSchema = z.enum(["word-volley", "drift-2049", "snap-trivia"]);
const DateSchema = z.string().refine(isValidIsoDate, { message: "Bad date" });

const SubmitSchema = z.object({
  gameId: GameIdSchema,
  date: DateSchema,
  handle: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  // Cloudflare Turnstile token from the client widget. Verified server-side
  // as the first step of the submit pipeline. See DECISIONS.md ADR-1
  // (2026-04-30) and THREAT_MODEL.md §P3.6.
  turnstileToken: z.string().min(1).max(2048),
});

const WordVolleyMetaSchema = z.object({
  guesses: z.array(z.string().regex(/^[A-Z]{5}$/)).min(1).max(6),
});
const Drift2049MetaSchema = z.object({
  moves: z.array(z.enum(["left", "right", "up", "down"])).max(2000),
});
const SnapTriviaMetaSchema = z.object({
  answers: z
    .array(z.object({
      questionId: z.number().int().nonnegative(),
      choice: z.number().int().min(0).max(3),
      msTaken: z.number().int().min(0).max(60_000),
    }))
    .length(5),
});

export interface SubmitResult {
  ok: boolean;
  error?: string;
  shareId?: string;
  shareUrl?: string;
  signature?: string;
  rank?: number;
  total?: number;
  score?: number;
  discriminator?: number;
}

async function getIpHash(date: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return hashIp(ip, date);
}

export async function submitScore(input: unknown): Promise<SubmitResult> {
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid submission shape." };
  }

  // STEP 1: Cloudflare Turnstile verify. Runs before any other check,
  // including rate-limit, so failed-bot attempts do not consume a
  // rate-limit slot. See DECISIONS.md ADR-1 (2026-04-30) and
  // THREAT_MODEL.md §P3.2 (Boundary 7) and §P3.6.
  const turnstile = await verifyTurnstile(parsed.data.turnstileToken);
  if (!turnstile.ok) {
    console.warn("[submit] turnstile rejected", {
      gameId: parsed.data.gameId,
      codes: turnstile.codes,
    });
    return { ok: false, error: "We couldn't verify this submission. Try again." };
  }

  const today = utcDateString();
  if (parsed.data.date !== today) {
    return { ok: false, error: "Submissions are only accepted for today's puzzle." };
  }

  const handleCheck = validateHandle(parsed.data.handle);
  if (!handleCheck.ok) return { ok: false, error: handleCheck.reason };
  const handle = handleCheck.handle;

  const ipHash = await getIpHash(today);
  // Rate limit: 5 submits per minute and 20 per day per (game, ip)
  const minute = await rateLimit({ bucket: `submit:m:${parsed.data.gameId}`, ipHash, windowMs: 60_000, max: 5 });
  if (!minute.ok) return { ok: false, error: "You're submitting too fast. Wait a moment." };
  const daily = await rateLimit({ bucket: `submit:d:${parsed.data.gameId}`, ipHash, windowMs: 24 * 60 * 60 * 1000, max: 20 });
  if (!daily.ok) return { ok: false, error: "Daily submit limit reached." };

  const seed = buildDailySeed(today);

  // Server-side scoring per game.
  let computedScore = 0;
  let metadata: Record<string, unknown> = {};
  switch (parsed.data.gameId) {
    case "word-volley": {
      const m = WordVolleyMetaSchema.safeParse(parsed.data.metadata);
      if (!m.success) return { ok: false, error: "Invalid Word Volley submission." };
      const target = seed.wordVolley.target;
      const grades = m.data.guesses.map(g => gradeGuess(g, target));
      const result = scoreFromGuesses(grades);
      if (!result.won) return { ok: false, error: "Game not won — submission rejected." };
      computedScore = result.score;
      metadata = { guesses: m.data.guesses, won: true, guessesUsed: result.guessesUsed };
      break;
    }
    case "drift-2049": {
      const m = Drift2049MetaSchema.safeParse(parsed.data.metadata);
      if (!m.success) return { ok: false, error: "Invalid Drift 2049 submission." };
      const final = replay(seed.drift2049.initialBoard, m.data.moves as Move[]);
      computedScore = final.score;
      metadata = { moves: m.data.moves.length, peak: peakTile(final.board), score: final.score };
      break;
    }
    case "snap-trivia": {
      const m = SnapTriviaMetaSchema.safeParse(parsed.data.metadata);
      if (!m.success) return { ok: false, error: "Invalid Snap Trivia submission." };
      // Validate that question IDs match today's seed
      const expectedIds = new Set(seed.snapTrivia.questionIds);
      for (const a of m.data.answers) {
        if (!expectedIds.has(a.questionId) || !TRIVIA_QUESTIONS[a.questionId]) {
          return { ok: false, error: "Submission references unknown question." };
        }
      }
      if (isImpossiblyFast(m.data.answers as AnswerSubmission[])) {
        return { ok: false, error: "Submission too fast to be human." };
      }
      const r = scoreTrivia(m.data.answers as AnswerSubmission[]);
      computedScore = r.totalScore;
      metadata = { correct: r.correctCount, perQuestion: r.perQuestion };
      break;
    }
  }

  // Discriminator collision handling
  const existing = await store().isHandleUsedToday(parsed.data.gameId, today, handle);
  let discriminator: number;
  if (existing.length === 0) {
    discriminator = 0;
  } else {
    let candidate = 1;
    const used = new Set(existing);
    while (used.has(candidate) && candidate < 10_000) candidate++;
    discriminator = candidate;
  }

  const shareId = nanoid(10);
  const payload = sharePayload({
    gameId: parsed.data.gameId,
    date: today,
    handle,
    discriminator,
    score: computedScore,
    shareId,
  });
  const signature = await sign(payload);

  const { rank, total } = await store().putLeaderboardEntry({
    gameId: parsed.data.gameId,
    date: today,
    handle,
    discriminator,
    score: computedScore,
    shareId,
    createdAt: Date.now(),
  });

  await store().putShare({
    id: shareId,
    gameId: parsed.data.gameId,
    date: today,
    handle,
    discriminator,
    score: computedScore,
    signature,
    metadata,
    createdAt: Date.now(),
  });

  return {
    ok: true,
    shareId,
    shareUrl: `/share/${shareId}`,
    signature,
    rank,
    total,
    score: computedScore,
    discriminator,
  };
}

const ClaimHandleSchema = z.object({
  handle: z.string(),
  // Cloudflare Turnstile token. Verified server-side as the first step
  // of the claim pipeline. See DECISIONS.md ADR-1 (2026-04-30).
  turnstileToken: z.string().min(1).max(2048),
});
export async function claimHandle(input: unknown): Promise<{ ok: boolean; error?: string; handle?: string }> {
  const parsed = ClaimHandleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad input." };

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken);
  if (!turnstile.ok) {
    console.warn("[claim] turnstile rejected", { codes: turnstile.codes });
    return { ok: false, error: "We couldn't verify this request. Try again." };
  }

  const v = validateHandle(parsed.data.handle);
  if (!v.ok) return { ok: false, error: v.reason };
  return { ok: true, handle: v.handle };
}

export async function getLeaderboard(gameId: GameId, date: string): Promise<{
  entries: Array<{ handle: string; discriminator: number; score: number; rank: number }>;
  total: number;
}> {
  const top = await store().topN(gameId, date, 100);
  const total = await store().countForDate(gameId, date);
  return {
    entries: top.map((e, i) => ({ handle: e.handle, discriminator: e.discriminator, score: e.score, rank: i + 1 })),
    total,
  };
}
