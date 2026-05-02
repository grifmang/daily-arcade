// Credit-balance and stats storage for Tideforge Pearls.
// Spec: ARCHITECTURE.md §14.5 (local-only state schema), DECISIONS.md ADR-S4.
//
// Credits are play-money only. localStorage is editable via DevTools — that's
// risk-accepted per ADR-S4. There is no server-side mirror, no submission,
// no leaderboard, no shareable artifact derived from credits.

export const CREDITS_KEY = "slots:tideforge-pearls:credits";
export const STATS_KEY = "slots:tideforge-pearls:stats";

/** Default starting balance, in dimensionless credits. */
export const DEFAULT_CREDITS = 1000 as const;

export interface SlotStats {
  spinsPlayed: number;
  totalWagered: number;
  totalWon: number;
  bonusesTriggered: number;
  bestSingleWin: number;
  /** ISO timestamp of the last balance reset. */
  lastResetAt: string;
}

/** A frozen "all zeros" stats record with a placeholder lastResetAt. */
export const EMPTY_STATS: SlotStats = Object.freeze({
  spinsPlayed: 0,
  totalWagered: 0,
  totalWon: 0,
  bonusesTriggered: 0,
  bestSingleWin: 0,
  lastResetAt: "1970-01-01T00:00:00.000Z",
});

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Some sandboxes (e.g. private browsing in some browsers) throw on access.
    return null;
  }
}

/**
 * Load the credit balance, returning DEFAULT_CREDITS when unset, corrupt, or
 * unparseable. Negative values are clamped to 0; fractional values are floored.
 */
export function loadCredits(): number {
  const store = getStorage();
  if (!store) return DEFAULT_CREDITS;
  try {
    const raw = store.getItem(CREDITS_KEY);
    if (raw === null) return DEFAULT_CREDITS;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_CREDITS;
    if (n < 0) return 0;
    return Math.floor(n);
  } catch {
    return DEFAULT_CREDITS;
  }
}

/** Persist a credit balance. Floored to integer; clamped to >= 0. */
export function saveCredits(n: number): void {
  const store = getStorage();
  if (!store) return;
  const clamped = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  try {
    store.setItem(CREDITS_KEY, String(clamped));
  } catch {
    /* private mode, quota exceeded, etc. */
  }
}

/** Load stats, returning EMPTY_STATS on missing or corrupt data. */
export function loadStats(): SlotStats {
  const store = getStorage();
  if (!store) return { ...EMPTY_STATS };
  try {
    const raw = store.getItem(STATS_KEY);
    if (raw === null) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<SlotStats>;
    return {
      spinsPlayed: numberOr(parsed.spinsPlayed, 0),
      totalWagered: numberOr(parsed.totalWagered, 0),
      totalWon: numberOr(parsed.totalWon, 0),
      bonusesTriggered: numberOr(parsed.bonusesTriggered, 0),
      bestSingleWin: numberOr(parsed.bestSingleWin, 0),
      lastResetAt:
        typeof parsed.lastResetAt === "string" && parsed.lastResetAt.length > 0
          ? parsed.lastResetAt
          : EMPTY_STATS.lastResetAt,
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Persist stats. */
export function saveStats(s: SlotStats): void {
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * Pure transition: produce the new stats record after one spin.
 * Does NOT touch storage — call saveStats(...) afterward to persist.
 */
export function recordSpinStat(
  s: SlotStats,
  ev: { wager: number; win: number; bonusTriggered: boolean },
): SlotStats {
  return {
    spinsPlayed: s.spinsPlayed + 1,
    totalWagered: s.totalWagered + ev.wager,
    totalWon: s.totalWon + ev.win,
    bonusesTriggered: s.bonusesTriggered + (ev.bonusTriggered ? 1 : 0),
    bestSingleWin: Math.max(s.bestSingleWin, ev.win),
    lastResetAt: s.lastResetAt,
  };
}

/**
 * Reset the balance to DEFAULT_CREDITS and zero out stats. Bumps `lastResetAt`
 * to the current ISO timestamp. Persists to storage in the same call.
 */
export function resetCredits(): { credits: number; stats: SlotStats } {
  const stats: SlotStats = {
    spinsPlayed: 0,
    totalWagered: 0,
    totalWon: 0,
    bonusesTriggered: 0,
    bestSingleWin: 0,
    lastResetAt: new Date().toISOString(),
  };
  saveCredits(DEFAULT_CREDITS);
  saveStats(stats);
  return { credits: DEFAULT_CREDITS, stats };
}
