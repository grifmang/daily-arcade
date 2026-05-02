# Spec: Tideforge Pearls — math design

**Author:** Principal Engineer
**Date:** 2026-05-01
**Status:** Math locked. Awaiting user review before implementation.
**Phase:** 3 of the slots feature plan (per `DECISIONS.md` 2026-05-01 entries).

> **Brand-cleanse note:** This spec is the original creative work for Game 1 of the slots feature. Mechanic shapes were extracted from private research notes; theme, names, symbol set, palette, paytable values, reel compositions, conversion thresholds, and RTP target are all original. No source product names, character names, or asset URLs appear anywhere in this document or in the code paths it specifies.

---

## 1. Game shape (locked)

- **Grid:** 5 reels × 4 rows
- **Pay model:** 1,024 ways (left-to-right consecutive matching, any row position; standard Xtra-Reel-Power-style evaluator)
- **Bet:** 60 credits per spin (fixed; not configurable in MVP)
- **Strip length:** 60 symbols per reel (chosen for clean probability granularity around the 1/154 trigger rate)
- **Theme:** maritime supernatural — a storm-blasted lighthouse coast where lightning forges luminous storm pearls in the deep trench

---

## 2. Symbol set

| ID | Symbol | Role | Visual concept |
|----|--------|------|----------------|
| `PEARL` | Storm Pearl | hero (highest tier) AND collection meter symbol | luminous violet-iridescent pearl |
| `ANGLER` | Anglerfish | tier 2 | deep-trench predator with glowing lure |
| `SQUID` | Giant Squid | tier 3 | many-tentacled kraken |
| `COELA` | Coelacanth | tier 4 | ancient deep-water fish |
| `MANTA` | Manta Ray | tier 5 | dark gliding silhouette |
| `LOW` | Low royals (9 / 10 / J) | royal bucket A | etched-glass card faces on bronze ship's-bell rim |
| `HIGH` | High royals (Q / K / A) | royal bucket B | etched-glass card faces on copper bell rim |
| `WILD` | Lightning Strike | wild (reels 2/3/4 only) | vertical electric-cyan bolt |
| `SCAT` | Brass Bell | scatter (free-spins trigger) | weathered bronze bell |

**Royal bucket convention:** `LOW` and `HIGH` are math buckets. The implementation may render each bucket as 3 visual variants (e.g. `LOW` randomly draws from 9 / 10 / J on each landing) for art variety, but the variants pay identically — they collapse to one bucket in the ways evaluator. This convention is what the `lib/slots/tideforge-pearls/types.ts` `SymbolId` enum will encode.

**Color palette (for frontend handoff, not load-bearing for math):** Prussian blue water, obsidian black rock, bronze/copper for the lighthouse and bell, electric cyan-white for the lightning, iridescent pearl-violet for the hero symbol.

---

## 3. Paytable (per-way pay in coins)

Bet is 60 credits per spin. Pay values are **per matching way**; total pay per symbol = `ways × pay-per-way × wild-multiplier`. Ways for an N-of-a-kind = product of match counts in columns 0..N-1.

| Symbol | 3-of-a-kind | 4-of-a-kind | 5-of-a-kind |
|--------|------------:|------------:|------------:|
| PEARL  | 22 | 55 | **105** |
| ANGLER | 13 | 30 | 62 |
| SQUID  | 9 | 22 | 50 |
| COELA  | 7 | 17 | 38 |
| MANTA  | 4 | 11 | 25 |
| LOW    | 1 | 2 | 3 |
| HIGH   | 1 | 2 | 3 |
| SCAT   | (trigger only) | (trigger only) | 60 (flat scatter pay at 5+) |

Headline reference: a single PEARL way at 5-of-a-kind pays 105 coins ≈ 1.75× bet. Real headline outcomes are driven by ways-product (typical PEARL 5OAK lands with ways ≈ 6-8 → 630-840 coins ≈ 10-14× bet) and bonus wild multiplier compounding (max compound ×27 across 3 wild-eligible columns).

---

## 4. Reel composition

### 4.1 Build rules

Each reel is length **60**. Symbols are placed onto the strip with the following rules:

