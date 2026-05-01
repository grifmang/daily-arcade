/** Shared types between server and client. */

export type GameId = "word-volley" | "drift-2049" | "snap-trivia";

export const ALL_GAMES: readonly GameId[] = ["word-volley", "drift-2049", "snap-trivia"];

export const GAME_LABELS: Record<GameId, string> = {
  "word-volley": "Word Volley",
  "drift-2049": "Drift 2049",
  "snap-trivia": "Snap Trivia",
};

export const GAME_TAGLINES: Record<GameId, string> = {
  "word-volley": "Five letters. Six tries. One word.",
  "drift-2049": "Slide, merge, push the tile.",
  "snap-trivia": "Five questions. Ten seconds each.",
};

export const GAME_GLYPHS: Record<GameId, string> = {
  "word-volley": "▣",
  "drift-2049": "◆",
  "snap-trivia": "⚡",
};

/** A leaderboard row, server-shaped. */
export interface LeaderboardEntry {
  gameId: GameId;
  date: string;            // YYYY-MM-DD
  handle: string;
  discriminator: number;
  score: number;
  shareId: string;
  createdAt: number;       // unix ms
}

/** Per-game daily seed config. */
export interface DailySeed {
  date: string;
  wordVolley: { target: string };
  drift2049: { initialBoard: number[][] };
  snapTrivia: { questionIds: number[] };
}

export interface ShareRecord {
  id: string;
  gameId: GameId;
  date: string;
  handle: string;
  discriminator: number;
  score: number;
  signature: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  /**
   * Submit-time snapshot of leaderboard rank (1-indexed) and total
   * submissions for (gameId, date) at the moment of submit. Optional
   * because pre-2026-04-30 share records don't have these — the OG
   * render falls through to the "no badge" branch when both are null.
   * See ARCADE-POLISH spec Feature 2.
   */
  rankAtSubmit?: number | null;
  totalAtSubmit?: number | null;
}
