# Video Poker Engine — Math Design Spec

**Date:** 2026-05-01
**Status:** Draft, locks at end of Phase 3
**Brainstorm spec:** `docs/superpowers/specs/2026-05-01-card-parlor-design.md`
**Plan:** `docs/superpowers/plans/2026-05-01-card-parlor.md`

This spec captures the math layer of the video-poker engine that powers both Jacks or Better and Deuces Wild. The design spec defers per-row paytable values, exact hand-evaluator semantics, and test plans here. The paytable values below are widely-published industry standards (factual data, not copyrightable creative expression). Implementers MUST cross-check against canonical Wizard of Odds references before locking the constants in `lib/cards/video-poker/paytable.ts`.

## 1. Card / Suit / Rank model

Concrete TypeScript types (also defined in `lib/cards/video-poker/types.ts`):

```ts
enum Suit {
  SPADES = "S",
  HEARTS = "H",
  DIAMONDS = "D",
  CLUBS = "C",
}

enum Rank {
  TWO = 2, THREE = 3, FOUR = 4, FIVE = 5, SIX = 6, SEVEN = 7,
  EIGHT = 8, NINE = 9, TEN = 10, JACK = 11, QUEEN = 12, KING = 13, ACE = 14,
}

interface Card { suit: Suit; rank: Rank; }
type Hand = readonly [Card, Card, Card, Card, Card];
type Deck = readonly Card[];
```

The 52-card deck is the cartesian product of 4 suits × 13 ranks. No jokers. Ace is always treated as `14` for ordering; the evaluator handles the Ace-low straight (A-2-3-4-5) as a special case.

## 2. HandRank enum

Ordered worst-to-best within each evaluator mode:

```ts
enum HandRank {
  NONE = 0,
  JACKS_OR_BETTER = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
  // Wild-mode-only ranks, slot in above ROYAL_FLUSH:
  FIVE_OF_A_KIND = 10,
  FOUR_DEUCES = 11,
  WILD_ROYAL_FLUSH = 12,
  NATURAL_ROYAL_FLUSH = 13,
}
```

**Standard mode (JoB)** returns ranks `0..9`.
**Wild mode (Deuces)** returns `{0, 3..8} ∪ {10..13}` plus the no-deuce path may return `5, 6, 7, 8` (Flush/Full House/Four/Straight Flush — natural). Standard `ROYAL_FLUSH` (9) is **never returned in wild mode** — it becomes `NATURAL_ROYAL_FLUSH` (13) when no deuces are present, or `WILD_ROYAL_FLUSH` (12) when at least one deuce was used as a wild.

## 3. Standard evaluator semantics (Jacks or Better)

Function: `evaluateHandStandard(cards: Card[5]): HandRank`

Algorithm:

1. Sort the 5 ranks ascending.
2. Compute `isFlush` — all 5 cards share one suit.
3. Compute `isStraight` — 5 consecutive ranks OR Ace-low (sorted ranks `[2, 3, 4, 5, 14]`).
4. Compute `isRoyalRanks` — sorted ranks are exactly `[10, 11, 12, 13, 14]` (which implies `isStraight === true`).
5. Build a rank-frequency histogram: `Map<Rank, number>`. Sort the frequency counts descending.

Classification cascade (first match wins):

| Condition | Result |
|---|---|
| `isFlush && isRoyalRanks` | `ROYAL_FLUSH` |
| `isFlush && isStraight` | `STRAIGHT_FLUSH` |
| `counts[0] === 4` | `FOUR_OF_A_KIND` |
| `counts[0] === 3 && counts[1] === 2` | `FULL_HOUSE` |
| `isFlush` | `FLUSH` |
| `isStraight` | `STRAIGHT` |
| `counts[0] === 3` | `THREE_OF_A_KIND` |
| `counts[0] === 2 && counts[1] === 2` | `TWO_PAIR` |
| `counts[0] === 2 && pair-rank ∈ {JACK, QUEEN, KING, ACE}` | `JACKS_OR_BETTER` |
| else | `NONE` |

**Ace-low straight detection:** the sorted-ranks pattern `[2, 3, 4, 5, 14]` qualifies as a straight (the Ace is treated as a 1 below the 2). The implementer must NOT classify `[2, 3, 4, 13, 14]` (an A-K-2-3-4 with no wraparound) as a straight — only the explicit Ace-low case wraps.

## 4. Wild evaluator semantics (Deuces Wild)

