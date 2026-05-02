// 1024-ways evaluator for Tideforge Pearls.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 5
import { Sym, type Grid, type SymbolId, PAYING_SYMBOLS } from "./types";
import { PAYTABLE } from "./paytable";

export interface EvaluateOpts {
  /**
   * Per-column wild multiplier (length 5). 1 = no multiplier.
   * Only columns 1, 2, 3 (the wild-eligible columns) contribute multipliers.
   * Multiple wilds in the same column do NOT compound; cross-column wilds do.
   */
  wildMultPerCol?: ReadonlyArray<number>;

  /**
   * Optional symbol substitution applied as a view over the grid before evaluation.
   * Used by the bonus engine to convert lower-tier symbols to PEARL once the
   * collection meter passes the spec §6.3 thresholds.
   */
  conversionMap?: Partial<Record<SymbolId, SymbolId>> | null;
}

export interface EvaluateResult {
  totalWin: number;
  scatCount: number;
}

/**
 * Evaluate a 5x4 grid against the 1024-ways paytable.
 *
 * Rules (spec §5):
 * - Left-to-right consecutive matching from reel 1.
 * - WILD substitutes for everything except SCAT.
 * - Reel 1 must contain at least one non-wild of the candidate symbol
 *   (defensive rule against the "all-wild reel 1" double-count bug).
 * - Per-symbol pay = ways × pay-per-way × wild-multiplier-product.
 * - Symbols with paytable entry 0 don't count as a hit.
 */
export function evaluateWays(grid: Grid, opts: EvaluateOpts = {}): EvaluateResult {
  const wildMultPerCol = opts.wildMultPerCol ?? [1, 1, 1, 1, 1];
  const conversionMap = opts.conversionMap ?? null;

  // Apply conversion as a view (do not mutate the input grid).
  const view: Grid = conversionMap
    ? grid.map((col) => col.map((s) => (s in conversionMap ? (conversionMap[s] as SymbolId) : s)))
    : grid;

  let totalWin = 0;

  for (const sym of PAYING_SYMBOLS) {
    const counts: number[] = [0, 0, 0, 0, 0];
    const hasNonWild: boolean[] = [false, false, false, false, false];

    for (let c = 0; c < 5; c++) {
      let matches = 0;
      let nonWild = 0;
      const col = view[c]!;
      for (let r = 0; r < 4; r++) {
        const s = col[r]!;
        if (s === sym) {
          matches++;
          nonWild++;
        } else if (s === Sym.WILD) {
          matches++;
        }
      }
      counts[c] = matches;
      hasNonWild[c] = nonWild > 0;
    }

    if (counts[0] === 0) continue;

    // Determine longest left-to-right run of columns with at least one match.
    let runLen = 1;
    for (let c = 1; c < 5; c++) {
      if (counts[c]! > 0) runLen++;
      else break;
    }
    if (runLen < 3) continue;

    // Defensive rule: reel 1 must contain a non-wild of this symbol.
    if (!hasNonWild[0]) continue;

    const tierPays = PAYTABLE[sym] as { 3: number; 4: number; 5: number };
    const perWayPay =
      runLen === 5 ? tierPays[5] : runLen === 4 ? tierPays[4] : tierPays[3];
    if (!perWayPay) continue;

    // Ways = product of match counts across the run.
    let ways = counts[0]! * counts[1]! * counts[2]!;
    if (runLen >= 4) ways *= counts[3]!;
    if (runLen >= 5) ways *= counts[4]!;

    // Wild multiplier compound: each wild-eligible column (1, 2, 3) within the
    // run that contains a wild contributes its multiplier once. Cols 0 and 4
    // are never wild-eligible (real strips have no wilds there).
    let mult = 1;
    for (let c = 1; c < runLen && c <= 3; c++) {
      const m = wildMultPerCol[c] ?? 1;
      if (m > 1) {
        const colHasWild = view[c]!.some((s) => s === Sym.WILD);
        if (colHasWild) mult *= m;
      }
    }

    totalWin += ways * perWayPay * mult;
  }

  // Scatter pay (flat at 5+).
  let scatCount = 0;
  for (let c = 0; c < 5; c++) {
    const col = view[c]!;
    for (let r = 0; r < 4; r++) if (col[r] === Sym.SCAT) scatCount++;
  }
  if (scatCount >= 3) {
    const pays = PAYTABLE[Sym.SCAT] as { 3: number; 4: number; 5: number };
    const tier = scatCount >= 5 ? 5 : scatCount === 4 ? 4 : 3;
    const sp = pays[tier];
    if (sp) totalWin += sp;
  }

  return { totalWin, scatCount };
}
