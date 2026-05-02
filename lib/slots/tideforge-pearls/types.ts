// Symbol IDs and shared type definitions for Tideforge Pearls.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md sections 2, 10

export const Sym = {
  PEARL: 0,
  ANGLER: 1,
  SQUID: 2,
  COELA: 3,
  MANTA: 4,
  LOW: 5,
  HIGH: 6,
  WILD: 7,
  SCAT: 8,
} as const;

export type SymbolId = (typeof Sym)[keyof typeof Sym];

// Display names — useful for UI labels and debug logs. Not load-bearing for math.
export const SYMBOL_NAME: Record<SymbolId, string> = {
  [Sym.PEARL]: "Storm Pearl",
  [Sym.ANGLER]: "Anglerfish",
  [Sym.SQUID]: "Giant Squid",
  [Sym.COELA]: "Coelacanth",
  [Sym.MANTA]: "Manta Ray",
  [Sym.LOW]: "Low Royal",
  [Sym.HIGH]: "High Royal",
  [Sym.WILD]: "Lightning Strike",
  [Sym.SCAT]: "Brass Bell",
};

// The set of symbols that pay on lines. WILD substitutes; SCAT triggers + pays flat at 5+.
export const PAYING_SYMBOLS: ReadonlyArray<SymbolId> = [
  Sym.PEARL, Sym.ANGLER, Sym.SQUID, Sym.COELA, Sym.MANTA, Sym.LOW, Sym.HIGH,
];

export type Grid = SymbolId[][]; // grid[col][row], 5 columns x 4 rows
