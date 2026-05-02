// Paytable for Tideforge Pearls.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 3
import { Sym, type SymbolId } from "./types";

/** Bet per spin in credits. Fixed; not configurable in MVP. */
export const BET = 60 as const;

/**
 * Per-way pay in coins for each paying symbol at 3, 4, or 5 of a kind.
 * Total pay per symbol on a spin = ways × pay-per-way × wild-multiplier.
 * SCAT entries here are the flat scatter pay (separate from trigger logic).
 */
export const PAYTABLE: Record<SymbolId, { 3: number; 4: number; 5: number }> = {
  [Sym.PEARL]:  { 3: 22, 4: 55, 5: 105 },
  [Sym.ANGLER]: { 3: 13, 4: 30, 5: 62 },
  [Sym.SQUID]:  { 3: 9,  4: 22, 5: 50 },
  [Sym.COELA]:  { 3: 7,  4: 17, 5: 38 },
  [Sym.MANTA]:  { 3: 4,  4: 11, 5: 25 },
  [Sym.LOW]:    { 3: 1,  4: 2,  5: 3 },
  [Sym.HIGH]:   { 3: 1,  4: 2,  5: 3 },
  [Sym.SCAT]:   { 3: 0,  4: 0,  5: 60 },
  [Sym.WILD]:   { 3: 0,  4: 0,  5: 0 }, // wilds substitute; never pay independently
};