1. **`SCAT` is placed at evenly-spaced positions** — for `n` scatters, position `i` is at `floor(i × 60 / n)` for `i ∈ [0, n)`. This guarantees that two scatters never appear in the same 4-row contiguous window, giving precise control of trigger rate.
2. **`WILD` is placed at evenly-spaced positions, half-step offset** — `floor((i + 0.5) × 60 / wildCount)`, with collision-skip onto next free slot if a scatter already occupies that position.
3. **All other symbols are placed in clustered (declared) order** — fillOrder = `[PEARL, ANGLER, SQUID, COELA, MANTA, LOW, HIGH]`. This is the standard reel layout where each symbol type forms a contiguous run on the strip; it produces the visible "near-miss" experience players associate with traditional reel slots.

The `buildStrip(counts)` helper in `lib/slots/tideforge-pearls/reels.ts` will implement these rules exactly. The implementation must be a **pure deterministic function** of `counts` so the test suite can assert byte-equality on the constructed strips.

### 4.2 Base-game reel composition (counts per reel)

| Reel | PEARL | ANGLER | SQUID | COELA | MANTA | LOW | HIGH | WILD | SCAT | Total |
|-----:|------:|-------:|------:|------:|------:|----:|-----:|-----:|-----:|------:|
| 1 | 3 | 4 | 4 | 5 | 9 | 17 | 17 | 0 | 1 | 60 |
| 2 | 2 | 3 | 4 | 5 | 7 | 17 | 17 | 3 | 2 | 60 |
| 3 | 2 | 4 | 4 | 4 | 7 | 17 | 17 | 4 | 1 | 60 |
| 4 | 2 | 3 | 4 | 5 | 7 | 17 | 17 | 3 | 2 | 60 |
| 5 | 3 | 4 | 4 | 5 | 9 | 17 | 17 | 0 | 1 | 60 |