Function: `evaluateHandWild(cards: Card[5], wildRank: Rank): HandRank` — `wildRank = Rank.TWO` for Deuces.

Algorithm:

1. Count the wilds (cards with `rank === wildRank`).
2. Branch on wild count:

**4 wilds** → return `FOUR_DEUCES` immediately. The fifth card is irrelevant for this rank.

**0 wilds** → run `evaluateHandStandard` on the unmodified hand. Then apply post-processing:
- If standard returns `ROYAL_FLUSH` → return `NATURAL_ROYAL_FLUSH`.
- If standard returns `JACKS_OR_BETTER` or `TWO_PAIR` → return `NONE` (Deuces does not pay pairs or two pair).
- Otherwise return the standard result unchanged.

**1, 2, or 3 wilds** → enumerate every possible (rank, suit) substitution for each wild. For each substitution tuple, evaluate the resulting 5-card hand via `evaluateHandStandard`, then apply wild-mode rewrites (see below). Return the highest resulting `HandRank`.

Substitution count: `52^k` for `k` wilds. Worst case is 3 wilds → 52³ = 140,608 substitutions. Tractable per-hand; not in a Monte Carlo loop.

Wild-mode rewrites applied to each substituted hand's `evaluateHandStandard` result:

| Standard result | Wild-mode result | Why |
|---|---|---|
| `ROYAL_FLUSH` (with at least 1 wild used) | `WILD_ROYAL_FLUSH` | Royal Flush built using a deuce as a wild |
| Any result, if 5 cards same rank counting wilds | `FIVE_OF_A_KIND` | Special wild-only rank |
| `JACKS_OR_BETTER` | `NONE` | Pairs do not pay in Deuces |
| `TWO_PAIR` | `NONE` | Two pair does not pay in Deuces |
| Otherwise | unchanged | Standard ranks pass through |

**Five of a Kind detection:** in the substituted hand, any rank appearing 5 times qualifies. Since the original hand has `k` wilds and `5−k` naturals, FIVE_OF_A_KIND is reachable when the naturals share a rank and all wilds substitute as that rank.

**Wild Royal vs Natural Royal distinction:** the rewrite step relies on knowing whether wilds were used. Implementer can either (a) check `wildCount > 0` at the call site, or (b) check whether any of the 5 cards in the `Royal Flush`-classified hand has `rank === wildRank` in the **original** (pre-substitution) hand. Both are equivalent.

## 5. Paytable definitions

