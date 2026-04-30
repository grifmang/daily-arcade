/**
 * Snap Trivia — pure scoring.
 * 5 questions; 10 seconds per Q.
 * Score = (correct answers) * 100 + (time bonus per correct).
 */

import { TRIVIA_QUESTIONS } from "../content/trivia";

export const SECONDS_PER_QUESTION = 10;

export interface AnswerSubmission {
  questionId: number;
  choice: number; // 0..3
  msTaken: number; // 0..10000
}

export interface ScoredAnswer {
  questionId: number;
  correct: boolean;
  msTaken: number;
  // Time bonus: full marks under 2s, decays linearly to 0 at 10s. Only counts if correct.
  bonus: number;
}

export interface SnapTriviaResult {
  perQuestion: ScoredAnswer[];
  totalScore: number;
  correctCount: number;
}

export function score(answers: AnswerSubmission[]): SnapTriviaResult {
  const perQuestion: ScoredAnswer[] = answers.map(a => {
    const q = TRIVIA_QUESTIONS[a.questionId];
    if (!q) return { questionId: a.questionId, correct: false, msTaken: a.msTaken, bonus: 0 };
    const correct = a.choice === q.correctIndex;
    const clamped = Math.max(0, Math.min(SECONDS_PER_QUESTION * 1000, a.msTaken));
    const speed = 1 - clamped / (SECONDS_PER_QUESTION * 1000); // 1.0 instant ... 0.0 timeout
    const bonus = correct ? Math.round(50 * speed) : 0;
    return { questionId: a.questionId, correct, msTaken: clamped, bonus };
  });
  const correctCount = perQuestion.filter(p => p.correct).length;
  const totalScore = correctCount * 100 + perQuestion.reduce((acc, p) => acc + p.bonus, 0);
  return { perQuestion, totalScore, correctCount };
}

/** Wall-clock sanity check: a five-question run cannot complete in less than `minTotalMs`. */
export function isImpossiblyFast(answers: AnswerSubmission[], minTotalMs = 1500): boolean {
  const total = answers.reduce((acc, a) => acc + Math.max(0, a.msTaken), 0);
  return total < minTotalMs;
}

const TILE: { fast: string; slow: string; correct: string; wrong: string } = {
  fast: "⚡",
  slow: "·",
  correct: "✅",
  wrong: "❌",
};

export function shareGrid(result: SnapTriviaResult): string {
  return result.perQuestion
    .map(a => {
      const speed = a.msTaken < 3000 ? TILE.fast : TILE.slow;
      const sign = a.correct ? TILE.correct : TILE.wrong;
      return `${speed}${sign}`;
    })
    .join(" ");
}