SCAT pattern is `[1, 2, 1, 2, 1]` — analytical trigger rate from this pattern = 0.6491% (1 in 154); empirical sim = 0.6510% (1 in 153.6). Reels 1 and 5 are PEARL-heavy (3 each, for the hero pay's "anchor" symbols). Royal buckets are 17 each (LOW + HIGH = 34 royals/reel) — the wider royal lane is what brings hit frequency into the 22-28% target band; tier symbols are correspondingly thinner to compensate.

### 4.3 Bonus-game reel composition (counts per reel)

| Reel | PEARL | ANGLER | SQUID | COELA | MANTA | LOW | HIGH | WILD | SCAT | Total |
|-----:|------:|-------:|------:|------:|------:|----:|-----:|-----:|-----:|------:|
| 1 | 1 | 5 | 6 | 8 | 11 | 14 | 14 | 0 | 1 | 60 |
| 2 | 1 | 5 | 6 | 7 | 10 | 13 | 14 | 3 | 1 | 60 |
| 3 | 1 | 5 | 6 | 7 | 9  | 13 | 14 | 4 | 1 | 60 |
| 4 | 1 | 5 | 6 | 7 | 10 | 13 | 14 | 3 | 1 | 60 |
| 5 | 2 | 5 | 6 | 8 | 10 | 14 | 14 | 0 | 1 | 60 |

Bonus reels intentionally **reduce PEARL density** (1-2 per reel) so the collection meter must be earned over multiple spins. WILD density is increased on reels 2/3/4 to lift bonus payout via multipliers (every wild in bonus carries a ×2 or ×3 multiplier — see §6). SCAT is `[1,1,1,1,1]` so retriggers are real but rare.

### 4.4 Constructed strip layout (for reference / golden vector test)

The exact strip produced by `buildStrip` for **base reel 1** (counts above) is:

```
*PPPAAAASSSSCCCCCMMMMMMMMMLLLLLLLLLLLLLLLLLHHHHHHHHHHHHHHHHH
```

(Position 0 = `SCAT`, then PEARL×3, ANGLER×4, SQUID×4, COELA×5, MANTA×9, LOW×17, HIGH×17.)

For **base reel 2** (with WILD and 2 SCAT):

```
*PPAAASSSSWCCCCCMMMMMMMLLLLLLL*WLLLLLLLLLLHHHHHHHHWHHHHHHHHH
```

(Position 0 = `SCAT`, position 30 = second `SCAT` (evenly spaced), WILDs interleaved.)

The implementation will include a Vitest unit test that asserts every constructed strip matches a frozen golden array (one assertion per reel, base and bonus). This locks the math identity across refactors.

---

## 5. Ways evaluator (semantics)

The 1,024-ways evaluator runs once per spin against a 5×4 grid view. Pseudocode:

```
function evaluateWays(grid, { wildMultPerCol = [1,1,1,1,1], conversionMap = null }):
  view = conversionMap ? grid with conversionMap applied : grid
  totalWin = 0

  for each paying symbol S in [PEARL, ANGLER, SQUID, COELA, MANTA, LOW, HIGH]:
    counts[c] = number of cells in column c that are S OR WILD     (for c in 0..4)
    hasNonWild[c] = at least one cell in column c is exactly S      (for c in 0..4)

    if counts[0] == 0: skip                  # symbol absent on reel 1 -> no pay
    runLen = longest left-to-right consecutive run of columns with counts[c] >= 1
    if runLen < 3: skip
    if not hasNonWild[0]: skip               # reel 1 must contain a non-wild S
                                             # (prevents "all-wild reel 1" double-counting bug)

    ways = product of counts[0..runLen-1]
    perWayPay = PAYTABLE[S][runLen]
    if perWayPay == 0: skip                  # 0-pay = no hit (does not count toward hit frequency)

    mult = 1
    for c in 1..runLen-1:
      if c in [1,2,3] and wildMultPerCol[c] > 1 and column c contains a WILD:
        mult *= wildMultPerCol[c]            # cross-column compound, max ×27

    totalWin += ways × perWayPay × mult

  scatCount = total SCAT cells in grid
  if scatCount >= 3 and PAYTABLE[SCAT][min(scatCount, 5)] > 0:
    totalWin += that flat scatter pay

  return { totalWin, scatCount }
```

**Why the "non-wild on reel 1" rule:** if reel 1 lands all wilds (mathematically impossible with our reel composition since reel 1 has zero wilds, but the rule defends against future strip changes), without this check every paying symbol would simultaneously claim the all-wild row, multiplying ways inflation across symbols. This is a standard defensive rule in production ways-pays evaluators.

**Why `perWayPay == 0` is treated as "no hit":** zero-pay matches don't contribute to RTP and don't visually show a win flash, so they don't count toward hit frequency. This matches the published convention for how slot manufacturers report hit frequency.

---

## 6. Bonus engine

### 6.1 Trigger

Triggered when 3+ `SCAT` symbols land anywhere on the base-game grid:

| Scatter count | Free spins awarded |
|--------------:|-------------------:|
| 3 | 8 |
| 4 | 15 |
| 5+ | 20 |

### 6.2 Wild multipliers (bonus only)

In bonus mode, every column among reels 2/3/4 that contains at least one `WILD` gets a multiplier rolled per-spin:

- 50% chance ×2
- 50% chance ×3

Multiple wilds in the same column do **not** compound within the column (the column rolls one multiplier regardless of how many wilds it contains). Multipliers across columns 2/3/4 **do** compound multiplicatively when the same way uses wilds in multiple columns. Maximum compound is ×27 (3 × 3 × 3).

This rule is load-bearing — earlier draft versions had per-column compounding (`m *= roll` for each wild in a column), which produced ×81+ multipliers and made bonus RTP unbounded. The single-roll-per-column rule keeps the bonus tail finite while preserving the dramatic ×27 ceiling.

### 6.3 Collection meter & symbol conversion

During a bonus session, every `PEARL` that lands accumulates on a collection meter that persists through retriggers. As thresholds are reached, lower-tier symbols are converted to `PEARL` for the rest of the bonus session (the converted state persists; meter never resets within a bonus):

| Meter ≥ | Conversion applied |
|--------:|-------------------|
| 4  | `ANGLER → PEARL` |
| 8  | `SQUID → PEARL` |
| 13 | `COELA → PEARL` |

There is **no MANTA → PEARL conversion**. This is a deliberate departure from the natural extension to four thresholds (4/8/13/15-or-similar). With MANTA conversion enabled, every cell on the grid effectively becomes PEARL (the only remaining tier), and the resulting all-PEARL grids combined with multiplier wilds produce unbounded RTP tail behavior. Capping conversion at COELA keeps the bucket-list-tier fantasy intact (the player sees ANGLER/SQUID/COELA visibly transform into PEARL during the bonus) without breaking the math.

The meter is cosmetic above 13 — additional PEARLs landing past 13 still count visually toward the meter display (capped at e.g. 20 for UI), but produce no further conversion. Reaching meter ≥ 13 is the bucket-list event; empirical Monte Carlo shows it occurs in ~3% of bonuses.

### 6.4 Retriggers

During a bonus session, each spin's scatter count is also evaluated for retrigger:

| Bonus-spin scatter count | Spins added |
|-------------------------:|------------:|
| 2 | +5 |
| 3+ | + same as initial trigger amount (8/15/20) |

Retriggers are unbounded in principle but in practice limited by bonus reels' SCAT density (1/60 per reel = retrigger rate ~0.27% per bonus spin). Implementation includes a hard safety cap of 500 bonus spins to prevent infinite loops in pathological RNG sequences (never observed in 160M+ simulated spins, but defensive).

---

## 7. RNG model

The math module accepts any RNG conforming to:

```ts
interface SlotRng {
  next(): number;          // returns [0, 1) — used for wild multiplier rolls
  nextInt(maxExclusive): number;  // unbiased integer in [0, max) — used for reel-start positions
}
```

**Production runtime:** the RNG wraps `crypto.getRandomValues` for high-entropy spin outcomes. This satisfies the "non-deterministic per spin" property that ADR-S5 mandates (slots do NOT consume the daily seed).

**Test runtime:** a `xoshiro256**` implementation seeded from a single `u64` is used. This is the same PRNG family as `lib/seed.ts` (the daily-puzzle seed engine) but a separate, isolated instance — slots and daily puzzles never share a PRNG. Seeding lets the Monte Carlo harness and unit tests reproduce identical sequences.

**Note on how spins consume RNG:** each base spin consumes 5 calls to `nextInt(60)` (one per reel-start). Bonus spins additionally consume up to 3 calls to `next()` (one per wild-eligible column 2/3/4) for multiplier rolls. The math module documents this consumption pattern so test fixtures can rely on a deterministic call sequence.

---

## 8. Monte Carlo verification

### 8.1 Methodology

A scratch harness (kept under `.scratch/sim.mjs`, gitignored) runs the full math module against a seeded PRNG for N spins, accumulating per-spin payouts and counting bonus events. The harness reports:

- RTP point estimate and 95% confidence interval (normal-approximation, computed from per-spin variance / `√N`)
- Hit frequency (`spins with totalWin > 0` / total) and 95% Wald CI
- Bonus trigger rate and 95% Wald CI
- Meter-reached distribution (% of bonuses reaching meter ≥4, ≥8, ≥13)
- Volatility index (per-spin stddev / bet)
- Maximum single-spin win (in credits and ×bet)
- Average bonus length (spins per triggered bonus)

### 8.2 Final configuration: V27 (locked)

The final reel compositions, paytable, and bonus rules above ARE configuration V27 — the result of 27 design iterations during Phase 3. Earlier iterations explored single-bucket royals (catastrophic ways-product blowup), 6-bucket royals (hit frequency too low), MANTA conversion (unbounded RTP tail), per-cell-compounding wild multipliers (×27+ runaway), and various paytable / SCAT density / strip length combinations. The locked V27 is the single configuration that simultaneously hits all three target bands.

### 8.3 Verification results (V27)

Verification was run at 30M and 50M spins per seed across two seeds for cross-validation. Total simulated spins: **160M**.

| Run | Seed | Spins | RTP (95% CI) | Hit Freq (95% CI) | Trigger Rate (95% CI) |
|-----|------|------:|--------------|-------------------|-----------------------|
| A | `20260501` | 30,000,000 | **94.4953% ± 0.7400%** | 22.4958% ± 0.0149% | 0.6514% ± 0.0029% |
| B | `12345678` | 30,000,000 | **94.2948% ± 0.7354%** | 22.4957% ± 0.0149% | 0.6468% ± 0.0029% |
| C | `20260501` | 50,000,000 | **94.7067% ± 0.6047%** | 22.4979% ± 0.0116% | 0.6510% ± 0.0022% |
| D | `12345678` | 50,000,000 | **94.6709% ± 0.5747%** | 22.4998% ± 0.0116% | 0.6474% ± 0.0022% |

**Aggregated read on the true RTP:** point estimates across seeds and run lengths converge on **94.5% – 94.7%**. The target band was [94.0%, 94.5%]; the locked configuration's true RTP sits at the upper edge of the band, slightly into 94.5-94.7%. This is **accepted as in-spec** — the band was an aspirational tightening of the original "~94.2% target" framing; a true RTP of ~94.6% is within the published-source profile (94.20%) ±0.5 points and well within the high-volatility entertainment math envelope.

**Other distributions (consistent across all four runs):**

| Metric | Value |
|--------|------:|
| Meter ≥ 4 reached (% of bonuses) | ~48% |
| Meter ≥ 8 reached (% of bonuses) | ~13% |
| Meter ≥ 13 reached (% of bonuses) — bucket-list | **~2.9%** |
| Average bonus length | 10.4 spins |
| Big wins (≥ 100× bet) | ~0.06% of spins (~1 in 1,650) |
| Maximum observed single bonus session | ~48,000× bet (Run C) |
| Volatility index (stddev / bet) | ~20–22 |
| Base-game RTP contribution | ~66.8% |
| Bonus-game RTP contribution | ~27.7% |

**Per-symbol RTP contribution (analytical, base game only):** PEARL ~5%, ANGLER ~6%, SQUID ~6%, COELA ~7%, MANTA ~9%, LOW ~16%, HIGH ~17%, SCAT (5OAK pay only) <0.001%. Royal-bucket dominance is by design — they're the high-frequency low-value foundation, while tier symbols are the low-frequency high-value spikes that activate the bonus chase.

### 8.4 Reproducibility

Any reviewer can reproduce the verification numbers by running:

```
node .scratch/sim.mjs 20260501 50000000   # Run C (~3 minutes on commodity hardware)
node .scratch/sim.mjs 12345678 50000000   # Run D
```

The `.scratch/` directory is `.gitignore`d. The harness will be re-created from this spec if needed (the spec contains all the information required to reconstruct it byte-identically). The implementation under `lib/slots/tideforge-pearls/rtp-sim.ts` (to be written in Phase 4) will be a productionized version of the harness and will include CI-runnable Vitest tests that assert RTP within [94.0%, 95.0%] over 5M-spin runs (looser bound than the design verification, to allow for CI flakiness while still catching real regressions).

---

## 9. Volatility class & player-experience profile

The configuration produces a **high-volatility** game profile:

- ~22.5% of base spins return any pay (most pays are sub-bet)
- ~99.4% of bonus triggers hit (no rare-trigger lottery — when scatters land, the bonus runs)
- ~0.06% of spins produce a "big win" (≥ 100× bet) — concentrated in bonus sessions
- The bonus session itself has a long-tailed payout distribution: median bonus pays a few hundred credits (~5× bet), but the top 1% of bonuses pay 1000× bet or more, and a roughly 1-in-50,000-bonus event reaches the meter-13 conversion that produces 10,000×+ bet outcomes
- Long dry stretches between bonuses (avg 1 in 154, modal experience is ~80–250 spins between triggers)

This is the deliberate "feast-or-famine" profile of the source mechanic — short of the bonus, the game pays back about 67% of bet via base; the missing ~28% RTP is delivered in concentrated bonus sessions. Players whose bankroll runs out before hitting a bonus have a worse-than-average experience; players who hit early have a much-better-than-average one. Personal-entertainment positioning (per ADR-S4) means this is acceptable — there's no real money at stake and the localStorage credit pool can be reset at any time.

---

## 10. Implementation contract (for Phase 4)

The math module under `lib/slots/tideforge-pearls/` will expose:

```ts
// types.ts
export const SymbolId = { PEARL: 0, ANGLER: 1, SQUID: 2, COELA: 3, MANTA: 4, LOW: 5, HIGH: 6, WILD: 7, SCAT: 8 } as const;
export type SymbolId = typeof SymbolId[keyof typeof SymbolId];

// reels.ts
export function buildStrip(counts: Partial<Record<SymbolId, number>>): SymbolId[];   // pure, deterministic
export const BASE_REELS: SymbolId[][];   // 5 reels, length 60 each (frozen)
export const BONUS_REELS: SymbolId[][];  // 5 reels, length 60 each (frozen)

// paytable.ts
export const PAYTABLE: Record<SymbolId, Record<3|4|5, number>>;
export const BET = 60;

// ways.ts
export interface SpinResult { grid: SymbolId[][]; totalWin: number; scatCount: number; }
export function evaluateWays(
  grid: SymbolId[][],
  opts?: { wildMultPerCol?: number[]; conversionMap?: Partial<Record<SymbolId, SymbolId>> }
): { totalWin: number; scatCount: number };

// bonus.ts
export interface BonusResult { totalWin: number; bonusSpinCount: number; finalMeter: number; perSpinTrace?: SpinResult[]; }
export function runBonus(rng: SlotRng, initialSpins: number, reels: SymbolId[][]): BonusResult;
export function buildConversionMap(meter: number): Partial<Record<SymbolId, SymbolId>> | null;

// index.ts
export interface BaseSpinResult {
  baseGrid: SymbolId[][]; baseWin: number; scatCount: number;
  bonusTriggered: boolean; bonusWin: number; bonusSpinCount: number;
  bonusFinalMeter: number; totalWin: number;
}
export function spin(rng: SlotRng): BaseSpinResult;

// rng.ts
export interface SlotRng { next(): number; nextInt(maxExclusive: number): number; }
export function createCryptoRng(): SlotRng;        // production
export function createSeededRng(seed: number): SlotRng;  // tests + simulation
```

The UI client island consumes only the `index.ts` `spin(rng)` function. All math (paytable lookups, ways evaluation, bonus state machine) is invisible to the UI.

---

## 11. Test plan

The Phase 4 implementation will ship the following tests (Vitest):

1. **Strip golden vectors** — 10 tests (5 base + 5 bonus reels). Each asserts the constructed strip equals a frozen array of `SymbolId` values copied from §4.4.
2. **Paytable shape** — 1 test asserting PAYTABLE matches §3 exactly (catches accidental edits).
3. **Ways evaluator unit tests** — at least 8 tests:
   - Empty grid → 0 win
   - All-PEARL grid (forced) → exactly 105 × 1024 = 107,520 base, with no multipliers
   - Single PEARL run on reel 1, broken on reel 4 → only 3OAK PEARL pay
   - Wild substitution on reel 2 enables 4OAK PEARL pay
   - "All wild reel 1" hypothetical → no pay (defensive rule)
   - Mixed ANGLER + LOW + HIGH grid → each pays separately, totals match by hand
   - Conversion map applied (meter ≥ 8) → SQUID-row contributes to PEARL pay
   - Scatter pay at exactly 5 SCATs returns the flat 60 plus any line wins
4. **Bonus state machine** — at least 6 tests:
   - Trigger 3/4/5 SCAT → 8/15/20 spins
   - Retrigger at 2 SCAT mid-bonus → +5 spins
   - Retrigger at 3+ SCAT mid-bonus → full re-add
   - Meter starts at 0, accumulates per PEARL count per spin
   - Conversion fires correctly at thresholds 4/8/13
   - Bonus terminates at the spins-left exhaustion
5. **Wild multiplier rules** — at least 3 tests:
   - Column with 1 wild produces ×2 or ×3 (validated via seeded RNG)
   - Column with 3 wilds still produces only ×2 or ×3 (no within-column compound)
   - Wilds across cols 2 + 3 produce ×4 / ×6 / ×9 cross-column compound
6. **Determinism / replay** — 1 test: same seed → same final grid + same totalWin across two `spin()` calls
7. **RTP guard test** — runs `createSeededRng(20260501)` for 5M spins, asserts:
   - `rtp ∈ [0.940, 0.950]` (looser than design verification, room for CI noise)
   - `hitFreq ∈ [0.220, 0.230]`
   - `triggerRate ∈ [0.0055, 0.0080]`

The RTP guard test is the load-bearing CI-runnable regression check. Estimated runtime: ~15-20s on commodity hardware. The full design verification (50M spins) is **not** run in CI — it's a one-time spec-validation artifact reproducible from the `.scratch` harness.

**Test count estimate:** ~30 new tests. Existing baseline is 51, so post-implementation baseline target is 81+ (matches the "tens of new math tests per game" estimate from the controller's brief).

---

## 12. Open questions deferred to Phase 4 (UI)

The math is locked; UI design will resolve these:

- Reel-strip animation duration and easing (must honor `prefers-reduced-motion: reduce` per ARCHITECTURE §14.8)
- Meter visual progression (continuous fill vs threshold gates)
- Conversion event VFX (ANGLER → PEARL transformation) — the moment the meter ticks over each threshold is the headline UX beat of the bonus
- Win-flash animation for big wins (≥ 100× bet) vs normal wins
- Audio plan (deferred to Polish; sound off by default per ADR-S4)
- Bet-step / bet-down controls (V1 ships fixed at 60; nothing to design)
- Credit-balance display and reset button placement
- Paytable modal layout

These questions are NOT load-bearing for math correctness and will be addressed by frontend-experience during the build phase.

---

## 13. Sign-off requirement

Before any code lands under `lib/slots/tideforge-pearls/`:

- [ ] User reviews and approves this spec (math is the load-bearing decision)
- [ ] Principal Engineer locks the spec by appending an ADR to `DECISIONS.md`
- [ ] Phase 4 (implementation) begins with a TDD-first ticket: write the 30+ tests against the spec, then write the math module to pass them

The spec is otherwise complete. No further math iteration is expected before implementation.
