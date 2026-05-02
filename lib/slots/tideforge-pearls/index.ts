// Top-level entry point for Tideforge Pearls math.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 10
//
// Public API consumed by the UI client island:
//   spin(rng): BaseSpinResult
//
// All other modules (paytable, reels, ways, bonus, rng) are also re-exported
// for tests and the optional per-spin-trace UI overlays.

import type { Grid } from "./types";
import { BASE_REELS } from "./reels";
import { evaluateWays } from "./ways";
import { runBonus, sampleGrid, triggerSpins } from "./bonus";
import type { SlotRng } from "./rng";

export type { SymbolId, Grid } from "./types";
export { Sym, SYMBOL_NAME, PAYING_SYMBOLS } from "./types";
export { BET, PAYTABLE } from "./paytable";
export {
  STRIP_LEN,
  buildStrip,
  BASE_REELS,
  BONUS_REELS,
  BASE_REEL_COMPOSITIONS,
  BONUS_REEL_COMPOSITIONS,
} from "./reels";
export { evaluateWays } from "./ways";
export {
  triggerSpins,
  retriggerSpins,
  buildConversionMap,
  rollWildMultsBonus,
  sampleGrid,
  runBonus,
  BONUS_SAFETY_CAP,
} from "./bonus";
export type { BonusResult, BonusSpinTrace, RunBonusOpts } from "./bonus";
export { createSeededRng, createCryptoRng } from "./rng";
export type { SlotRng } from "./rng";
export { playSpin } from "./play";
export type { PlayResult } from "./play";
export {
  CREDITS_KEY,
  STATS_KEY,
  DEFAULT_CREDITS,
  EMPTY_STATS,
  loadCredits,
  saveCredits,
  loadStats,
  saveStats,
  recordSpinStat,
  resetCredits,
} from "./credits";
export type { SlotStats } from "./credits";

export interface BaseSpinResult {
  /** The 5x4 grid sampled from the base reels. */
  baseGrid: Grid;
  /** Total credits won from the base spin (line wins + flat scatter pay). */
  baseWin: number;
  /** Number of scatter symbols on the base grid. >= 3 means a bonus triggered. */
  scatCount: number;
  /** Whether a bonus session was triggered by the base spin. */
  bonusTriggered: boolean;
  /** Total credits won from the bonus session, if any. 0 otherwise. */
  bonusWin: number;
  /** Number of bonus spins played (0 if no bonus). */
  bonusSpinCount: number;
  /** Collection meter value at the end of the bonus session (0 if no bonus). */
  bonusFinalMeter: number;
  /** baseWin + bonusWin. */
  totalWin: number;
}

/**
 * Run one full base spin, including any triggered bonus session.
 *
 * The RNG is consumed by:
 *   - 5 calls to nextInt(STRIP_LEN) for the base grid
 *   - If bonus triggers: per-bonus-spin, 5 nextInt(STRIP_LEN) calls plus up to 3 next()
 *     calls for wild multiplier rolls.
 */
export function spin(rng: SlotRng): BaseSpinResult {
  const baseGrid = sampleGrid(rng, BASE_REELS);
  const { totalWin: baseWin, scatCount } = evaluateWays(baseGrid);

  if (scatCount >= 3) {
    const initialSpins = triggerSpins(scatCount);
    const bonus = runBonus(rng, initialSpins);
    return {
      baseGrid,
      baseWin,
      scatCount,
      bonusTriggered: true,
      bonusWin: bonus.totalWin,
      bonusSpinCount: bonus.bonusSpinCount,
      bonusFinalMeter: bonus.finalMeter,
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
    totalWin: baseWin,
  };
}
