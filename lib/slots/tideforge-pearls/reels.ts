// Reel-strip construction and the locked V27 reel compositions for Tideforge Pearls.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 4
import { Sym, type SymbolId } from "./types";

/** Each reel strip is exactly 60 symbols. */
export const STRIP_LEN = 60 as const;

export type StripComposition = Partial<Record<SymbolId, number>>;

/**
 * Build a strip from a composition (counts must sum to STRIP_LEN).
 *
 * Layout rules (spec §4.1):
 * 1. SCATs are placed at evenly-spaced positions: floor(i × STRIP_LEN / scatCount).
 *    This guarantees no 4-row contiguous window contains two scatters, giving
 *    precise control over trigger rate.
 * 2. WILDs are placed at evenly-spaced positions with a half-step offset:
 *    floor((i + 0.5) × STRIP_LEN / wildCount). Collisions with scatters
 *    skip to the next free slot.
 * 3. All other symbols are placed in clustered (declared) order:
 *    [PEARL, ANGLER, SQUID, COELA, MANTA, LOW, HIGH]. This is the standard
 *    contiguous-run layout players associate with traditional reel slots.
 *
 * The function is pure and deterministic given its input.
 */
export function buildStrip(counts: StripComposition): SymbolId[] {
  const total = Object.values(counts).reduce<number>((s, n) => s + (n ?? 0), 0);
  if (total !== STRIP_LEN) {
    throw new Error(`buildStrip: composition total ${total} != ${STRIP_LEN}`);
  }

  const result: (SymbolId | null)[] = new Array(STRIP_LEN).fill(null);

  // 1. Place SCATs at evenly-spaced positions.
  const scatCount = counts[Sym.SCAT] ?? 0;
  for (let i = 0; i < scatCount; i++) {
    const pos = Math.floor((i * STRIP_LEN) / scatCount);
    result[pos] = Sym.SCAT;
  }

  // 2. Place WILDs at evenly-spaced positions, half-step offset, with collision skip.
  const wildCount = counts[Sym.WILD] ?? 0;
  if (wildCount > 0) {
    const stepW = STRIP_LEN / wildCount;
    for (let i = 0; i < wildCount; i++) {
      let target = Math.floor((i + 0.5) * stepW) % STRIP_LEN;
      let attempts = 0;
      while (result[target] !== null && attempts < STRIP_LEN) {
        target = (target + 1) % STRIP_LEN;
        attempts++;
      }
      if (attempts < STRIP_LEN) result[target] = Sym.WILD;
    }
  }

  // 3. Fill remaining slots with non-scat / non-wild symbols in declared order.
  const fillOrder: SymbolId[] = [
    Sym.PEARL, Sym.ANGLER, Sym.SQUID, Sym.COELA, Sym.MANTA, Sym.LOW, Sym.HIGH,
  ];
  const stack: SymbolId[] = [];
  for (const s of fillOrder) {
    const n = counts[s] ?? 0;
    for (let i = 0; i < n; i++) stack.push(s);
  }

  let stackIdx = 0;
  for (let pos = 0; pos < STRIP_LEN; pos++) {
    if (result[pos] !== null) continue;
    if (stackIdx >= stack.length) {
      throw new Error(`buildStrip: ran out of fill symbols at position ${pos}`);
    }
    result[pos] = stack[stackIdx++]!;
  }

  return result as SymbolId[];
}

// ---------------------------------------------------------------------------
// Locked V27 reel compositions (spec §4.2, §4.3)
// ---------------------------------------------------------------------------

/**
 * Base-game reel compositions (locked V27) — counts per reel, summing to STRIP_LEN.
 * Royals are 17/17 (= 34/reel) for the wider hit-frequency lane;
 * tier symbols are correspondingly thinner. This is the configuration
 * Monte Carlo-verified at RTP 94.5–94.7% across 160M cross-validated spins.
 */
