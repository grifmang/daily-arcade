/**
 * Drift 2049 — pure 4x4 merge mechanic.
 *
 * Determinism contract:
 *   - The starting board is given by `seed.initialBoard` (already includes two starting tiles).
 *   - Move set: "left" | "right" | "up" | "down".
 *   - After each successful move, a new tile is added at a position determined by the
 *     PRNG state — but to keep replay simple, we DERIVE the next tile placement from the
 *     post-move board itself: the deterministic placement is the FIRST empty cell scanned
 *     in row-major order. The new tile value is always 2 (we trade "Wordle-tier excitement"
 *     for replay simplicity; this is acceptable for MVP and documented).
 *   - This means: given the same seed and the same move log, the same final board ALWAYS results.
 *
 * Score: total of all merged values across the run.
 */

export type Move = "left" | "right" | "up" | "down";
export type Board = number[][];

export interface PlayState {
  board: Board;
  score: number;
  moves: Move[];
  over: boolean;
  won: boolean;
}

export function cloneBoard(b: Board): Board {
  return b.map(row => [...row]);
}

function compress(row: number[]): { row: number[]; merged: number } {
  const out: number[] = [];
  let merged = 0;
  let last = -1;
  for (const v of row) if (v !== 0) {
    if (last === -1) last = v;
    else if (last === v) { out.push(last * 2); merged += last * 2; last = -1; }
    else { out.push(last); last = v; }
  }
  if (last !== -1) out.push(last);
  while (out.length < row.length) out.push(0);
  return { row: out, merged };
}

function applyMove(board: Board, move: Move): { board: Board; gained: number; changed: boolean } {
  const N = 4;
  const next: Board = Array.from({ length: N }, () => Array(N).fill(0)) as Board;
  let gained = 0;
  let changed = false;
  if (move === "left" || move === "right") {
    for (let r = 0; r < N; r++) {
      const row = move === "left" ? [...board[r]!] : [...board[r]!].reverse();
      const { row: out, merged } = compress(row);
      const final = move === "left" ? out : out.reverse();
      for (let c = 0; c < N; c++) {
        next[r]![c] = final[c]!;
        if (final[c] !== board[r]![c]) changed = true;
      }
      gained += merged;
    }
  } else {
    for (let c = 0; c < N; c++) {
      const col: number[] = [];
      for (let r = 0; r < N; r++) col.push(board[r]![c]!);
      const orient = move === "up" ? col : col.reverse();
      const { row: out, merged } = compress(orient);
      const final = move === "up" ? out : out.reverse();
      for (let r = 0; r < N; r++) {
        next[r]![c] = final[r]!;
        if (final[r] !== board[r]![c]) changed = true;
      }
      gained += merged;
    }
  }
  return { board: next, gained, changed };
}

function placeNewTile(board: Board): Board {
  const next = cloneBoard(board);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (next[r]![c] === 0) {
      next[r]![c] = 2;
      return next;
    }
  }
  return next;
}

function hasMoves(board: Board): boolean {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (board[r]![c] === 0) return true;
    if (c < 3 && board[r]![c] === board[r]![c + 1]) return true;
    if (r < 3 && board[r]![c] === board[r + 1]![c]) return true;
  }
  return false;
}

export function step(state: PlayState, move: Move): PlayState {
  if (state.over) return state;
  const { board, gained, changed } = applyMove(state.board, move);
  if (!changed) return state;
  const placed = placeNewTile(board);
  const won = state.won || placed.flat().includes(2048);
  const over = !hasMoves(placed);
  return {
    board: placed,
    score: state.score + gained,
    moves: [...state.moves, move],
    over,
    won,
  };
}

export function initialState(initialBoard: Board): PlayState {
  return { board: cloneBoard(initialBoard), score: 0, moves: [], over: false, won: false };
}

/** Replay a move log from a deterministic seed. Server uses this for top-N verification. */
export function replay(initialBoard: Board, moves: Move[]): PlayState {
  let s = initialState(initialBoard);
  for (const m of moves) s = step(s, m);
  return s;
}

export function peakTile(board: Board): number {
  let max = 0;
  for (const row of board) for (const v of row) if (v > max) max = v;
  return max;
}

const TILE_EMOJI: Record<number, string> = {
  0: "⬛",
  2: "⬜",
  4: "🟫",
  8: "🟧",
  16: "🟧",
  32: "🟨",
  64: "🟨",
  128: "🟩",
  256: "🟩",
  512: "🟦",
  1024: "🟦",
  2048: "🟪",
  4096: "🟪",
};

export function shareGrid(state: PlayState): string {
  const peak = peakTile(state.board);
  // Render a 4-emoji bar of progress milestones up through the user's peak
  const milestones = [128, 256, 512, 1024, 2048];
  const bar = milestones.map(m => peak >= m ? TILE_EMOJI[m] : "⬛").join("");
  return bar;
}
