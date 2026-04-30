"use client";
import * as React from "react";
import { utcDateString } from "@/lib/utils";

interface StreakState {
  current: number;
  best: number;
  lastPlayedUtc: string | null;
}

const KEY = "da:streak";
const COMPLETED_KEY = "da:completed";

function load(): StreakState {
  if (typeof window === "undefined") return { current: 0, best: 0, lastPlayedUtc: null };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { current: 0, best: 0, lastPlayedUtc: null };
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    return {
      current: typeof parsed.current === "number" ? parsed.current : 0,
      best: typeof parsed.best === "number" ? parsed.best : 0,
      lastPlayedUtc: typeof parsed.lastPlayedUtc === "string" ? parsed.lastPlayedUtc : null,
    };
  } catch {
    return { current: 0, best: 0, lastPlayedUtc: null };
  }
}

function save(s: StreakState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* private mode etc. */ }
}

/**
 * Day delta between two YYYY-MM-DD strings (UTC). Stable: parses as 00:00Z.
 */
function dayDiff(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function useStreak() {
  const [state, setState] = React.useState<StreakState>({ current: 0, best: 0, lastPlayedUtc: null });

  React.useEffect(() => {
    setState(load());
    // Re-evaluate on focus (in case the user crossed midnight)
    const onFocus = () => setState(prev => maybeReset(prev));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const recordPlay = React.useCallback(() => {
    setState(prev => {
      const today = utcDateString();
      if (prev.lastPlayedUtc === today) return prev; // already counted today
      let current = 1;
      if (prev.lastPlayedUtc) {
        const delta = dayDiff(prev.lastPlayedUtc, today);
        if (delta === 1) current = prev.current + 1;
        else if (delta === 0) current = prev.current; // shouldn't reach
        else current = 1; // streak broke
      }
      const best = Math.max(prev.best, current);
      const next = { current, best, lastPlayedUtc: today };
      save(next);
      return next;
    });
  }, []);

  return { ...state, recordPlay };
}

function maybeReset(prev: StreakState): StreakState {
  if (!prev.lastPlayedUtc) return prev;
  const today = utcDateString();
  const delta = dayDiff(prev.lastPlayedUtc, today);
  if (delta > 1) {
    const next = { current: 0, best: prev.best, lastPlayedUtc: prev.lastPlayedUtc };
    save(next);
    return next;
  }
  return prev;
}

/** Per-day completion map. */
export function markCompleted(gameId: string) {
  if (typeof window === "undefined") return;
  const today = utcDateString();
  let map: Record<string, Record<string, boolean>> = {};
  try {
    const raw = window.localStorage.getItem(COMPLETED_KEY);
    if (raw) map = JSON.parse(raw);
  } catch { /* ignore */ }
  if (!map[today]) map[today] = {};
  map[today]![gameId] = true;
  try {
    window.localStorage.setItem(COMPLETED_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function getCompletedToday(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COMPLETED_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    return map[utcDateString()] ?? {};
  } catch { return {}; }
}

/** Reactive hook for the per-day completion map. */
export function useCompletedToday() {
  const [completed, setCompleted] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    setCompleted(getCompletedToday());
    const onStorage = () => setCompleted(getCompletedToday());
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
    };
  }, []);
  return completed;
}