export const BASE_REEL_COMPOSITIONS: ReadonlyArray<StripComposition> = [
  // Reel 1: no WILD, SCAT 1
  { [Sym.PEARL]: 3, [Sym.ANGLER]: 4, [Sym.SQUID]: 4, [Sym.COELA]: 5, [Sym.MANTA]: 9, [Sym.LOW]: 17, [Sym.HIGH]: 17, [Sym.SCAT]: 1 },
  // Reel 2: WILD 3, SCAT 2
  { [Sym.PEARL]: 2, [Sym.ANGLER]: 3, [Sym.SQUID]: 4, [Sym.COELA]: 5, [Sym.MANTA]: 7, [Sym.LOW]: 17, [Sym.HIGH]: 17, [Sym.WILD]: 3, [Sym.SCAT]: 2 },
  // Reel 3: WILD 4, SCAT 1
  { [Sym.PEARL]: 2, [Sym.ANGLER]: 4, [Sym.SQUID]: 4, [Sym.COELA]: 4, [Sym.MANTA]: 7, [Sym.LOW]: 17, [Sym.HIGH]: 17, [Sym.WILD]: 4, [Sym.SCAT]: 1 },
  // Reel 4: WILD 3, SCAT 2
  { [Sym.PEARL]: 2, [Sym.ANGLER]: 3, [Sym.SQUID]: 4, [Sym.COELA]: 5, [Sym.MANTA]: 7, [Sym.LOW]: 17, [Sym.HIGH]: 17, [Sym.WILD]: 3, [Sym.SCAT]: 2 },
  // Reel 5: no WILD, SCAT 1
  { [Sym.PEARL]: 3, [Sym.ANGLER]: 4, [Sym.SQUID]: 4, [Sym.COELA]: 5, [Sym.MANTA]: 9, [Sym.LOW]: 17, [Sym.HIGH]: 17, [Sym.SCAT]: 1 },
];

/** Bonus-game reel compositions — PEARL is intentionally rare so the meter must be earned. */
export const BONUS_REEL_COMPOSITIONS: ReadonlyArray<StripComposition> = [
  // Reel 1
  { [Sym.PEARL]: 1, [Sym.ANGLER]: 5, [Sym.SQUID]: 6, [Sym.COELA]: 8, [Sym.MANTA]: 11, [Sym.LOW]: 14, [Sym.HIGH]: 14, [Sym.SCAT]: 1 },
  // Reel 2
  { [Sym.PEARL]: 1, [Sym.ANGLER]: 5, [Sym.SQUID]: 6, [Sym.COELA]: 7, [Sym.MANTA]: 10, [Sym.LOW]: 13, [Sym.HIGH]: 14, [Sym.WILD]: 3, [Sym.SCAT]: 1 },
  // Reel 3
  { [Sym.PEARL]: 1, [Sym.ANGLER]: 5, [Sym.SQUID]: 6, [Sym.COELA]: 7, [Sym.MANTA]: 9, [Sym.LOW]: 13, [Sym.HIGH]: 14, [Sym.WILD]: 4, [Sym.SCAT]: 1 },
  // Reel 4
  { [Sym.PEARL]: 1, [Sym.ANGLER]: 5, [Sym.SQUID]: 6, [Sym.COELA]: 7, [Sym.MANTA]: 10, [Sym.LOW]: 13, [Sym.HIGH]: 14, [Sym.WILD]: 3, [Sym.SCAT]: 1 },
  // Reel 5
  { [Sym.PEARL]: 2, [Sym.ANGLER]: 5, [Sym.SQUID]: 6, [Sym.COELA]: 8, [Sym.MANTA]: 10, [Sym.LOW]: 14, [Sym.HIGH]: 14, [Sym.SCAT]: 1 },
];

/** Locked V27 base reels — frozen at module load. */
export const BASE_REELS: ReadonlyArray<ReadonlyArray<SymbolId>> = BASE_REEL_COMPOSITIONS.map(
  (c) => Object.freeze(buildStrip(c))
);

/** Locked V27 bonus reels — frozen at module load. */
export const BONUS_REELS: ReadonlyArray<ReadonlyArray<SymbolId>> = BONUS_REEL_COMPOSITIONS.map(
  (c) => Object.freeze(buildStrip(c))
);