These values are widely-published industry standards. Implementers MUST verify against the canonical Wizard of Odds reference (https://wizardofodds.com — search "Jacks or Better 9/6" and "Deuces Wild Not So Ugly") before locking the constants in `paytable.ts`. If any value differs, update the constant to match the reference and document the deviation.

### 9/6 Jacks or Better

Per-coin payout (bet=1):

| HandRank | Pays |
|---|---|
| NONE | 0 |
| JACKS_OR_BETTER | 1 |
| TWO_PAIR | 2 |
| THREE_OF_A_KIND | 3 |
| STRAIGHT | 4 |
| FLUSH | **6** |
| FULL_HOUSE | **9** |
| FOUR_OF_A_KIND | 25 |
| STRAIGHT_FLUSH | 50 |
| ROYAL_FLUSH | 250 |
| (Wild-mode-only ranks) | 0 |

The paytable is named "9/6" for the Full House (9) and Flush (6) values. RTP under optimal-strategy play: ~99.54%.

**5-coin Royal Flush bonus:** at bet=5, Royal Flush pays 4000 instead of `250 × 5 = 1250`. This is the only non-linear bet bonus; every other row scales linearly with bet.

### NSUD Deuces Wild

NSUD = "Not So Ugly Deuces." Per-coin payout (bet=1):

| HandRank | Pays |
|---|---|
| NONE | 0 |
| JACKS_OR_BETTER | 0 |
| TWO_PAIR | 0 |
| THREE_OF_A_KIND | 1 |
| STRAIGHT | 2 |
| FLUSH | 2 |
| FULL_HOUSE | 3 |
| FOUR_OF_A_KIND | 4 |
| STRAIGHT_FLUSH | 13 |
| ROYAL_FLUSH | 0 |
| FIVE_OF_A_KIND | 16 |
| FOUR_DEUCES | 200 |
| WILD_ROYAL_FLUSH | 25 |
| NATURAL_ROYAL_FLUSH | 250 |

The defining row for Deuces variants is the 6-tuple Three-of-a-Kind / Straight / Flush / Full House / Four / Straight Flush. NSUD's tuple `1-2-2-3-4-13` plus Five-of-a-Kind=16 is canonical 99.73% RTP under optimal-strategy play.

**5-coin Natural Royal Flush bonus:** at bet=5, NATURAL_ROYAL_FLUSH pays 4000 instead of `250 × 5 = 1250`. **Wild Royal Flush does NOT trigger this bonus** — at bet=5 it pays `25 × 5 = 125`.

**Standard `ROYAL_FLUSH` (9) maps to 0 pays** in the Deuces paytable — the wild-mode evaluator never returns this rank, but the constant slot is included for type completeness.

## 6. Bet selector contract

- Range: integer `1..5` coins per hand.
- All paytable values scale linearly with bet, EXCEPT the top tier (`ROYAL_FLUSH` in JoB, `NATURAL_ROYAL_FLUSH` in Deuces) which jumps from `250 × bet` to `4000` at `bet === 5`.
- Bet of 0 is invalid — the spin button is disabled when balance falls below 1 coin.
- Implementer's `computePayout(rank, paytable, bet)` enforces:
  - Throws if `bet` is not an integer in `[1, 5]`.
  - Returns `paytable[rank] * bet` for non-top-tier rows.
  - Returns `4000` when `bet === 5` and `rank === topTier(paytable)`.

## 7. Round state machine

Formal description (also captured in ARCHITECTURE.md Section 15.6):

```
dealing    — RNG draws 5 cards from a freshly shuffled 52-card deck.
             Transition: → holding.
holding    — Player toggles HOLD on 0..5 cards. No state change in RNG.
             Primary action button reads DRAW.
             Transition on DRAW: → drawing.
drawing    — Held cards stay; un-held cards are replaced from the same
             shuffled deck (positions 5..(5 + heldCount − 1)).
             Transition: → evaluating.
evaluating — Final hand classified via evaluateHand(opts.wildRank).
             Paytable applied: payout = computePayout(rank, paytable, bet).
             Credits updated: credits = credits − bet + payout.
             Stats updated.
             Transition: → done.
done       — UI displays the result. Primary action button reads DEAL.
             Transition on DEAL: → dealing (start a new round).
```

The deck shuffle is per-round, not per-phase — the draw step pulls from the same shuffled deck rather than re-shuffling. This is the standard physical-cabinet behavior and ensures a 52-card deck guarantees 5+5 = 10 unique cards across deal+draw.

## 8. RNG contract

- **Runtime:** `createCryptoRng()` wraps `crypto.getRandomValues`. A fresh RNG instance per round (the `startRound` caller decides; default is `createCryptoRng()` at the call site).
- **Tests:** `createSeededRng(seed: bigint)` uses xoshiro256** seeded via splitmix64. Deterministic — same seed produces the same sequence indefinitely.
- Both expose the `SlotRng` interface (`next(): number` returning `[0, 1)`, `nextInt(maxExclusive): number` returning `[0, maxExclusive)` integer).
- The `nextInt(1)` edge case must return `0` without entering the rejection-sampling loop (regression from the slot RNG fix).

## 9. Test plan — golden vectors for the hand evaluator

50+ specific hands. Cards spelled out as (rank, suit). Tests assert the expected `HandRank` for each.

### Standard mode (Jacks or Better) — `wildRank: null`

Royal Flush:
1. (10♠, J♠, Q♠, K♠, A♠) → `ROYAL_FLUSH`
2. (10♥, J♥, Q♥, K♥, A♥) → `ROYAL_FLUSH`
3. (10♦, J♦, Q♦, K♦, A♦) → `ROYAL_FLUSH`
4. (10♣, J♣, Q♣, K♣, A♣) → `ROYAL_FLUSH`

Straight Flush (not royal):
5. (5♥, 6♥, 7♥, 8♥, 9♥) → `STRAIGHT_FLUSH`
6. (A♦, 2♦, 3♦, 4♦, 5♦) → `STRAIGHT_FLUSH` (Ace-low)
7. (9♠, 10♠, J♠, Q♠, K♠) → `STRAIGHT_FLUSH`

Four of a Kind:
8. (A♠, A♥, A♦, A♣, K♠) → `FOUR_OF_A_KIND`
9. (7♠, 7♥, 7♦, 7♣, 2♠) → `FOUR_OF_A_KIND`

Full House:
10. (Q♠, Q♥, Q♦, 5♣, 5♠) → `FULL_HOUSE`
11. (3♠, 3♥, 3♦, K♣, K♠) → `FULL_HOUSE`

Flush:
12. (2♣, 5♣, 7♣, 9♣, J♣) → `FLUSH`
13. (3♥, 6♥, 8♥, 10♥, K♥) → `FLUSH`

Straight:
14. (4♠, 5♥, 6♦, 7♣, 8♠) → `STRAIGHT`
15. (A♠, 2♥, 3♦, 4♣, 5♠) → `STRAIGHT` (Ace-low)
16. (10♠, J♥, Q♦, K♣, A♠) → `STRAIGHT` (Ace-high broadway, mixed suits)

Three of a Kind:
17. (7♠, 7♥, 7♦, J♣, 2♠) → `THREE_OF_A_KIND`
18. (10♠, 10♥, 10♦, 4♣, 6♠) → `THREE_OF_A_KIND`

Two Pair:
19. (J♠, J♥, 3♦, 3♣, K♠) → `TWO_PAIR`
20. (8♠, 8♥, 4♦, 4♣, 9♠) → `TWO_PAIR`

Jacks or Better:
21. (Q♠, Q♥, 3♦, 5♣, 7♠) → `JACKS_OR_BETTER`
22. (J♠, J♥, 4♦, 6♣, 9♠) → `JACKS_OR_BETTER`
23. (K♠, K♥, 2♦, 5♣, 8♠) → `JACKS_OR_BETTER`
24. (A♠, A♥, 3♦, 7♣, J♠) → `JACKS_OR_BETTER`

NONE — pair below jacks:
25. (10♠, 10♥, 3♦, 5♣, 7♠) → `NONE`
26. (9♠, 9♥, 2♦, 4♣, 6♠) → `NONE`

NONE — high-card junk and the no-wraparound check:
27. (2♠, 7♥, 9♦, J♣, K♠) → `NONE`
28. (A♠, K♥, 2♦, 3♣, 4♠) → `NONE` (no wraparound; A-K-2-3-4 is NOT a straight)

### Wild mode (Deuces Wild) — `wildRank: Rank.TWO`

Natural Royal Flush (no deuces):
29. (10♥, J♥, Q♥, K♥, A♥) → `NATURAL_ROYAL_FLUSH`
30. (10♠, J♠, Q♠, K♠, A♠) → `NATURAL_ROYAL_FLUSH`

Four Deuces:
31. (2♠, 2♥, 2♦, 2♣, K♠) → `FOUR_DEUCES`
32. (2♠, 2♥, 2♦, 2♣, 3♣) → `FOUR_DEUCES`

Wild Royal Flush (one+ deuce filling a Royal):
33. (J♥, Q♥, K♥, A♥, 2♣) → `WILD_ROYAL_FLUSH`
34. (10♠, J♠, Q♠, 2♥, A♠) → `WILD_ROYAL_FLUSH`
35. (10♦, 2♣, Q♦, K♦, A♦) → `WILD_ROYAL_FLUSH`

Five of a Kind:
36. (K♠, K♥, K♦, 2♣, 2♠) → `FIVE_OF_A_KIND`
37. (8♠, 8♥, 8♦, 8♣, 2♥) → `FIVE_OF_A_KIND`
38. (Q♠, Q♥, 2♦, 2♣, 2♠) → `FIVE_OF_A_KIND`

Straight Flush (with wilds — should beat or equal wild-royal classification):
39. (5♠, 6♠, 2♦, 8♠, 9♠) → `STRAIGHT_FLUSH` (deuce fills the 7)
40. (3♥, 4♥, 5♥, 2♣, 7♥) → `STRAIGHT_FLUSH` (deuce fills the 6)

Four of a Kind:
41. (A♠, A♥, A♦, A♣, K♠) → `FOUR_OF_A_KIND` (natural — no deuces)
42. (J♠, J♥, J♦, 2♣, K♠) → `FOUR_OF_A_KIND` (one deuce as fourth jack)
43. (5♠, 5♥, 2♦, 2♣, 9♠) → `FOUR_OF_A_KIND` (two deuces as two more fives)

Full House:
44. (7♠, 7♥, 7♦, J♣, J♠) → `FULL_HOUSE`
45. (Q♠, Q♥, 5♦, 5♣, 2♠) → `FULL_HOUSE` (deuce as third Q OR third 5 — evaluator picks the best)

Flush (no straight, all same suit, may include deuce):
46. (3♠, 6♠, 8♠, J♠, K♠) → `FLUSH`
47. (4♥, 7♥, 9♥, 2♥, K♥) → `FLUSH` — deuce is in the flush as a 2♥; substituting it as another flush card or non-flush card never beats Flush in this case (but the evaluator must enumerate to verify)

Straight (no flush, may include deuce):
48. (4♠, 5♥, 6♦, 7♣, 8♠) → `STRAIGHT`
49. (3♠, 4♥, 5♦, 2♣, 7♠) → `STRAIGHT` (deuce as a 6)

Three of a Kind:
50. (9♠, 9♥, 2♦, 5♣, 7♠) → `THREE_OF_A_KIND` (deuce as third 9)
51. (J♠, J♥, J♦, 5♣, 9♠) → `THREE_OF_A_KIND` (natural three jacks)

NONE — pair (does NOT pay in Deuces):
52. (J♠, J♥, 3♦, 5♣, 7♠) → `NONE` (pair of jacks — no payout in Deuces)
53. (A♠, A♥, 4♦, 6♣, 8♠) → `NONE` (pair of aces — no payout)

NONE — two pair (does NOT pay in Deuces):
54. (J♠, J♥, 3♦, 3♣, 7♠) → `NONE`

NONE — high-card junk, no deuces:
55. (3♠, 7♥, 9♦, J♣, K♠) → `NONE`

The implementer can add additional vectors to cover the substitution exhaustiveness paths as needed.

## 10. Test plan — paytable transcription

Both paytables are exported as `Object.freeze`'d constants. Tests assert each `[HandRank.X]: Y` mapping verbatim:

- `JOB_PAYTABLE[HandRank.NONE] === 0`
- `JOB_PAYTABLE[HandRank.JACKS_OR_BETTER] === 1`
- ... (10 standard rows)
- Wild-mode-only rows in `JOB_PAYTABLE` are 0 (4 rows).
- `DEUCES_PAYTABLE[HandRank.NONE] === 0`
- `DEUCES_PAYTABLE[HandRank.THREE_OF_A_KIND] === 1`
- ... (8 wild-mode paying rows)
- Standard pair / two-pair / standard royal rows in `DEUCES_PAYTABLE` are 0 (3 rows).

Plus separate `computePayout` tests:
- Linear scaling for non-top-tier hands at bet=1 and bet=5.
- JoB Royal Flush: 250, 500, 750, 1000, 4000 at bets 1..5.
- Deuces Natural Royal Flush: 250, 500, 750, 1000, 4000 at bets 1..5.
- Deuces Wild Royal Flush at bet=5: 125 (`25 × 5`, no bonus).
- Throws for bet=0, bet=6, bet=1.5.

## 11. Test plan — deck shuffle uniformity

10,000 shuffles, count how often each (rank, suit) pair appears in position 0 of the shuffled deck. Expected count per cell: `10000 / 52 ≈ 192.3`. Compute chi-square statistic against the uniform distribution over 52 cells; with 51 degrees of freedom, the 95% threshold is ~68.7. The test asserts `chi² < 100` (slack threshold to absorb test-time variance without flakiness).

Optionally repeat for positions 1, 2, 3, 4 — if position 0 is uniform, the others follow from the Fisher-Yates correctness, but a multi-position test catches biased implementations early.

## 12. Reduced-motion contract

The engine itself has no animation. UI honors `prefers-reduced-motion: reduce` separately, both via CSS keyframe overrides and JS timer zero-out. Engine-side: no setTimeout, no requestAnimationFrame, no DOM access.

## 13. What we don't verify

- **Optimal-play RTP simulation.** The published 99.54% / 99.73% RTP figures assume the player holds the correct cards on every deal per a precomputed strategy table. We don't ship a strategy table or hint engine — the player picks holds however they want. Empirical RTP under random-hold play will be much lower (typically 75–80% range), and that is not a regression — it's a property of the game.
- **Strategy hint UI.** Out of scope for this build. Could be added in a later polish pass.
- **Long-run RTP regression test.** A naive 5M-hand random-strategy simulation tells you nothing about the optimal-strategy RTP of the design. Skipped.

What we DO verify (recap): hand evaluator correctness via golden vectors (~55), paytable transcription against locked constants, deck shuffle uniformity via chi-square, round state machine invariants (held cards stay; deck draws are sequential).
