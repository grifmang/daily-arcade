/** Daily seed engine. Pure, deterministic, server-side. */
import "server-only";
import { prngForDate, XoShiRo } from "./prng";
import { env } from "./env";
import { utcDateString } from "./utils";
import { WORD_TARGETS } from "./content/word-targets";
import { TRIVIA_QUESTIONS } from "./content/trivia";
import type { DailySeed } from "./types";

/**
 * Build a deterministic 4x4 starting board for Drift 2049.
 *  - 14 empty cells
 *  - 2 cells of value 2
 *  - position chosen by the PRNG
 */
function buildDrift2049Board(rng: XoShiRo): number[][] {
  const board = Array.from({ length: 4 }, () => Array(4).fill(0)) as number[][];
  const positions: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) positions.push([r, c]);
  rng.shuffle(positions);
  const [a, b] = [positions[0]!, positions[1]!];
  board[a[0]]![a[1]] = 2;
  board[b[0]]![b[1]] = 2;
  return board;
}

function pickWordTarget(rng: XoShiRo): string {
  return rng.pick(WORD_TARGETS);
}

function pickTriviaIds(rng: XoShiRo): number[] {
  // Choose 5 questions across mixed categories.
  const ids = TRIVIA_QUESTIONS.map((q, i) => i);
  const shuffled = rng.shuffle([...ids]);
  return shuffled.slice(0, 5);
}

export function buildDailySeed(date: string): DailySeed {
  const rng = prngForDate(date, env.shareSigningSecret); // dev fallback consistent
  // Use *separate* PRNG branches per game so changing one game's logic
  // doesn't shift another game's daily target.
  const wvRng = prngForDate(`wv:${date}`, env.shareSigningSecret);
  const dRng = prngForDate(`d:${date}`, env.shareSigningSecret);
  const stRng = prngForDate(`st:${date}`, env.shareSigningSecret);
  void rng; // reserved for future shared randomness
  return {
    date,
    wordVolley: { target: pickWordTarget(wvRng) },
    drift2049: { initialBoard: buildDrift2049Board(dRng) },
    snapTrivia: { questionIds: pickTriviaIds(stRng) },
  };
}

/** Today's seed, in UTC. */
export function seedForToday(): DailySeed {
  return buildDailySeed(utcDateString());
}
