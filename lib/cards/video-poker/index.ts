// Public API surface for the video-poker engine.
// Consumers (UI clients, tests) should import from here, not submodules.

export { Suit, Rank, HandRank, HAND_RANK_NAME } from "./types";
export type { Card, Hand, Deck } from "./types";

export { createSeededRng, createCryptoRng } from "./rng";
export type { SlotRng } from "./rng";

export { createDeck, shuffle } from "./deck";

export { evaluateHand } from "./evaluate";
export type { EvaluateOptions } from "./evaluate";

export { JOB_PAYTABLE, DEUCES_PAYTABLE, computePayout } from "./paytable";
export type { Paytable } from "./paytable";

export { startRound, applyHolds } from "./round";
export type { RoundStart, RoundResult } from "./round";

export {
  loadCredits, saveCredits, loadStats, saveStats, recordHand,
  resetCredits, resetStats, DEFAULT_CREDITS, EMPTY_STATS,
  creditsKey, statsKey,
} from "./credits";
export type { SessionStats } from "./credits";
