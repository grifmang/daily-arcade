/**
 * Word Volley — pure logic.
 * 5-letter target, 6 guesses, Wordle-style green/yellow/grey grading.
 */

export type Tile = "green" | "yellow" | "grey";

/** Grade a guess against a target. Both UPPERCASE 5-letter strings. */
export function gradeGuess(guess: string, target: string): Tile[] {
  if (guess.length !== 5 || target.length !== 5) {
    throw new Error("Word Volley: guess and target must be 5 letters");
  }
  const result: Tile[] = ["grey", "grey", "grey", "grey", "grey"];
  // Count remaining letters in target after removing greens
  const remaining: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      result[i] = "green";
    } else {
      remaining[target[i]!] = (remaining[target[i]!] ?? 0) + 1;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "green") continue;
    const ch = guess[i]!;
    if ((remaining[ch] ?? 0) > 0) {
      result[i] = "yellow";
      remaining[ch]! -= 1;
    }
  }
  return result;
}

/** Score: lower guesses-to-win is better. We surface a score `7 - guessesUsed` for losses 0; wins => 1..6. */
export function scoreFromGuesses(grades: Tile[][]): { won: boolean; guessesUsed: number; score: number } {
  let won = false;
  let guessesUsed = grades.length;
  for (let i = 0; i < grades.length; i++) {
    if (grades[i]!.every(t => t === "green")) {
      won = true;
      guessesUsed = i + 1;
      break;
    }
  }
  if (!won) return { won: false, guessesUsed: grades.length, score: 0 };
  // Score: 100 for solving in 1, scaling down to 50 for 6.
  const score = Math.round(100 - (guessesUsed - 1) * 10);
  return { won: true, guessesUsed, score };
}

const TILE_EMOJI: Record<Tile, string> = {
  green: "🟩",
  yellow: "🟨",
  grey: "⬛",
};

export function shareGrid(grades: Tile[][]): string {
  return grades.map(row => row.map(t => TILE_EMOJI[t]).join("")).join("\n");
}
