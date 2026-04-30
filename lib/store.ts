/**
 * Storage abstraction. ADR-007.
 *
 * The default `InMemoryStore` is process-local. It is acceptable for previews and
 * dev. For production, a future PostgresStore will swap in (and the InMemoryStore
 * is hard-flagged in RUNBOOK.md).
 */
import "server-only";
import type { LeaderboardEntry, GameId, ShareRecord } from "./types";

export interface Store {
  putLeaderboardEntry(entry: LeaderboardEntry): Promise<{ rank: number; total: number }>;
  topN(gameId: GameId, date: string, n: number): Promise<LeaderboardEntry[]>;
  countForDate(gameId: GameId, date: string): Promise<number>;
  isHandleUsedToday(gameId: GameId, date: string, handle: string): Promise<number[]>; // returns existing discriminators

  putShare(rec: ShareRecord): Promise<void>;
  getShare(id: string): Promise<ShareRecord | null>;

  /** Per-IP-hash daily counters for rate limiting. */
  bumpRate(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

class InMemoryStore implements Store {
  private leaderboard = new Map<string, LeaderboardEntry[]>();   // key = `${gameId}:${date}`
  private shares = new Map<string, ShareRecord>();
  private rate = new Map<string, { count: number; windowStart: number }>();

  private key(gameId: GameId, date: string) {
    return `${gameId}:${date}`;
  }

  async putLeaderboardEntry(entry: LeaderboardEntry) {
    const k = this.key(entry.gameId, entry.date);
    const arr = this.leaderboard.get(k) ?? [];
    arr.push(entry);
    arr.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
    this.leaderboard.set(k, arr);
    const rank = arr.findIndex(e => e.shareId === entry.shareId) + 1;
    return { rank, total: arr.length };
  }

  async topN(gameId: GameId, date: string, n: number) {
    const arr = this.leaderboard.get(this.key(gameId, date)) ?? [];
    return arr.slice(0, n);
  }

  async countForDate(gameId: GameId, date: string) {
    return (this.leaderboard.get(this.key(gameId, date)) ?? []).length;
  }

  async isHandleUsedToday(gameId: GameId, date: string, handle: string) {
    const arr = this.leaderboard.get(this.key(gameId, date)) ?? [];
    const lower = handle.toLowerCase();
    return arr.filter(e => e.handle.toLowerCase() === lower).map(e => e.discriminator);
  }

  async putShare(rec: ShareRecord) {
    this.shares.set(rec.id, rec);
  }

  async getShare(id: string) {
    return this.shares.get(id) ?? null;
  }

  async bumpRate(key: string, windowMs: number) {
    const now = Date.now();
    const cur = this.rate.get(key);
    if (!cur || now - cur.windowStart >= windowMs) {
      this.rate.set(key, { count: 1, windowStart: now });
      return { count: 1, resetAt: now + windowMs };
    }
    cur.count += 1;
    return { count: cur.count, resetAt: cur.windowStart + windowMs };
  }
}

// Single shared instance per process. In serverless this will reset per cold start;
// that's a known limitation flagged in ADR-007 and RUNBOOK.md.
let _store: Store | null = null;
export function store(): Store {
  if (!_store) _store = new InMemoryStore();
  return _store;
}
