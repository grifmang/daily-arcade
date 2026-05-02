// Player-facing one-spin "play" helper for Tideforge Pearls.
//
// Wraps the math-module spin() to produce a single PlayResult with the bonus
// trace pre-populated for UI animation. The UI client island calls playSpin()
// once per spin button press and then walks the trace to drive the bonus
// reveal sequence.
import { sampleGrid, runBonus, triggerSpins, type BonusSpinTrace } from "./bonus";
import { BASE_REELS } from "./reels";
import { evaluateWays } from "./ways";
import type { Grid } from "./types";
import type { SlotRng } from "./rng";

export interface PlayResult {
  baseGrid: Grid;
  baseWin: number;
  scatCount: number;
  bonusTriggered: boolean;
  bonusWin: number;
  bonusSpinCount: number;
  bonusFinalMeter: number;
  /**
   * One entry per bonus spin. Empty array when no bonus was triggered.
   * Sum of `spinWin` across the trace equals `bonusWin`.
   */
  bonusTrace: BonusSpinTrace[];
  totalWin: number;
}

/**
 * Run one full base spin. If the base spin triggers a bonus, run it with
 * `trace: true` so the UI can animate each bonus step.
 */
export function playSpin(rng: SlotRng): PlayResult {
  const baseGrid = sampleGrid(rng, BASE_REELS);
  const { totalWin: baseWin, scatCount } = evaluateWays(baseGrid);

  if (scatCount >= 3) {
    const initialSpins = triggerSpins(scatCount);
    const bonus = runBonus(rng, initialSpins, { trace: true });
    return {
      baseGrid,
      baseWin,
      scatCount,
      bonusTriggered: true,
      bonusWin: bonus.totalWin,
      bonusSpinCount: bonus.bonusSpinCount,
      bonusFinalMeter: bonus.finalMeter,
      bonusTrace: bonus.trace ?? [],
      totalWin: baseWin + bonus.totalWin,
    };
  }

  return {
    baseGrid,
    baseWin,
    scatCount,
    bonusTriggered: false,
    bonusWin: 0,
    bonusSpinCount: 0,
    bonusFinalMeter: 0,
    bonusTrace: [],
    totalWin: baseWin,
  };
}
