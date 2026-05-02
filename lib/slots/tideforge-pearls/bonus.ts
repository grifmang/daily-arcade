// Bonus state machine for Tideforge Pearls.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 6
import { Sym, type Grid, type SymbolId } from "./types";
import { BONUS_REELS, STRIP_LEN } from "./reels";
import { evaluateWays } from "./ways";
import type { SlotRng } from "./rng";

/** Hard safety cap on bonus spins to prevent infinite loops on pathological RNG (spec §6.4). */
export const BONUS_SAFETY_CAP = 500 as const;

/** Map scatter count on a base spin to free-spin trigger amount (spec §6.1). */
export function triggerSpins(scatCount: number): number {
  if (scatCount >= 5) return 20;
  if (scatCount === 4) return 15;
  if (scatCount === 3) return 8;
  return 0;
}

/** Map scatter count on a bonus spin to retrigger amount (spec §6.4). */
export function retriggerSpins(scatCount: number): number {
  if (scatCount >= 3) return triggerSpins(scatCount);
  if (scatCount === 2) return 5;
  return 0;
}

/**
 * Build the conversion map for a given collection-meter value (spec §6.3).
 * Returns null below the first threshold to short-circuit the no-op case.
 *
 * Note: there is intentionally NO MANTA conversion. The all-converted state
 * with MANTA->PEARL produces unbounded RTP tail behavior; capping at COELA
 * keeps the bucket-list fantasy intact while keeping the math finite.
 */
export function buildConversionMap(meter: number): Partial<Record<SymbolId, SymbolId>> | null {
  if (meter < 4) return null;
  const map: Partial<Record<SymbolId, SymbolId>> = {
    [Sym.ANGLER]: Sym.PEARL,
  };
  if (meter >= 8) map[Sym.SQUID] = Sym.PEARL;
  if (meter >= 13) map[Sym.COELA] = Sym.PEARL;
  return map;
}

/**
 * Roll bonus wild multipliers (spec §6.2).
 *
 * Each of columns 1, 2, 3 that contains at least one WILD rolls a single
 * x2 or x3 multiplier (50/50). Multiple wilds within the same column do NOT
 * compound. Cross-column compounding happens in evaluateWays via multiplication.
 *
 * Cols 0 and 4 always return 1 — real strips never place wilds there.
 */
export function rollWildMultsBonus(grid: Grid, rng: SlotRng): number[] {
  const out = [1, 1, 1, 1, 1];
  for (let c = 1; c <= 3; c++) {
    const col = grid[c]!;
    let hasWild = false;
    for (let r = 0; r < 4; r++) {
      if (col[r] === Sym.WILD) {
        hasWild = true;
        break;
      }
    }
    out[c] = hasWild ? (rng.next() < 0.5 ? 2 : 3) : 1;
  }
  return out;
}

/** Sample a 5x4 grid from the given reels using rng.nextInt(STRIP_LEN). */
export function sampleGrid(rng: SlotRng, reels: ReadonlyArray<ReadonlyArray<SymbolId>>): Grid {
  const grid: Grid = [];
  for (let c = 0; c < 5; c++) {
    const reel = reels[c]!;
    const start = rng.nextInt(reel.length);
    const col: SymbolId[] = [];
    for (let r = 0; r < 4; r++) col.push(reel[(start + r) % reel.length]!);
    grid.push(col);
  }
  return grid;
}

export interface BonusSpinTrace {
  meterAtStart: number;
  pearlsThisSpin: number;
  conversionMap: Partial<Record<SymbolId, SymbolId>> | null;
  spinWin: number;
  scatCount: number;
}

export interface BonusResult {
  totalWin: number;
  bonusSpinCount: number;
  finalMeter: number;
  trace?: BonusSpinTrace[];
}

export interface RunBonusOpts {
  /** When true, returns a per-spin trace for tests / debug overlays. */
  trace?: boolean;
  /** Override bonus reels (defaults to BONUS_REELS). Used by tests. */
  reels?: ReadonlyArray<ReadonlyArray<SymbolId>>;
}

/**
 * Run a bonus session. The collection meter persists across retriggers within
 * a single bonus session; it does NOT carry across separate triggers (spec §6).
 */
export function runBonus(rng: SlotRng, initialSpins: number, opts: RunBonusOpts = {}): BonusResult {
  const reels = opts.reels ?? BONUS_REELS;
  const trace: BonusSpinTrace[] | undefined = opts.trace ? [] : undefined;

  let spinsLeft = initialSpins;
  let meter = 0;
  let totalWin = 0;
  let bonusSpinCount = 0;

  while (spinsLeft > 0) {
    spinsLeft--;
    bonusSpinCount++;
    if (bonusSpinCount > BONUS_SAFETY_CAP) break;

    const meterAtStart = meter;
    const grid = sampleGrid(rng, reels);
    const wildMultPerCol = rollWildMultsBonus(grid, rng);
    const conversionMap = buildConversionMap(meter);
    const { totalWin: spinWin, scatCount } = evaluateWays(grid, { wildMultPerCol, conversionMap });
    totalWin += spinWin;

    // Count PEARLs landing this spin to update the meter.
    let pearlsThisSpin = 0;
    for (let c = 0; c < 5; c++) {
      const col = grid[c]!;
      for (let r = 0; r < 4; r++) if (col[r] === Sym.PEARL) pearlsThisSpin++;
    }
    meter += pearlsThisSpin;

    if (trace) {
      trace.push({
        meterAtStart,
        pearlsThisSpin,
        conversionMap,
        spinWin,
        scatCount,
      });
    }

    const retrig = retriggerSpins(scatCount);
    if (retrig > 0) spinsLeft += retrig;
  }

  return {
    totalWin,
    bonusSpinCount,
    finalMeter: meter,
    ...(trace ? { trace } : {}),
  };
}
