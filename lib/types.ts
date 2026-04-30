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
}
