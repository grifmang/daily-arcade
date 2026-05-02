// Per-game localStorage helpers for video-poker credits and session stats.
// Spec: ARCHITECTURE.md section 15.4
// ADR: DECISIONS.md ADR-C4 (2026-05-01) — per-game keyed storage
//
// Credits are play-money only. localStorage is editable via DevTools — that's
// risk-accepted per ADR-C4. There is no server-side mirror, no submission,
// no leaderboard, no shareable artifact derived from credits.

import { HandRank } from "./types";

/** Default starting balance, in dimensionless credits. */
export const DEFAULT_CREDITS = 1000 as const;

export interface SessionStats {
  handsPlayed: number;
  totalWagered: number;
  totalWon: number;
  bestSingleWin: number;
  /** Per-rank hit counters for visible "rare hand" stats. */
  rankHits: Partial<Record<HandRank, number>>;
}

/** A frozen "all zeros" stats record. */
export const EMPTY_STATS: SessionStats = Object.freeze({
  handsPlayed: 0,
  totalWagered: 0,
  totalWon: 0,
  bestSingleWin: 0,
  rankHits: Object.freeze({}) as Partial<Record<HandRank, number>>,
});

export function creditsKey(slug: string): string {
  return `cards:${slug}:credits`;
}

export function statsKey(slug: string): string {
  return `cards:${slug}:stats`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Some sandboxes (e.g. private browsing in some browsers) throw on access.
    return null;
  }
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

/**
 * Load the credit balance for a game, returning DEFAULT_CREDITS when unset,
 * corrupt, or unparseable. Negative values are clamped to 0; fractional values
 * are floored.
 */
export function loadCredits(slug: string): number {
  const store = getStorage();
  if (!store) return DEFAULT_CREDITS;
  try {
    const raw = store.getItem(creditsKey(slug));
    if (raw === null) return DEFAULT_CREDITS;
    return numberOr(JSON.parse(raw), DEFAULT_CREDITS);
  } catch {
    return DEFAULT_CREDITS;
  }
}

/** Persist a credit balance. Floored to integer; clamped to >= 0. */
export function saveCredits(slug: string, n: number): void {
  const store = getStorage();
  if (!store) return;
  const clamped = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  try {
    store.setItem(creditsKey(slug), JSON.stringify(clamped));
  } catch {
    /* private mode, quota exceeded, etc. */
  }
}

/** Load stats for a game, returning EMPTY_STATS on missing or corrupt data. */
export function loadStats(slug: string): SessionStats {
  const store = getStorage();
  if (!store) return { ...EMPTY_STATS, rankHits: {} };
  try {
    const raw = store.getItem(statsKey(slug));
    if (raw === null) return { ...EMPTY_STATS, rankHits: {} };
    const parsed = JSON.parse(raw) as Partial<SessionStats>;
    return {
      handsPlayed: numberOr(parsed.handsPlayed, 0),
      totalWagered: numberOr(parsed.totalWagered, 0),
      totalWon: numberOr(parsed.totalWon, 0),
      bestSingleWin: numberOr(parsed.bestSingleWin, 0),
      rankHits: (parsed.rankHits && typeof parsed.rankHits === "object")
        ? Object.fromEntries(
            Object.entries(parsed.rankHits).filter(([, v]) => typeof v === "number"),
          ) as Partial<Record<HandRank, number>>
        : {},
    };
  } catch {
    return { ...EMPTY_STATS, rankHits: {} };
  }
}

/** Persist stats for a game. */
export function saveStats(slug: string, s: SessionStats): void {
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(statsKey(slug), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * Pure transition: produce the new stats record after one hand.
 * Does NOT touch storage — call saveStats(slug, ...) afterward to persist.
 */
export function recordHand(prev: SessionStats, bet: number, payout: number, rank: HandRank): SessionStats {
  const rankHits = { ...prev.rankHits };
  rankHits[rank] = (rankHits[rank] ?? 0) + 1;
  return {
    handsPlayed: prev.handsPlayed + 1,
    totalWagered: prev.totalWagered + bet,
    totalWon: prev.totalWon + payout,
    bestSingleWin: Math.max(prev.bestSingleWin, payout),
    rankHits,
  };
}

/** Reset the credit balance for one game to DEFAULT_CREDITS. */
export function resetCredits(slug: string): void {
  saveCredits(slug, DEFAULT_CREDITS);
}

/** Reset session stats for one game to EMPTY_STATS. */
export function resetStats(slug: string): void {
  saveStats(slug, { ...EMPTY_STATS, rankHits: {} });
}
