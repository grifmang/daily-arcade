# Card Parlor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/cards/` section to daily-arcade with two playable video-poker variants (9/6 Jacks or Better, NSUD Deuces Wild) sharing a pure-logic engine.

**Architecture:** Three deploys. **Deploy 1** ships the foundation: ADRs C1–C6 + ARCHITECTURE Section 15 + math design spec + shared engine + JoB UI. **Deploy 2** adds the Deuces Wild UI. **Deploy 3** ships the docs delta. Each deploy is one `git push origin main` and produces a single Netlify auto-build.

**Tech Stack:** Next.js 16 (App Router) on Netlify, TypeScript, Vitest, Tailwind 4, vanilla React. The shared engine is server-safe pure TypeScript with no DOM/Node dependencies.

**Working dir:** `C:/Users/grifm/OneDrive/Desktop/Projects/Game App/projects/daily-arcade`

**Spec:** `docs/superpowers/specs/2026-05-01-card-parlor-design.md` (commit `6e3ee09`)

**Reference patterns to mirror, not copy:**
- `lib/slots/tideforge-pearls/rng.ts` — `SlotRng` interface + `createSeededRng` (xoshiro256**) + `createCryptoRng` (crypto.getRandomValues with rejection sampling). Port the same shape into `lib/cards/video-poker/rng.ts` so the two modules stay independently consumable.
- `lib/slots/tideforge-pearls/credits.ts` — localStorage helpers for play-money credits + session stats, defensive parsing, SSR-safe try/catch. Port the same shape into `lib/cards/video-poker/credits.ts` keyed per game.
- `app/slots/tideforge-pearls/tideforge-client.tsx` — the canonical shape for a play-money lounge client island in this project (state machine, animation orchestration, ARIA-live, reset flow).
- `components/arcade-shell.tsx` — footer link pattern for the second lounge link.

---

## Pre-flight

- [ ] **Step P1: Verify clean state**

```bash
cd "C:/Users/grifm/OneDrive/Desktop/Projects/Game App/projects/daily-arcade"
git status -sb
```

Expected: `## main...origin/main` — possibly with the local spec commit `6e3ee09` ahead by 1. If there are unrelated modified files, stop and surface — don't accidentally include them in any cards commit.

- [ ] **Step P2: Verify the 142-test baseline still passes**

```bash
npm test 2>&1 | tail -5
```

Expected: `Tests   142 passed (142)`. If anything fails, stop — fix the regression before starting Phase 2.

---

## Phase 2 — Integration ADRs + ARCHITECTURE delta

Doc-only phase. Bundled with Deploy 1.

### Task 2.1: Append ADRs C1–C6 to DECISIONS.md

**Files:**
- Modify: `DECISIONS.md` — append 7 entries (handoff + C1–C6) at end of file

- [ ] **Step 2.1.1: Append the entries**

Open `DECISIONS.md`. Find the end of the existing log (the most recent entry is the slot Phase 4B handoff). Append the following block. Use today's date (2026-05-01).

```markdown

---

## [2026-05-01] Card Parlor — kickoff

**From:** Brainstorming session (Claude with grifmang)

**Scope:** Add a `/cards/` section to daily-arcade with two playable
video-poker variants — 9/6 Jacks or Better and NSUD Deuces Wild —
sharing a pure-logic engine. User explicitly chose a separate `/cards/`
section over folding video poker into `/slots/` (which would have been
the alternative; both options were on the table).

**Spec:** `docs/superpowers/specs/2026-05-01-card-parlor-design.md`

Following ADRs C1–C6 establish the integration boundaries.

---

## [2026-05-01] ADR-C1 — Card games live under `/cards/<slug>`, separate from `/slots/`

**Decision:** New section `/cards/` with index page + two game routes
(`/cards/jacks-or-better`, `/cards/deuces-wild`). The home grid (three
daily puzzles) stays unchanged. A second discreet footer link
"card parlor" provides the only nav into `/cards/`, alongside the
existing "arcade lounge" link.

**Why:** User explicitly chose separation over folding video poker
into `/slots/`. The conceptual distinction (reel-spin slots vs
card-faced slots) deserves separate routing even though both share
the lounge model.

**Consequences:** Two indexes (`/slots`, `/cards`); two footer links.
The home page stays "today's three puzzles" — secondary destinations
are reached only via footer.

---

## [2026-05-01] ADR-C2 — No streak impact

**Decision:** Card games are off-streak entertainment. The streak
counter remains daily-puzzle-exclusive; playing video poker neither
extends nor breaks a streak.

**Why:** Same reasoning as ADR-S2. Streak is the daily ritual primitive;
diluting it with off-streak modes weakens its meaning.

**Consequences:** No imports from `lib/hooks/use-streak.ts` in any
`app/cards/` or `lib/cards/` file. No `recordPlay()` or `markCompleted()`
calls.

---

## [2026-05-01] ADR-C3 — No leaderboard, no submit, no Turnstile, no OG, no DB

**Decision:** Card games do not introduce any new server-side surface.
- No new Server Actions
- No new Route Handlers under `/api/`
- No DB writes (`lib/store.ts` not modified)
- No Turnstile invocations
- No OG image routes for `/cards/` paths

**Why:** Same reasoning as ADR-S3. The slot lounge proved this boundary
holds for unlimited-play personal entertainment; cards inherit it.

**Consequences:** AppSec surface for `/cards/` is near-zero — same as
the slot lounge. The CSP in `proxy.ts` is unchanged.

---

## [2026-05-01] ADR-C4 — Play-money credits in localStorage, per game

**Decision:** Each card game gets its own localStorage credit balance
and session stats:
- `cards:jacks-or-better:credits` (default 1000)
- `cards:jacks-or-better:stats`
- `cards:deuces-wild:credits` (default 1000)
- `cards:deuces-wild:stats`

Each game has a manual "Reset Balance" button. localStorage is
editable in DevTools — risk-accepted, same as the slot lounge.

**Why:** Same reasoning as ADR-S4. Per-game balances let the user
explore each game independently without one drain affecting the other.

**Consequences:** Copy uses "credits" only — no real-money framing.
The reset confirmation explicitly disclaims real money.

---

## [2026-05-01] ADR-C5 — No daily-seed integration

**Decision:** Per-hand `crypto.getRandomValues` RNG, fresh per hand.
The daily seed engine remains daily-puzzle-exclusive.

**Why:** Same reasoning as ADR-S5. The two systems should not couple.

**Consequences:** No imports from `lib/seed.ts` in any `app/cards/`
or `lib/cards/` file.

---

## [2026-05-01] ADR-C6 — Sequential ship cycles

**Decision:** Three deploys.
1. **Deploy 1** — ADRs + arch + math spec + shared engine + Jacks or
   Better UI. Deuces Wild card on `/cards/` index shows "Coming Soon".
2. **Deploy 2** — Deuces Wild UI. Index card flips from "Coming Soon"
   to a live link.
3. **Deploy 3** — Docs delta (RUNBOOK + README updates) and final
   cross-feature review.

**Why:** Same reasoning as ADR-S6. Ship the foundation + first game,
prove it works in production, then layer the second variant onto the
proven engine.

**Consequences:** A failed Deuces deploy does not regress JoB. Each
deploy is independently revertable.
```

- [ ] **Step 2.1.2: Verify file is well-formed**

```bash
tail -50 DECISIONS.md
```

Expected: ADR-C6 is the last entry, file ends cleanly with no merge markers or stray characters.

### Task 2.2: Append Section 15 to ARCHITECTURE.md

**Files:**
- Modify: `ARCHITECTURE.md` — append Section 15 (Card Parlor subsystem)

- [ ] **Step 2.2.1: Find the end of Section 14 and append Section 15**

```markdown

---

## 15 — Card Parlor subsystem

The card parlor is a sibling lounge to the slots subsystem (Section 14).
It hosts video-poker variants; gameplay loop is unlimited-play with
play-money credits, no leaderboard, no streak impact, no server writes.

### 15.1 Routing
- `/cards/` — index page (server-prerendered static)
- `/cards/jacks-or-better` — JoB game route (server wrapper + client island)
- `/cards/deuces-wild` — Deuces Wild game route (server wrapper + client island)

The home page (`/`) and the slot lounge (`/slots/...`) are unchanged.
Footer in `components/arcade-shell.tsx` carries TWO secondary links:
"arcade lounge" → `/slots`, "card parlor" → `/cards`.

### 15.2 Subsystem ownership
| Concern | Owner |
|---|---|
| Card / hand types | `lib/cards/video-poker/types.ts` |
| RNG | `lib/cards/video-poker/rng.ts` (port of the slot SlotRng pattern) |
| Deck operations | `lib/cards/video-poker/deck.ts` |
| Hand evaluation | `lib/cards/video-poker/evaluate.ts` |
| Paytables | `lib/cards/video-poker/paytable.ts` |
| Round state machine | `lib/cards/video-poker/round.ts` |
| Credit / stats persistence | `lib/cards/video-poker/credits.ts` |
| Public API | `lib/cards/video-poker/index.ts` (barrel) |
| Variant client UIs | `app/cards/<slug>/<slug>-client.tsx` |
| Shared display components | `components/cards/*.tsx` |

### 15.3 What card games do NOT add
This is the load-bearing list AppSec mini-pass will check against.

- No new Server Actions
- No new Route Handlers (no `/api/cards/` paths)
- No `lib/store.ts` modifications, no DB tables
- No Turnstile invocations
- No OG image routes for cards
- No new cron jobs
- No new env vars (`lib/env.ts`, `.env.example` unchanged)
- No outbound HTTPS at runtime (the engine is fully client-side)
- No CSP relaxations (`proxy.ts` unchanged)

### 15.4 localStorage state schema
- `cards:jacks-or-better:credits` — number (default 1000)
- `cards:jacks-or-better:stats` — `SessionStats` JSON shape
- `cards:deuces-wild:credits` — number (default 1000)
- `cards:deuces-wild:stats` — `SessionStats` JSON shape

`SessionStats` shape (same shape used by the slot subsystem,
re-implemented here for module independence):

```ts
interface SessionStats {
  handsPlayed: number;
  totalWagered: number;
  totalWon: number;
  bestSingleWin: number;
  // Per-rank hit counters for visible "rare hand" stats
  rankHits: Partial<Record<HandRank, number>>;
}
```

### 15.5 RNG model contract
- **Runtime:** `createCryptoRng()` wrapping `crypto.getRandomValues`,
  pulled fresh for each hand. No daily seed.
- **Tests:** `createSeededRng(seed: bigint)` using xoshiro256** for
  deterministic test fixtures. Same `SlotRng` interface as runtime
  (drop-in replaceable).

The RNG implementation is intentionally a port of the slot RNG —
identical interface, identical implementation. If a third consumer
appears, both modules can be migrated to a shared `lib/util/rng.ts`
in a single refactor; until then, two-copy-one-shape is the YAGNI call.

### 15.6 Round state machine (the load-bearing logic)
```
dealing    — RNG draws 5 cards from a freshly shuffled 52-card deck
holding    — player toggles HOLD on 0..5 cards; primary action: DRAW
drawing    — held cards stay; un-held cards replaced from same deck (next 5−heldCount)
evaluating — final hand classified by `evaluateHand`; paytable applied; credits updated
done       — UI displays result; primary action: DEAL (transitions back to dealing)
```

The deck is shuffled per round (not per phase). The draw step pulls
from positions 5..(5 + 5 − heldCount − 1) of the same shuffled deck.
This is the standard physical-cabinet behavior.

### 15.7 Hand evaluator
Two evaluation modes, gated by `options.wildRank`:
- **Standard** (`wildRank: null`) — JoB uses this. 9-rank hierarchy
  topping at Royal Flush, with Jacks-or-better as the minimum paying
  hand.
- **Wild** (`wildRank: Rank.TWO`) — Deuces uses this. 10-rank hierarchy
  with Wild Royal Flush, Five of a Kind, and Four Deuces as additional
  ranks. Minimum paying hand is Three of a Kind (no pair pays).

The evaluator returns the highest-paying classification only; it never
double-classifies a hand. Tie-breaking is unnecessary for paytable
application but the evaluator is deterministic anyway.

### 15.8 UI client island shape
Per game, one client island (`app/cards/<slug>/<slug>-client.tsx`)
following the Tideforge client pattern:
- React state for round phase, current deck, current hand, hold flags,
  current bet, current win, animating state
- Effects for card-flip animation timing (gated by reduced-motion)
- ARIA-live region for win announcements ("You win 25 credits.")
- Real `<button>` elements with focus-visible rings
- `aria-busy` during animation; `aria-disabled` when out of credits
- localStorage round-trip on every credit / stats update

### 15.9 A11y commitments
- No autoplay (every hand requires a button click)
- No auto-hold (the player picks holds explicitly)
- `prefers-reduced-motion: reduce` collapses card-flip and win animations
  to instant reveal, both via CSS keyframe override and via JS timer
  zero-out
- Tab order: bet selector → 5 hold buttons → DEAL/DRAW → reset/paytable
- Color contrast: card faces high-contrast against cabinet background;
  WCAG AA minimum

### 15.10 Performance budget
- Client island ≤60KB gzipped per game
- First-deal latency ≤50ms after DEAL is pressed
- No new dependencies — shipping React 19 + Tailwind 4 + the existing `cn()` utility

### 15.11 Trust boundary delta
None. The card parlor adds no new arrows on the trust boundary
diagram in Section 4 — it touches only the client device.

### 15.12 Cross-references
- ADRs C1–C6 (`DECISIONS.md`, 2026-05-01) — integration boundaries
- Spec `docs/superpowers/specs/2026-05-01-card-parlor-design.md` — design rationale
- Math spec `docs/superpowers/specs/cards-video-poker-engine.md` — locked paytable values + golden vectors
```

- [ ] **Step 2.2.2: Verify the section reads cleanly**

```bash
grep -A 2 "^## 15" ARCHITECTURE.md | head -5
```

Expected: heading `## 15 — Card Parlor subsystem` is present and last in the file.

### Task 2.3: Phase 2 local commit (no push)

- [ ] **Step 2.3.1: Stage Phase 2 docs**

```bash
git status -s
git add DECISIONS.md ARCHITECTURE.md
git diff --cached --name-only
```

Expected: exactly two paths.

- [ ] **Step 2.3.2: Commit locally (no push — bundled with Deploy 1)**

```bash
git commit -m "$(cat <<'EOF'
cards: ADRs C1–C6 + ARCHITECTURE Section 15 (card parlor subsystem)

Captures the integration boundaries for the new /cards/ section per
the approved design spec. Sibling to the existing /slots/ subsystem;
no shared route, no shared nav card, no shared streak/leaderboard
coupling.

Spec: docs/superpowers/specs/2026-05-01-card-parlor-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Video Poker Engine math design spec

Doc-only phase. Bundled with Deploy 1.

### Task 3.1: Write `cards-video-poker-engine.md`

**Files:**
- Create: `docs/superpowers/specs/cards-video-poker-engine.md`

This spec captures the math layer that the brainstorm spec deferred:
locked per-row paytable values for both 9/6 JoB and NSUD Deuces Wild,
hand-evaluator semantics with edge cases, golden vector test plan,
deck shuffle uniformity test approach.

- [ ] **Step 3.1.1: Write the math spec**

The implementer writes a new file at the path above. Required sections:

1. **Header** — Date 2026-05-01, status "draft, locked at end of Phase 3," link back to brainstorm spec.
2. **Card / Suit / Rank model** — concrete TypeScript types:
   ```ts
   enum Suit { SPADES, HEARTS, DIAMONDS, CLUBS }
   enum Rank { TWO=2, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, TEN, JACK, QUEEN, KING, ACE }
   interface Card { suit: Suit; rank: Rank; }
   ```
   The 52-card deck is the cartesian product. No jokers.
3. **HandRank enum** — 11 values, ordered worst to best (so a higher numeric value beats a lower):
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
   In standard mode (JoB), the evaluator only returns ranks 0–9.
   In wild mode (Deuces), the evaluator returns ranks 0, 3–8 (no Two
   Pair, no Jacks-or-better) plus 10–13 plus the no-wild straight/flush
   rows (5, 6, 7, 8). Specifically: standard `ROYAL_FLUSH` (9) is
   never returned in wild mode — it becomes either `NATURAL_ROYAL_FLUSH`
   (13) or `WILD_ROYAL_FLUSH` (12) based on whether the hand contains
   a deuce.
4. **Standard evaluator semantics (JoB)** — pseudocode for `evaluateHandStandard(cards: Card[5]): HandRank`. Cover:
   - Straight detection including Ace-low (A-2-3-4-5) and Ace-high (10-J-Q-K-A); reject A-K-2-3-4 (no wrap)
   - Flush detection (all same suit)
   - Straight Flush (both)
   - Royal Flush (Straight Flush AND highest card is Ace AND lowest is 10)
   - Four of a Kind, Full House, Three of a Kind, Two Pair via rank-frequency histogram
   - Jacks or Better: pair where the pair rank is JACK, QUEEN, KING, or ACE
5. **Wild evaluator semantics (Deuces)** — pseudocode for `evaluateHandWild(cards: Card[5]): HandRank`. Cover:
   - Count deuces: 0 → use standard evaluator with Wild/Natural Royal split (no deuces → if Royal, return NATURAL_ROYAL_FLUSH else use standard rank if it's STRAIGHT_FLUSH/FOUR_OF_A_KIND/FULL_HOUSE/FLUSH/STRAIGHT/THREE_OF_A_KIND, else NONE — note that pairs and two-pair never pay in Deuces)
   - 1+ deuce: substitute deuces for whichever cards maximize the resulting rank. Concretely: for each subset assignment of deuces to (rank, suit) values, compute the resulting standard rank, and return the maximum across all assignments.
   - 4 deuces: always return FOUR_DEUCES (rank 11)
   - Special wild ranks: WILD_ROYAL_FLUSH if a Royal Flush is achievable using ≥1 deuce; FIVE_OF_A_KIND if 5 cards same rank counting deuces as that rank
   - The exhaustive substitution loop is bounded: max 4 deuces × 13 ranks × 4 suits = 208 substitutions per deuce, max 208^4 ≈ 1.9B for 4-deuce case — but the 4-deuce case short-circuits to FOUR_DEUCES, and 0-3 deuce cases are tractable with smarter enumeration. The implementer should choose an algorithm that's correct first, optimized second.
6. **Paytable definitions — locked values:**

   **9/6 Jacks or Better** (per coin, 1-coin column):
   ```ts
   const JOB_PAYTABLE: Record<HandRank, number> = {
     [HandRank.NONE]: 0,
     [HandRank.JACKS_OR_BETTER]: 1,
     [HandRank.TWO_PAIR]: 2,
     [HandRank.THREE_OF_A_KIND]: 3,
     [HandRank.STRAIGHT]: 4,
     [HandRank.FLUSH]: 6,
     [HandRank.FULL_HOUSE]: 9,
     [HandRank.FOUR_OF_A_KIND]: 25,
     [HandRank.STRAIGHT_FLUSH]: 50,
     [HandRank.ROYAL_FLUSH]: 250,
   };
   ```
   5-coin Royal Flush bonus: instead of 250 × 5 = 1250, the payout
   becomes 4000 (= 800 × 5). This is the only non-linear bet bonus.

   **NSUD Deuces Wild** (per coin, 1-coin column):
   ```ts
   const DEUCES_PAYTABLE: Record<HandRank, number> = {
     [HandRank.NONE]: 0,
     [HandRank.THREE_OF_A_KIND]: 1,
     [HandRank.STRAIGHT]: 2,
     [HandRank.FLUSH]: 2,
     [HandRank.FULL_HOUSE]: 3,
     [HandRank.FOUR_OF_A_KIND]: 4,
     [HandRank.STRAIGHT_FLUSH]: 13,
     [HandRank.FIVE_OF_A_KIND]: 16,
     [HandRank.WILD_ROYAL_FLUSH]: 25,
     [HandRank.FOUR_DEUCES]: 200,
     [HandRank.NATURAL_ROYAL_FLUSH]: 250,
   };
   ```
   5-coin Natural Royal Flush bonus: instead of 250 × 5 = 1250, the
   payout becomes 4000. Only non-linear bet bonus.

   These values are widely-published facts about standard casino paytables; they encode no copyrightable creative expression. The implementer MUST verify these exact values against the canonical Wizard of Odds paytable references (https://wizardofodds.com — search "Jacks or Better 9/6" and "Deuces Wild Not So Ugly") at the time of implementation. If any value differs from the canonical reference, update the paytable to match the reference and note the correction in the PR.
7. **Bet selector contract:**
   - 1–5 coins per hand
   - All paytable values scale linearly with bet, EXCEPT the top tier
     (Royal Flush in JoB, Natural Royal Flush in Deuces) which jumps
     from 250 × N to 4000 at N=5
   - Bet of 0 is invalid; the spin button is disabled below the
     minimum 1-coin balance
8. **Round state machine** — formal description per Section 15.6 of
   ARCHITECTURE.md.
9. **Test plan — golden vectors:**
   - List 50+ specific hands (cards spelled out) with their expected `HandRank` for both standard and wild evaluators
   - Edge cases:
     - Royal Flush (5 hands, one per suit + one Ace-low check showing it doesn't qualify as Royal)
     - Straight Flush (lowest 6♠-7♠-8♠-9♠-10♠, Ace-low 5♠-4♠-3♠-2♠-A♠)
     - Wild Royal Flush (10♥-J♥-Q♥-2♣-A♥)
     - Natural Royal Flush in Deuces (no 2s — 10♥-J♥-Q♥-K♥-A♥, returns NATURAL_ROYAL_FLUSH not ROYAL_FLUSH)
     - Four Deuces (2♠-2♥-2♦-2♣-anything)
     - Five of a Kind via wilds (K♠-K♥-K♦-2♣-2♥)
     - Four of a Kind natural (A♠-A♥-A♦-A♣-K♠)
     - Four of a Kind via 1 wild (A♠-A♥-A♦-2♣-K♠ → Four of a Kind)
     - Two Pair (J♠-J♥-3♦-3♣-K♠) — pays 2 in JoB, NONE in Deuces
     - Jacks or Better (Q♠-Q♥-3♦-5♣-7♠) — pays 1 in JoB, NONE in Deuces
     - Pair below jacks (10♠-10♥-3♦-5♣-7♠) — NONE in both
     - Junk hand (2♠-7♥-9♦-J♣-K♠ in JoB) — NONE; in Deuces evaluator with wilds, this might pay due to 1 deuce
10. **Test plan — paytable transcription:**
    - Both paytables locked as `Object.freeze`'d constants
    - Tests assert each `[HandRank.X]: Y` mapping verbatim
    - Test 5-coin Royal Flush bonus separately
11. **Test plan — deck shuffle uniformity:**
    - 100,000 shuffles, count how often each rank appears in position 0
    - Each rank should appear ~7,692 times (100,000 / 13)
    - Chi-square statistic should be below the 95% threshold for 12 degrees of freedom (≈ 21.03)
    - Same test for position 1, 2, 3, 4 (full hand range)
12. **Reduced-motion contract:** the engine itself has no animation;
    UI honors `prefers-reduced-motion` separately. This section is for
    cross-reference only.
13. **What we don't verify:** optimal-play RTP simulation. The
    published 99.54% / 99.73% RTP figures assume optimal-strategy hold
    decisions. We don't ship a strategy table; the player picks holds
    however they want. Empirical RTP under random-hold play is much
    lower (75–80% range) and is not a regression — it's a property of
    the game.

- [ ] **Step 3.1.2: Self-review (placeholder scan)**

Search the file for "TBD", "TODO", "fill in", "etc.", "and so on". None should appear. Every paytable value should be a concrete number; every golden vector should spell out the 5 cards.

```bash
grep -niE 'TBD|TODO|fill in|etc\.|and so on' docs/superpowers/specs/cards-video-poker-engine.md
```

Expected: zero matches.

### Task 3.2: Phase 3 local commit (no push)

- [ ] **Step 3.2.1: Stage and commit**

```bash
git add docs/superpowers/specs/cards-video-poker-engine.md
git commit -m "$(cat <<'EOF'
spec: video-poker engine math (paytables locked, golden vectors)

Locks the paytable values for 9/6 Jacks or Better and NSUD Deuces
Wild against canonical Wizard of Odds references. Defines hand
evaluator semantics for both standard and wild modes, including
Ace-low straight handling and the wild-mode rank hierarchy that
splits Royal Flush into Natural / Wild variants. Lists 50+ golden-
vector test cases and a deck-shuffle uniformity test approach.

Brainstorm spec: docs/superpowers/specs/2026-05-01-card-parlor-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4A — Shared engine (TDD)

Six source files + six test files. Bundled with Deploy 1.

### Task 4A.1: `types.ts` (shared types)

**Files:**
- Create: `lib/cards/video-poker/types.ts`

- [ ] **Step 4A.1.1: Write the file**

```ts
// Shared types for the video-poker engine.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md section 2-3

export enum Suit {
  SPADES = "S",
  HEARTS = "H",
  DIAMONDS = "D",
  CLUBS = "C",
}

export enum Rank {
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14,
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

/** A 5-card dealt hand. Always exactly 5 cards. */
export type Hand = readonly [Card, Card, Card, Card, Card];

/** A 52-card deck (or remaining deck) as an ordered array. */
export type Deck = readonly Card[];

/**
 * Hand classification, ordered worst (NONE=0) to best within each mode.
 * Standard mode (JoB) returns 0..9. Wild mode (Deuces) returns
 * {0, 3..8} ∪ {10..13}; never returns ROYAL_FLUSH (9).
 */
export enum HandRank {
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
  FIVE_OF_A_KIND = 10,
  FOUR_DEUCES = 11,
  WILD_ROYAL_FLUSH = 12,
  NATURAL_ROYAL_FLUSH = 13,
}

/** Display name for each rank, for UI consumption. */
export const HAND_RANK_NAME: Record<HandRank, string> = {
  [HandRank.NONE]: "no win",
  [HandRank.JACKS_OR_BETTER]: "jacks or better",
  [HandRank.TWO_PAIR]: "two pair",
  [HandRank.THREE_OF_A_KIND]: "three of a kind",
  [HandRank.STRAIGHT]: "straight",
  [HandRank.FLUSH]: "flush",
  [HandRank.FULL_HOUSE]: "full house",
  [HandRank.FOUR_OF_A_KIND]: "four of a kind",
  [HandRank.STRAIGHT_FLUSH]: "straight flush",
  [HandRank.ROYAL_FLUSH]: "royal flush",
  [HandRank.FIVE_OF_A_KIND]: "five of a kind",
  [HandRank.FOUR_DEUCES]: "four deuces",
  [HandRank.WILD_ROYAL_FLUSH]: "wild royal flush",
  [HandRank.NATURAL_ROYAL_FLUSH]: "natural royal flush",
};
```

- [ ] **Step 4A.1.2: Verify it typechecks**

```bash
npm run typecheck 2>&1 | tail -3
```

Expected: clean.

### Task 4A.2: `rng.ts` (port of slot RNG)

**Files:**
- Create: `lib/cards/video-poker/rng.ts`

- [ ] **Step 4A.2.1: Write the file as a near-identical port of `lib/slots/tideforge-pearls/rng.ts`**

Read the slot file first to confirm the current shape:

```bash
cat lib/slots/tideforge-pearls/rng.ts
```

Then write `lib/cards/video-poker/rng.ts` with the same `SlotRng` interface, same xoshiro256** seeded RNG, same `crypto.getRandomValues`-backed runtime RNG (including the `nextInt(1)` early-return guard from the slot fix), and the same JSDoc style. The only meaningful difference: comments reference "video poker" instead of "Tideforge Pearls" / "slot" where applicable, and the file header references `cards-video-poker-engine.md` section 15.5 instead of the slot spec.

The interface name **must** stay `SlotRng` so a future hoist to `lib/util/rng.ts` is mechanical. The port is intentional duplication, not a refactor target — see ARCHITECTURE Section 15.5 for the YAGNI rationale.

- [ ] **Step 4A.2.2: Write the test file as a port of `lib/slots/tideforge-pearls/rng.test.ts`**

```bash
cat lib/slots/tideforge-pearls/rng.test.ts
```

Port to `lib/cards/video-poker/rng.test.ts` — same 5 tests (determinism, range bounds, [0,1) range, seed divergence, nextInt(1) regression). The tests are pure-shape unit tests; no port adjustments needed beyond the import path.

- [ ] **Step 4A.2.3: Run RNG tests**

```bash
npx vitest run lib/cards/video-poker/rng.test.ts 2>&1 | tail -5
```

Expected: 5 tests pass.

### Task 4A.3: `deck.ts` (deck creation + shuffle) with TDD

**Files:**
- Create: `lib/cards/video-poker/deck.ts`
- Create: `lib/cards/video-poker/deck.test.ts`

- [ ] **Step 4A.3.1: Write failing tests**

```ts
// lib/cards/video-poker/deck.test.ts
import { describe, it, expect } from "vitest";
import { createDeck, shuffle } from "./deck";
import { createSeededRng } from "./rng";
import { Suit, Rank, type Deck } from "./types";

describe("createDeck", () => {
  it("returns 52 cards", () => {
    const d = createDeck();
    expect(d).toHaveLength(52);
  });

  it("contains every (suit, rank) combination exactly once", () => {
    const d = createDeck();
    const seen = new Set<string>();
    for (const c of d) seen.add(`${c.suit}-${c.rank}`);
    expect(seen.size).toBe(52);
  });

  it("returns a fresh array on each call (no shared mutation)", () => {
    const a = createDeck();
    const b = createDeck();
    expect(a).not.toBe(b);
  });
});

describe("shuffle", () => {
  it("returns a 52-card array containing the same cards in a different order", () => {
    const rng = createSeededRng(20260501n);
    const d = createDeck();
    const s = shuffle(d, rng);
    expect(s).toHaveLength(52);
    // Same multiset of cards
    const ids = (deck: Deck) => deck.map(c => `${c.suit}-${c.rank}`).sort();
    expect(ids(s)).toEqual(ids(d));
    // Order should differ for any reasonable RNG (Fisher-Yates with a real shuffle)
    expect(s.map(c => `${c.suit}-${c.rank}`)).not.toEqual(d.map(c => `${c.suit}-${c.rank}`));
  });

  it("is deterministic given the same seed", () => {
    const a = shuffle(createDeck(), createSeededRng(42n));
    const b = shuffle(createDeck(), createSeededRng(42n));
    expect(a).toEqual(b);
  });

  it("does not mutate the input deck", () => {
    const d = createDeck();
    const dCopy = [...d];
    shuffle(d, createSeededRng(1n));
    expect(d).toEqual(dCopy);
  });

  it("shuffle uniformity — chi-square test on position 0 over 10000 shuffles", () => {
    const rng = createSeededRng(99n);
    const counts = new Map<number, number>();
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const s = shuffle(createDeck(), rng);
      const key = s[0]!.rank * 4 + (s[0]!.suit === Suit.SPADES ? 0 : s[0]!.suit === Suit.HEARTS ? 1 : s[0]!.suit === Suit.DIAMONDS ? 2 : 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Chi-square against uniform distribution over 52 cells
    const expected = N / 52;
    let chi2 = 0;
    for (let cell = 0; cell < 52; cell++) {
      const observed = counts.get(cell) ?? 0;
      chi2 += ((observed - expected) ** 2) / expected;
    }
    // 95% threshold for 51 dof is ~68.7. Our test should comfortably pass.
    expect(chi2).toBeLessThan(100);
  });
});
```

- [ ] **Step 4A.3.2: Run tests — expect failures**

```bash
npx vitest run lib/cards/video-poker/deck.test.ts 2>&1 | tail -5
```

Expected: FAIL with module-not-found or function-not-defined.

- [ ] **Step 4A.3.3: Implement `deck.ts`**

```ts
// lib/cards/video-poker/deck.ts
// Deck creation and Fisher-Yates shuffle.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md section 2

import { Suit, Rank, type Card, type Deck } from "./types";
import type { SlotRng } from "./rng";

const SUITS: readonly Suit[] = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
const RANKS: readonly Rank[] = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
  Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE,
];

/** Build a fresh ordered 52-card deck (suit-major, rank-minor). */
export function createDeck(): Deck {
  const out: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      out.push({ suit, rank });
    }
  }
  return out;
}

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate input.
 * Bias-free given a bias-free `rng.nextInt`.
 */
export function shuffle(deck: Deck, rng: SlotRng): Deck {
  const out: Card[] = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
```

- [ ] **Step 4A.3.4: Run tests — expect pass**

```bash
npx vitest run lib/cards/video-poker/deck.test.ts 2>&1 | tail -5
```

Expected: 6 tests pass.

### Task 4A.4: `evaluate.ts` (hand evaluator) with TDD

**Files:**
- Create: `lib/cards/video-poker/evaluate.ts`
- Create: `lib/cards/video-poker/evaluate.test.ts`

This is the most complex single module in the engine. It needs to handle two modes (standard and wild) and over 50 golden-vector cases.

- [ ] **Step 4A.4.1: Write failing tests — test fixture helpers + standard mode tests**

```ts
// lib/cards/video-poker/evaluate.test.ts
import { describe, it, expect } from "vitest";
import { evaluateHand } from "./evaluate";
import { Suit, Rank, HandRank, type Hand, type Card } from "./types";

// Compact card-builder helpers for readable golden vectors.
const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const S = Suit.SPADES, H = Suit.HEARTS, D = Suit.DIAMONDS, CL = Suit.CLUBS;
const T2 = Rank.TWO, T3 = Rank.THREE, T4 = Rank.FOUR, T5 = Rank.FIVE,
      T6 = Rank.SIX, T7 = Rank.SEVEN, T8 = Rank.EIGHT, T9 = Rank.NINE,
      TT = Rank.TEN, TJ = Rank.JACK, TQ = Rank.QUEEN, TK = Rank.KING,
      TA = Rank.ACE;
const hand = (a: Card, b: Card, cd: Card, d: Card, e: Card): Hand => [a, b, cd, d, e];

describe("evaluateHand — standard mode (Jacks or Better)", () => {
  it("Royal Flush (10-J-Q-K-A all spades)", () => {
    expect(evaluateHand(hand(c(TT,S), c(TJ,S), c(TQ,S), c(TK,S), c(TA,S)), { wildRank: null }))
      .toBe(HandRank.ROYAL_FLUSH);
  });

  it("Straight Flush (5-6-7-8-9 hearts)", () => {
    expect(evaluateHand(hand(c(T5,H), c(T6,H), c(T7,H), c(T8,H), c(T9,H)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT_FLUSH);
  });

  it("Ace-low Straight Flush (A-2-3-4-5 diamonds)", () => {
    expect(evaluateHand(hand(c(TA,D), c(T2,D), c(T3,D), c(T4,D), c(T5,D)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT_FLUSH);
  });

  it("Four of a Kind (four aces + king)", () => {
    expect(evaluateHand(hand(c(TA,S), c(TA,H), c(TA,D), c(TA,CL), c(TK,S)), { wildRank: null }))
      .toBe(HandRank.FOUR_OF_A_KIND);
  });

  it("Full House (three queens + pair of fives)", () => {
    expect(evaluateHand(hand(c(TQ,S), c(TQ,H), c(TQ,D), c(T5,CL), c(T5,S)), { wildRank: null }))
      .toBe(HandRank.FULL_HOUSE);
  });

  it("Flush (all clubs, not in sequence)", () => {
    expect(evaluateHand(hand(c(T2,CL), c(T5,CL), c(T7,CL), c(T9,CL), c(TJ,CL)), { wildRank: null }))
      .toBe(HandRank.FLUSH);
  });

  it("Straight (mixed suits, 4-5-6-7-8)", () => {
    expect(evaluateHand(hand(c(T4,S), c(T5,H), c(T6,D), c(T7,CL), c(T8,S)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT);
  });

  it("Ace-low Straight (A-2-3-4-5 mixed suits)", () => {
    expect(evaluateHand(hand(c(TA,S), c(T2,H), c(T3,D), c(T4,CL), c(T5,S)), { wildRank: null }))
      .toBe(HandRank.STRAIGHT);
  });

  it("Three of a Kind (three sevens)", () => {
    expect(evaluateHand(hand(c(T7,S), c(T7,H), c(T7,D), c(TJ,CL), c(T2,S)), { wildRank: null }))
      .toBe(HandRank.THREE_OF_A_KIND);
  });

  it("Two Pair (jacks and threes)", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(T3,D), c(T3,CL), c(TK,S)), { wildRank: null }))
      .toBe(HandRank.TWO_PAIR);
  });

  it("Jacks or Better — pair of queens", () => {
    expect(evaluateHand(hand(c(TQ,S), c(TQ,H), c(T3,D), c(T5,CL), c(T7,S)), { wildRank: null }))
      .toBe(HandRank.JACKS_OR_BETTER);
  });

  it("NONE — pair of tens (below jacks)", () => {
    expect(evaluateHand(hand(c(TT,S), c(TT,H), c(T3,D), c(T5,CL), c(T7,S)), { wildRank: null }))
      .toBe(HandRank.NONE);
  });

  it("NONE — high-card hand with no straight or flush", () => {
    expect(evaluateHand(hand(c(T2,S), c(T7,H), c(T9,D), c(TJ,CL), c(TK,S)), { wildRank: null }))
      .toBe(HandRank.NONE);
  });

  it("does NOT classify A-K-2-3-4 as a straight (no wraparound)", () => {
    expect(evaluateHand(hand(c(TA,S), c(TK,H), c(T2,D), c(T3,CL), c(T4,S)), { wildRank: null }))
      .toBe(HandRank.NONE);
  });
});
```

- [ ] **Step 4A.4.2: Add wild-mode tests to the same file**

Append to `lib/cards/video-poker/evaluate.test.ts`:

```ts
describe("evaluateHand — wild mode (Deuces Wild)", () => {
  const wildOpts = { wildRank: Rank.TWO };

  it("NATURAL_ROYAL_FLUSH (no deuces) — 10-J-Q-K-A hearts", () => {
    expect(evaluateHand(hand(c(TT,H), c(TJ,H), c(TQ,H), c(TK,H), c(TA,H)), wildOpts))
      .toBe(HandRank.NATURAL_ROYAL_FLUSH);
  });

  it("FOUR_DEUCES — all four 2s + any fifth card", () => {
    expect(evaluateHand(hand(c(T2,S), c(T2,H), c(T2,D), c(T2,CL), c(TK,S)), wildOpts))
      .toBe(HandRank.FOUR_DEUCES);
  });

  it("WILD_ROYAL_FLUSH (one deuce filling 10) — J-Q-K-A hearts + 2 of clubs", () => {
    expect(evaluateHand(hand(c(TJ,H), c(TQ,H), c(TK,H), c(TA,H), c(T2,CL)), wildOpts))
      .toBe(HandRank.WILD_ROYAL_FLUSH);
  });

  it("FIVE_OF_A_KIND — three kings + two deuces", () => {
    expect(evaluateHand(hand(c(TK,S), c(TK,H), c(TK,D), c(T2,CL), c(T2,S)), wildOpts))
      .toBe(HandRank.FIVE_OF_A_KIND);
  });

  it("STRAIGHT_FLUSH (one deuce filling middle) — 5-6-?-8-9 spades + 2 of diamonds", () => {
    expect(evaluateHand(hand(c(T5,S), c(T6,S), c(T2,D), c(T8,S), c(T9,S)), wildOpts))
      .toBe(HandRank.STRAIGHT_FLUSH);
  });

  it("FOUR_OF_A_KIND (natural — no deuces) — four aces + king", () => {
    expect(evaluateHand(hand(c(TA,S), c(TA,H), c(TA,D), c(TA,CL), c(TK,S)), wildOpts))
      .toBe(HandRank.FOUR_OF_A_KIND);
  });

  it("FOUR_OF_A_KIND (one deuce) — three jacks + 2 + king", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(TJ,D), c(T2,CL), c(TK,S)), wildOpts))
      .toBe(HandRank.FOUR_OF_A_KIND);
  });

  it("FULL_HOUSE — three sevens + pair of jacks", () => {
    expect(evaluateHand(hand(c(T7,S), c(T7,H), c(T7,D), c(TJ,CL), c(TJ,S)), wildOpts))
      .toBe(HandRank.FULL_HOUSE);
  });

  it("FLUSH — all spades, no straight, no deuces", () => {
    expect(evaluateHand(hand(c(T3,S), c(T6,S), c(T8,S), c(TJ,S), c(TK,S)), wildOpts))
      .toBe(HandRank.FLUSH);
  });

  it("STRAIGHT — mixed suits, 4-5-6-7-8, no deuces", () => {
    expect(evaluateHand(hand(c(T4,S), c(T5,H), c(T6,D), c(T7,CL), c(T8,S)), wildOpts))
      .toBe(HandRank.STRAIGHT);
  });

  it("THREE_OF_A_KIND — pair of nines + one deuce + two off-cards", () => {
    expect(evaluateHand(hand(c(T9,S), c(T9,H), c(T2,D), c(T5,CL), c(T7,S)), wildOpts))
      .toBe(HandRank.THREE_OF_A_KIND);
  });

  it("NONE — pair of jacks (no deuces) — pairs do NOT pay in Deuces Wild", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(T3,D), c(T5,CL), c(T7,S)), wildOpts))
      .toBe(HandRank.NONE);
  });

  it("NONE — two pair (no deuces) — two pair does NOT pay in Deuces Wild", () => {
    expect(evaluateHand(hand(c(TJ,S), c(TJ,H), c(T3,D), c(T3,CL), c(T7,S)), wildOpts))
      .toBe(HandRank.NONE);
  });

  it("NONE — high-card junk hand (no deuces, no straight, no flush)", () => {
    expect(evaluateHand(hand(c(T3,S), c(T7,H), c(T9,D), c(TJ,CL), c(TK,S)), wildOpts))
      .toBe(HandRank.NONE);
  });
});
```

- [ ] **Step 4A.4.3: Run tests — expect failures (no impl yet)**

```bash
npx vitest run lib/cards/video-poker/evaluate.test.ts 2>&1 | tail -10
```

Expected: 28 failing tests with module-not-found.

- [ ] **Step 4A.4.4: Implement `evaluate.ts`**

This is the core algorithm. Implement in two phases: standard evaluator first (no wilds), then wrap with wild-mode substitution logic.

```ts
// lib/cards/video-poker/evaluate.ts
// Hand evaluator for video poker. Handles standard (JoB) and wild (Deuces) modes.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md sections 4-5

import { Rank, Suit, HandRank, type Card, type Hand } from "./types";

export interface EvaluateOptions {
  /** When non-null, that rank acts as a wild card (substitutes for any rank/suit). Use Rank.TWO for Deuces Wild. */
  wildRank: Rank | null;
}

export function evaluateHand(hand: Hand, opts: EvaluateOptions): HandRank {
  if (opts.wildRank == null) return evaluateStandard(hand);
  return evaluateWild(hand, opts.wildRank);
}

// ---------------------------------------------------------------------------
// Standard (no-wild) evaluation
// ---------------------------------------------------------------------------

function evaluateStandard(hand: Hand): HandRank {
  const ranks = hand.map(c => c.rank).sort((a, b) => a - b);
  const suits = hand.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(ranks);
  const isRoyalRanks = ranks[0] === Rank.TEN && ranks[4] === Rank.ACE && isStraight;

  if (isFlush && isRoyalRanks) return HandRank.ROYAL_FLUSH;
  if (isFlush && isStraight) return HandRank.STRAIGHT_FLUSH;

  // Rank frequency histogram
  const freq = new Map<Rank, number>();
  for (const r of ranks) freq.set(r, (freq.get(r) ?? 0) + 1);
  const counts = [...freq.values()].sort((a, b) => b - a);

  if (counts[0] === 4) return HandRank.FOUR_OF_A_KIND;
  if (counts[0] === 3 && counts[1] === 2) return HandRank.FULL_HOUSE;
  if (isFlush) return HandRank.FLUSH;
  if (isStraight) return HandRank.STRAIGHT;
  if (counts[0] === 3) return HandRank.THREE_OF_A_KIND;
  if (counts[0] === 2 && counts[1] === 2) return HandRank.TWO_PAIR;

  // Pair — only pays as Jacks or Better if the pair rank is J/Q/K/A
  if (counts[0] === 2) {
    for (const [rank, count] of freq) {
      if (count === 2 && rank >= Rank.JACK) return HandRank.JACKS_OR_BETTER;
    }
  }

  return HandRank.NONE;
}

/** True if the 5 sorted ranks form a straight (consecutive, OR Ace-low A-2-3-4-5). */
function checkStraight(sortedRanks: readonly Rank[]): boolean {
  // Standard sequential
  let consecutive = true;
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i]! !== sortedRanks[i - 1]! + 1) { consecutive = false; break; }
  }
  if (consecutive) return true;

  // Ace-low special case: 2-3-4-5-A (sorted as [2,3,4,5,14])
  if (sortedRanks[0] === Rank.TWO && sortedRanks[1] === Rank.THREE
      && sortedRanks[2] === Rank.FOUR && sortedRanks[3] === Rank.FIVE
      && sortedRanks[4] === Rank.ACE) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Wild (deuce) evaluation
// ---------------------------------------------------------------------------

function evaluateWild(hand: Hand, wildRank: Rank): HandRank {
  const wilds = hand.filter(c => c.rank === wildRank);
  const naturals = hand.filter(c => c.rank !== wildRank) as Card[];

  // 4 wilds → always FOUR_DEUCES (regardless of fifth card)
  if (wilds.length === 4) return HandRank.FOUR_DEUCES;

  // 0 wilds → standard eval, then upgrade ROYAL_FLUSH to NATURAL_ROYAL_FLUSH; demote pairs/two-pair
  if (wilds.length === 0) {
    const standard = evaluateStandard(hand);
    if (standard === HandRank.ROYAL_FLUSH) return HandRank.NATURAL_ROYAL_FLUSH;
    // Pairs and two-pair don't pay in Deuces; minimum paying is THREE_OF_A_KIND
    if (standard === HandRank.JACKS_OR_BETTER || standard === HandRank.TWO_PAIR) {
      return HandRank.NONE;
    }
    return standard;
  }

  // 1-3 wilds: enumerate substitutions, return the best resulting rank
  return bestWildSubstitution(naturals, wilds.length);
}

/**
 * Try every possible substitution for `wildCount` wild cards, evaluate
 * the resulting 5-card standard hand, and return the highest-paying
 * classification (with the Wild/Natural Royal split applied).
 *
 * For 1 wild: 52 substitutions. For 2 wilds: 52^2 = 2704. For 3: 52^3 = 140608.
 * Tractable for a per-hand evaluation; not in a Monte Carlo loop.
 */
function bestWildSubstitution(naturals: Card[], wildCount: number): HandRank {
  const ALL_RANKS: Rank[] = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE,
  ];
  const ALL_SUITS: Suit[] = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];

  let bestRank: HandRank = HandRank.NONE;

  // Generator over all 52^wildCount substitution tuples.
  function recurse(subs: Card[]): void {
    if (subs.length === wildCount) {
      const fullHand = [...naturals, ...subs] as Card[];
      // Pad to a 5-tuple Hand
      const handTuple = fullHand as unknown as Hand;
      const standard = evaluateStandard(handTuple);
      const wildResult = upgradeForWildContext(standard, fullHand, wildCount);
      if (wildResult > bestRank) bestRank = wildResult;
      return;
    }
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        // Skip substituting in another deuce — the wild itself is the "wild," and
        // including a second card with rank=2 in `naturals` is impossible (we filtered).
        // But we can substitute a 2 if there are still 2s left in the deck conceptually;
        // for evaluation purposes any rank substitution is allowed including 2s.
        subs.push({ suit, rank });
        recurse(subs);
        subs.pop();
      }
    }
  }
  recurse([]);
  return bestRank;
}

/**
 * Apply the wild-mode rank rewrite to a standard evaluation result, given
 * the substituted hand and the count of wilds used.
 *
 * - ROYAL_FLUSH with 0 wilds → NATURAL_ROYAL_FLUSH (handled in caller)
 * - ROYAL_FLUSH with 1+ wilds → WILD_ROYAL_FLUSH
 * - 5-of-a-kind detection (only possible with wilds substituted): if four
 *   naturals share a rank AND a wild substituted as that rank → FIVE_OF_A_KIND
 * - Pairs and two-pair always demote to NONE in wild mode (handled in caller)
 */
function upgradeForWildContext(standard: HandRank, fullHand: Card[], wildCount: number): HandRank {
  if (standard === HandRank.ROYAL_FLUSH && wildCount > 0) return HandRank.WILD_ROYAL_FLUSH;

  // Five of a kind: 5 cards same rank
  const freq = new Map<Rank, number>();
  for (const c of fullHand) freq.set(c.rank, (freq.get(c.rank) ?? 0) + 1);
  for (const count of freq.values()) {
    if (count === 5) return HandRank.FIVE_OF_A_KIND;
  }

  if (standard === HandRank.JACKS_OR_BETTER) return HandRank.NONE;
  if (standard === HandRank.TWO_PAIR) return HandRank.NONE;
  return standard;
}
```

- [ ] **Step 4A.4.5: Run tests — expect pass**

```bash
npx vitest run lib/cards/video-poker/evaluate.test.ts 2>&1 | tail -10
```

Expected: 28 tests pass. If any fail, debug the specific case (most likely culprits: Ace-low straight detection, wild-mode substitution exhaustiveness, FIVE_OF_A_KIND vs FOUR_OF_A_KIND boundary).

### Task 4A.5: `paytable.ts` (locked paytables) with transcription tests

**Files:**
- Create: `lib/cards/video-poker/paytable.ts`
- Create: `lib/cards/video-poker/paytable.test.ts`

- [ ] **Step 4A.5.1: Write the file**

```ts
// lib/cards/video-poker/paytable.ts
// Locked paytables for 9/6 Jacks or Better and NSUD Deuces Wild.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md section 6
//
// These values are widely-published facts about standard casino paytables;
// they encode no copyrightable creative expression.

import { HandRank } from "./types";

/** Per-coin payout for a hand at bet=1. Top tier (Royal Flush variants) is replaced by 800 at bet=5. */
export type Paytable = Readonly<Record<HandRank, number>>;

/** 9/6 Jacks or Better. ~99.54% RTP under optimal-strategy play. */
export const JOB_PAYTABLE: Paytable = Object.freeze({
  [HandRank.NONE]: 0,
  [HandRank.JACKS_OR_BETTER]: 1,
  [HandRank.TWO_PAIR]: 2,
  [HandRank.THREE_OF_A_KIND]: 3,
  [HandRank.STRAIGHT]: 4,
  [HandRank.FLUSH]: 6,
  [HandRank.FULL_HOUSE]: 9,
  [HandRank.FOUR_OF_A_KIND]: 25,
  [HandRank.STRAIGHT_FLUSH]: 50,
  [HandRank.ROYAL_FLUSH]: 250,
  [HandRank.FIVE_OF_A_KIND]: 0,
  [HandRank.FOUR_DEUCES]: 0,
  [HandRank.WILD_ROYAL_FLUSH]: 0,
  [HandRank.NATURAL_ROYAL_FLUSH]: 0,
});

/** NSUD ("Not So Ugly Deuces") Deuces Wild. ~99.73% RTP under optimal-strategy play. */
export const DEUCES_PAYTABLE: Paytable = Object.freeze({
  [HandRank.NONE]: 0,
  [HandRank.JACKS_OR_BETTER]: 0,
  [HandRank.TWO_PAIR]: 0,
  [HandRank.THREE_OF_A_KIND]: 1,
  [HandRank.STRAIGHT]: 2,
  [HandRank.FLUSH]: 2,
  [HandRank.FULL_HOUSE]: 3,
  [HandRank.FOUR_OF_A_KIND]: 4,
  [HandRank.STRAIGHT_FLUSH]: 13,
  [HandRank.ROYAL_FLUSH]: 0,
  [HandRank.FIVE_OF_A_KIND]: 16,
  [HandRank.FOUR_DEUCES]: 200,
  [HandRank.WILD_ROYAL_FLUSH]: 25,
  [HandRank.NATURAL_ROYAL_FLUSH]: 250,
});

/** Top-tier rank that triggers the 5-coin bonus (jumps from 250×5=1250 to 4000). */
export const TOP_TIER_BY_PAYTABLE: ReadonlyMap<Paytable, HandRank> = new Map([
  [JOB_PAYTABLE, HandRank.ROYAL_FLUSH],
  [DEUCES_PAYTABLE, HandRank.NATURAL_ROYAL_FLUSH],
]);

/** Compute the credit payout for a (rank, paytable, bet) combination. */
export function computePayout(rank: HandRank, paytable: Paytable, bet: number): number {
  if (bet < 1 || bet > 5 || !Number.isInteger(bet)) {
    throw new Error(`computePayout: bet must be integer 1..5 (got ${bet})`);
  }
  const perCoin = paytable[rank];
  const topTier = TOP_TIER_BY_PAYTABLE.get(paytable);
  if (bet === 5 && topTier != null && rank === topTier) {
    return 4000;
  }
  return perCoin * bet;
}
```

- [ ] **Step 4A.5.2: Write transcription tests**

```ts
// lib/cards/video-poker/paytable.test.ts
import { describe, it, expect } from "vitest";
import { JOB_PAYTABLE, DEUCES_PAYTABLE, computePayout } from "./paytable";
import { HandRank } from "./types";

describe("JOB_PAYTABLE — 9/6 Jacks or Better", () => {
  const cases: ReadonlyArray<[HandRank, number]> = [
    [HandRank.NONE, 0],
    [HandRank.JACKS_OR_BETTER, 1],
    [HandRank.TWO_PAIR, 2],
    [HandRank.THREE_OF_A_KIND, 3],
    [HandRank.STRAIGHT, 4],
    [HandRank.FLUSH, 6],
    [HandRank.FULL_HOUSE, 9],
    [HandRank.FOUR_OF_A_KIND, 25],
    [HandRank.STRAIGHT_FLUSH, 50],
    [HandRank.ROYAL_FLUSH, 250],
  ];
  for (const [rank, expected] of cases) {
    it(`${HandRank[rank]} pays ${expected}`, () => {
      expect(JOB_PAYTABLE[rank]).toBe(expected);
    });
  }
  it("wild-mode ranks are 0 in JoB paytable", () => {
    expect(JOB_PAYTABLE[HandRank.FIVE_OF_A_KIND]).toBe(0);
    expect(JOB_PAYTABLE[HandRank.FOUR_DEUCES]).toBe(0);
    expect(JOB_PAYTABLE[HandRank.WILD_ROYAL_FLUSH]).toBe(0);
    expect(JOB_PAYTABLE[HandRank.NATURAL_ROYAL_FLUSH]).toBe(0);
  });
});

describe("DEUCES_PAYTABLE — NSUD Deuces Wild", () => {
  const cases: ReadonlyArray<[HandRank, number]> = [
    [HandRank.NONE, 0],
    [HandRank.THREE_OF_A_KIND, 1],
    [HandRank.STRAIGHT, 2],
    [HandRank.FLUSH, 2],
    [HandRank.FULL_HOUSE, 3],
    [HandRank.FOUR_OF_A_KIND, 4],
    [HandRank.STRAIGHT_FLUSH, 13],
    [HandRank.FIVE_OF_A_KIND, 16],
    [HandRank.WILD_ROYAL_FLUSH, 25],
    [HandRank.FOUR_DEUCES, 200],
    [HandRank.NATURAL_ROYAL_FLUSH, 250],
  ];
  for (const [rank, expected] of cases) {
    it(`${HandRank[rank]} pays ${expected}`, () => {
      expect(DEUCES_PAYTABLE[rank]).toBe(expected);
    });
  }
  it("standard pair / two-pair / standard royal do not pay in Deuces", () => {
    expect(DEUCES_PAYTABLE[HandRank.JACKS_OR_BETTER]).toBe(0);
    expect(DEUCES_PAYTABLE[HandRank.TWO_PAIR]).toBe(0);
    expect(DEUCES_PAYTABLE[HandRank.ROYAL_FLUSH]).toBe(0);
  });
});

describe("computePayout", () => {
  it("scales linearly with bet for non-top-tier hands", () => {
    expect(computePayout(HandRank.FOUR_OF_A_KIND, JOB_PAYTABLE, 1)).toBe(25);
    expect(computePayout(HandRank.FOUR_OF_A_KIND, JOB_PAYTABLE, 5)).toBe(125);
  });
  it("JoB Royal Flush pays 250 × bet for bets 1-4, jumps to 4000 at bet 5", () => {
    expect(computePayout(HandRank.ROYAL_FLUSH, JOB_PAYTABLE, 1)).toBe(250);
    expect(computePayout(HandRank.ROYAL_FLUSH, JOB_PAYTABLE, 4)).toBe(1000);
    expect(computePayout(HandRank.ROYAL_FLUSH, JOB_PAYTABLE, 5)).toBe(4000);
  });
  it("Deuces Natural Royal Flush pays 250 × bet for bets 1-4, jumps to 4000 at bet 5", () => {
    expect(computePayout(HandRank.NATURAL_ROYAL_FLUSH, DEUCES_PAYTABLE, 1)).toBe(250);
    expect(computePayout(HandRank.NATURAL_ROYAL_FLUSH, DEUCES_PAYTABLE, 4)).toBe(1000);
    expect(computePayout(HandRank.NATURAL_ROYAL_FLUSH, DEUCES_PAYTABLE, 5)).toBe(4000);
  });
  it("Deuces Wild Royal Flush does NOT trigger the bet-5 bonus", () => {
    expect(computePayout(HandRank.WILD_ROYAL_FLUSH, DEUCES_PAYTABLE, 5)).toBe(125);
  });
  it("throws on invalid bet", () => {
    expect(() => computePayout(HandRank.FLUSH, JOB_PAYTABLE, 0)).toThrow();
    expect(() => computePayout(HandRank.FLUSH, JOB_PAYTABLE, 6)).toThrow();
    expect(() => computePayout(HandRank.FLUSH, JOB_PAYTABLE, 1.5)).toThrow();
  });
});
```

- [ ] **Step 4A.5.3: Run tests**

```bash
npx vitest run lib/cards/video-poker/paytable.test.ts 2>&1 | tail -5
```

Expected: ~25 tests pass.

### Task 4A.6: `round.ts` (round state machine) with TDD

**Files:**
- Create: `lib/cards/video-poker/round.ts`
- Create: `lib/cards/video-poker/round.test.ts`

- [ ] **Step 4A.6.1: Write failing tests**

```ts
// lib/cards/video-poker/round.test.ts
import { describe, it, expect } from "vitest";
import { startRound, applyHolds, type RoundResult } from "./round";
import { JOB_PAYTABLE } from "./paytable";
import { createSeededRng } from "./rng";
import { HandRank, Rank, Suit } from "./types";

describe("round — startRound", () => {
  it("returns a 5-card initial hand and the remaining deck", () => {
    const r = startRound(createSeededRng(20260501n));
    expect(r.hand).toHaveLength(5);
    expect(r.remainingDeck).toHaveLength(47);
  });

  it("is deterministic given the same seed", () => {
    const a = startRound(createSeededRng(7n));
    const b = startRound(createSeededRng(7n));
    expect(a.hand).toEqual(b.hand);
    expect(a.remainingDeck).toEqual(b.remainingDeck);
  });
});

describe("round — applyHolds", () => {
  it("with all 5 cards held, returns the same hand", () => {
    const start = startRound(createSeededRng(1n));
    const result = applyHolds(start, [true, true, true, true, true], JOB_PAYTABLE, 5);
    expect(result.finalHand).toEqual(start.hand);
  });

  it("with all 5 cards discarded, returns 5 fresh cards from the remaining deck", () => {
    const start = startRound(createSeededRng(2n));
    const result = applyHolds(start, [false, false, false, false, false], JOB_PAYTABLE, 5);
    // Final hand should be the first 5 cards of remainingDeck
    expect(result.finalHand).toEqual(start.remainingDeck.slice(0, 5));
  });

  it("with 2 held + 3 discarded, the 3 discarded slots are replaced by remainingDeck[0..2]", () => {
    const start = startRound(createSeededRng(3n));
    const holds = [true, false, true, false, false] as const;
    const result = applyHolds(start, [...holds], JOB_PAYTABLE, 5);
    // Held positions stay
    expect(result.finalHand[0]).toEqual(start.hand[0]);
    expect(result.finalHand[2]).toEqual(start.hand[2]);
    // Discarded positions replaced with deck[0], deck[1], deck[2] in order
    expect(result.finalHand[1]).toEqual(start.remainingDeck[0]);
    expect(result.finalHand[3]).toEqual(start.remainingDeck[1]);
    expect(result.finalHand[4]).toEqual(start.remainingDeck[2]);
  });

  it("classifies the final hand and computes the payout via the supplied paytable + bet", () => {
    // Construct a deterministic round that produces a known classification.
    // Use a controlled hand by stubbing through applyHolds: hold none, take first 5 of a known-shuffled deck.
    const start = startRound(createSeededRng(20260501n));
    const result = applyHolds(start, [false, false, false, false, false], JOB_PAYTABLE, 5);
    // Just assert the result has the expected shape
    expect(result.handRank).toBeGreaterThanOrEqual(HandRank.NONE);
    expect(result.handRank).toBeLessThanOrEqual(HandRank.NATURAL_ROYAL_FLUSH);
    expect(result.payout).toBeGreaterThanOrEqual(0);
  });

  it("computes JoB Royal Flush payout correctly for bet=5 (4000 credits)", () => {
    // Manually construct a Royal Flush hand by short-circuiting the round.
    const start = {
      hand: [
        { suit: Suit.SPADES, rank: Rank.TEN },
        { suit: Suit.SPADES, rank: Rank.JACK },
        { suit: Suit.SPADES, rank: Rank.QUEEN },
        { suit: Suit.SPADES, rank: Rank.KING },
        { suit: Suit.SPADES, rank: Rank.ACE },
      ],
      remainingDeck: [],
    } as const;
    const result = applyHolds(start, [true, true, true, true, true], JOB_PAYTABLE, 5);
    expect(result.handRank).toBe(HandRank.ROYAL_FLUSH);
    expect(result.payout).toBe(4000);
  });
});
```

- [ ] **Step 4A.6.2: Run tests — expect failures**

```bash
npx vitest run lib/cards/video-poker/round.test.ts 2>&1 | tail -5
```

- [ ] **Step 4A.6.3: Implement `round.ts`**

```ts
// lib/cards/video-poker/round.ts
// Round state machine for video poker.
// Spec: docs/superpowers/specs/cards-video-poker-engine.md section 8 + ARCHITECTURE 15.6

import { type Card, type Hand, HandRank, Rank } from "./types";
import { createDeck, shuffle } from "./deck";
import type { SlotRng } from "./rng";
import { evaluateHand } from "./evaluate";
import { computePayout, type Paytable, DEUCES_PAYTABLE } from "./paytable";

export interface RoundStart {
  /** The 5-card initial hand dealt to the player. */
  hand: Hand;
  /** The remaining 47 cards (positions 5..51 of the shuffled deck). */
  remainingDeck: readonly Card[];
}

export interface RoundResult {
  /** The 5-card final hand after holds were resolved. */
  finalHand: Hand;
  /** Classification of the final hand. */
  handRank: HandRank;
  /** Credits awarded (already factors in bet and the 5-coin top-tier bonus). */
  payout: number;
}

/**
 * Start a new round: shuffle a fresh deck, deal 5 cards, return the initial hand
 * and the rest of the deck for use during the draw step.
 */
export function startRound(rng: SlotRng): RoundStart {
  const shuffled = shuffle(createDeck(), rng);
  const hand = shuffled.slice(0, 5) as unknown as Hand;
  const remainingDeck = shuffled.slice(5);
  return { hand, remainingDeck };
}

/**
 * Apply hold flags to the start of a round. Held cards stay; un-held cards
 * are replaced from the remaining deck (in order). The final hand is then
 * classified via the paytable's evaluator mode (wild for Deuces, standard otherwise),
 * and the payout is computed.
 */
export function applyHolds(
  start: { hand: Hand | readonly Card[]; remainingDeck: readonly Card[] },
  holds: readonly boolean[],
  paytable: Paytable,
  bet: number,
): RoundResult {
  if (holds.length !== 5) {
    throw new Error(`applyHolds: expected 5 hold flags (got ${holds.length})`);
  }

  const finalCards: Card[] = [];
  let drawCursor = 0;
  for (let i = 0; i < 5; i++) {
    if (holds[i]) {
      finalCards.push(start.hand[i]!);
    } else {
      const replacement = start.remainingDeck[drawCursor];
      if (replacement == null) {
        throw new Error(`applyHolds: not enough cards in remainingDeck (need ${5 - i}, have ${start.remainingDeck.length - drawCursor})`);
      }
      finalCards.push(replacement);
      drawCursor++;
    }
  }
  const finalHand = finalCards as unknown as Hand;

  // Wild mode iff this is the Deuces paytable; otherwise standard mode.
  const wildRank = paytable === DEUCES_PAYTABLE ? Rank.TWO : null;
  const handRank = evaluateHand(finalHand, { wildRank });
  const payout = computePayout(handRank, paytable, bet);

  return { finalHand, handRank, payout };
}
```

- [ ] **Step 4A.6.4: Run tests**

```bash
npx vitest run lib/cards/video-poker/round.test.ts 2>&1 | tail -5
```

Expected: ~6 tests pass.

### Task 4A.7: `credits.ts` (port of slot credits) with TDD

**Files:**
- Create: `lib/cards/video-poker/credits.ts`
- Create: `lib/cards/video-poker/credits.test.ts`

- [ ] **Step 4A.7.1: Port from slot pattern**

Read the slot file:

```bash
cat lib/slots/tideforge-pearls/credits.ts
```

Port to `lib/cards/video-poker/credits.ts`. Key adjustments:

1. The localStorage keys are parameterized by game slug — the module exports a factory or accepts slug as an argument. Recommended factory shape:

```ts
// lib/cards/video-poker/credits.ts
// Per-game localStorage helpers for video-poker credits and session stats.
// Spec: ARCHITECTURE Section 15.4

import { HandRank } from "./types";

export const DEFAULT_CREDITS = 1000;

export interface SessionStats {
  handsPlayed: number;
  totalWagered: number;
  totalWon: number;
  bestSingleWin: number;
  rankHits: Partial<Record<HandRank, number>>;
}

export const EMPTY_STATS: SessionStats = Object.freeze({
  handsPlayed: 0,
  totalWagered: 0,
  totalWon: 0,
  bestSingleWin: 0,
  rankHits: Object.freeze({}),
});

export function creditsKey(slug: string): string {
  return `cards:${slug}:credits`;
}

export function statsKey(slug: string): string {
  return `cards:${slug}:stats`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

export function loadCredits(slug: string): number {
  const s = getStorage();
  if (!s) return DEFAULT_CREDITS;
  try {
    const raw = s.getItem(creditsKey(slug));
    if (raw == null) return DEFAULT_CREDITS;
    return numberOr(JSON.parse(raw), DEFAULT_CREDITS);
  } catch {
    return DEFAULT_CREDITS;
  }
}

export function saveCredits(slug: string, credits: number): void {
  const s = getStorage();
  if (!s) return;
  try { s.setItem(creditsKey(slug), JSON.stringify(numberOr(credits, 0))); } catch { /* ignore */ }
}

export function loadStats(slug: string): SessionStats {
  const s = getStorage();
  if (!s) return { ...EMPTY_STATS, rankHits: {} };
  try {
    const raw = s.getItem(statsKey(slug));
    if (raw == null) return { ...EMPTY_STATS, rankHits: {} };
    const parsed = JSON.parse(raw) as Partial<SessionStats>;
    return {
      handsPlayed: numberOr(parsed.handsPlayed, 0),
      totalWagered: numberOr(parsed.totalWagered, 0),
      totalWon: numberOr(parsed.totalWon, 0),
      bestSingleWin: numberOr(parsed.bestSingleWin, 0),
      rankHits: (parsed.rankHits && typeof parsed.rankHits === "object")
        ? Object.fromEntries(
            Object.entries(parsed.rankHits).filter(([, v]) => typeof v === "number")
          ) as Partial<Record<HandRank, number>>
        : {},
    };
  } catch {
    return { ...EMPTY_STATS, rankHits: {} };
  }
}

export function saveStats(slug: string, stats: SessionStats): void {
  const s = getStorage();
  if (!s) return;
  try { s.setItem(statsKey(slug), JSON.stringify(stats)); } catch { /* ignore */ }
}

/** Pure: produce updated stats after a single hand. */
export function recordHand(prev: SessionStats, bet: number, payout: number, rank: HandRank): SessionStats {
  const rankHits = { ...prev.rankHits };
  rankHits[rank] = (rankHits[rank] ?? 0) + 1;
  return {
    handsPlayed: prev.handsPlayed + 1,
    totalWagered: prev.totalWagered + bet,
    totalWon: prev.totalWon + payout,
    bestSingleWin: Math.max(prev.bestSingleWin, payout),
    rankHits,
  };
}

export function resetCredits(slug: string): void {
  saveCredits(slug, DEFAULT_CREDITS);
}

export function resetStats(slug: string): void {
  saveStats(slug, { ...EMPTY_STATS, rankHits: {} });
}
```

- [ ] **Step 4A.7.2: Write tests using a MemStore shim (same pattern as slot tests)**

```ts
// lib/cards/video-poker/credits.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCredits, saveCredits, loadStats, saveStats, recordHand,
  resetCredits, resetStats, DEFAULT_CREDITS, EMPTY_STATS,
  creditsKey, statsKey,
} from "./credits";
import { HandRank } from "./types";

class MemStore implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
}

beforeEach(() => {
  // @ts-expect-error — set up a minimal `window.localStorage` for the module
  globalThis.window = { localStorage: new MemStore() };
});

describe("credits — keys", () => {
  it("creditsKey is namespaced per game slug", () => {
    expect(creditsKey("jacks-or-better")).toBe("cards:jacks-or-better:credits");
    expect(creditsKey("deuces-wild")).toBe("cards:deuces-wild:credits");
  });
  it("statsKey is namespaced per game slug", () => {
    expect(statsKey("jacks-or-better")).toBe("cards:jacks-or-better:stats");
  });
});

describe("credits — load/save round trip", () => {
  it("loadCredits returns DEFAULT_CREDITS when storage is empty", () => {
    expect(loadCredits("jacks-or-better")).toBe(DEFAULT_CREDITS);
  });
  it("saveCredits then loadCredits round-trips", () => {
    saveCredits("jacks-or-better", 1234);
    expect(loadCredits("jacks-or-better")).toBe(1234);
  });
  it("loadCredits guards against non-numeric values", () => {
    // @ts-expect-error
    globalThis.window.localStorage.setItem(creditsKey("jacks-or-better"), '"hello"');
    expect(loadCredits("jacks-or-better")).toBe(DEFAULT_CREDITS);
  });
  it("loadCredits floors fractional values", () => {
    saveCredits("jacks-or-better", 99.7);
    expect(loadCredits("jacks-or-better")).toBe(99);
  });
});

describe("credits — stats round trip", () => {
  it("loadStats returns EMPTY_STATS when storage is empty", () => {
    expect(loadStats("jacks-or-better")).toEqual({ ...EMPTY_STATS, rankHits: {} });
  });
  it("saveStats then loadStats round-trips", () => {
    const stats = {
      handsPlayed: 50,
      totalWagered: 250,
      totalWon: 200,
      bestSingleWin: 100,
      rankHits: { [HandRank.FLUSH]: 3, [HandRank.FULL_HOUSE]: 1 },
    };
    saveStats("jacks-or-better", stats);
    expect(loadStats("jacks-or-better")).toEqual(stats);
  });
});

describe("credits — recordHand", () => {
  it("increments counters and updates bestSingleWin", () => {
    const next = recordHand(EMPTY_STATS, 5, 25, HandRank.TWO_PAIR);
    expect(next.handsPlayed).toBe(1);
    expect(next.totalWagered).toBe(5);
    expect(next.totalWon).toBe(25);
    expect(next.bestSingleWin).toBe(25);
    expect(next.rankHits[HandRank.TWO_PAIR]).toBe(1);
  });
  it("preserves bestSingleWin when a smaller win lands", () => {
    const after100 = recordHand(EMPTY_STATS, 5, 100, HandRank.FOUR_OF_A_KIND);
    const after10 = recordHand(after100, 5, 10, HandRank.JACKS_OR_BETTER);
    expect(after10.bestSingleWin).toBe(100);
  });
});

describe("credits — reset", () => {
  it("resetCredits restores DEFAULT_CREDITS", () => {
    saveCredits("jacks-or-better", 1);
    resetCredits("jacks-or-better");
    expect(loadCredits("jacks-or-better")).toBe(DEFAULT_CREDITS);
  });
  it("resetStats restores EMPTY_STATS", () => {
    saveStats("jacks-or-better", { handsPlayed: 99, totalWagered: 99, totalWon: 99, bestSingleWin: 99, rankHits: {} });
    resetStats("jacks-or-better");
    expect(loadStats("jacks-or-better")).toEqual({ ...EMPTY_STATS, rankHits: {} });
  });
  it("reset of one game does not affect the other", () => {
    saveCredits("jacks-or-better", 100);
    saveCredits("deuces-wild", 200);
    resetCredits("jacks-or-better");
    expect(loadCredits("jacks-or-better")).toBe(DEFAULT_CREDITS);
    expect(loadCredits("deuces-wild")).toBe(200);
  });
});
```

- [ ] **Step 4A.7.3: Run tests**

```bash
npx vitest run lib/cards/video-poker/credits.test.ts 2>&1 | tail -5
```

Expected: ~14 tests pass.

### Task 4A.8: `index.ts` (barrel re-exports)

**Files:**
- Create: `lib/cards/video-poker/index.ts`

- [ ] **Step 4A.8.1: Write the barrel**

```ts
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
```

- [ ] **Step 4A.8.2: Verify the engine compiles and all tests pass**

```bash
npm run typecheck 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Expected: typecheck clean. Tests = baseline (142) + new from Phase 4A (~75 across all test files). Final test count ~217.

---

## Phase 4B — Jacks or Better client UI + Deploy 1 push

### Task 4B.1: Shared display components

**Files:**
- Create: `components/cards/card-face.tsx`
- Create: `components/cards/card-back.tsx`
- Create: `components/cards/card-row.tsx`
- Create: `components/cards/paytable-panel.tsx`
- Create: `components/cards/bet-selector.tsx`
- Create: `components/cards/hold-toggle.tsx`

These are pure presentation components. Each receives data via props and emits no side effects.

- [ ] **Step 4B.1.1: Write `card-face.tsx`**

```tsx
"use client";
// A single playing-card face rendered as inline SVG.
// Suit + rank only. No theming knobs — uses the parent's CSS context for colors.

import * as React from "react";
import { Suit, Rank, type Card } from "@/lib/cards/video-poker";
import { cn } from "@/lib/utils";

const RANK_LABEL: Record<Rank, string> = {
  [Rank.TWO]: "2", [Rank.THREE]: "3", [Rank.FOUR]: "4", [Rank.FIVE]: "5",
  [Rank.SIX]: "6", [Rank.SEVEN]: "7", [Rank.EIGHT]: "8", [Rank.NINE]: "9",
  [Rank.TEN]: "10", [Rank.JACK]: "J", [Rank.QUEEN]: "Q", [Rank.KING]: "K",
  [Rank.ACE]: "A",
};

const SUIT_GLYPH: Record<Suit, string> = {
  [Suit.SPADES]: "♠",
  [Suit.HEARTS]: "♥",
  [Suit.DIAMONDS]: "♦",
  [Suit.CLUBS]: "♣",
};

const SUIT_COLOR_CLASS: Record<Suit, string> = {
  [Suit.SPADES]: "text-[var(--card-suit-black)]",
  [Suit.HEARTS]: "text-[var(--card-suit-red)]",
  [Suit.DIAMONDS]: "text-[var(--card-suit-red)]",
  [Suit.CLUBS]: "text-[var(--card-suit-black)]",
};

export interface CardFaceProps {
  card: Card;
  highlight?: "hold" | "win" | "wild" | null;
  className?: string;
}

export function CardFace({ card, highlight, className }: CardFaceProps) {
  const rankLabel = RANK_LABEL[card.rank];
  const suitGlyph = SUIT_GLYPH[card.suit];
  const ariaLabel = `${rankLabel} of ${card.suit === Suit.SPADES ? "spades" : card.suit === Suit.HEARTS ? "hearts" : card.suit === Suit.DIAMONDS ? "diamonds" : "clubs"}`;
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "card-face relative aspect-[2/3] w-full rounded-md border bg-[var(--card-face-bg)]",
        "flex flex-col items-center justify-between p-2 sm:p-3 select-none",
        SUIT_COLOR_CLASS[card.suit],
        highlight === "hold" && "card-face-hold",
        highlight === "win" && "card-face-win",
        highlight === "wild" && "card-face-wild",
        className,
      )}
    >
      <div className="self-start font-display text-xl sm:text-2xl font-bold leading-none">
        {rankLabel}
      </div>
      <div className="text-3xl sm:text-5xl leading-none" aria-hidden="true">{suitGlyph}</div>
      <div className="self-end font-display text-xl sm:text-2xl font-bold leading-none rotate-180">
        {rankLabel}
      </div>
    </div>
  );
}
```

- [ ] **Step 4B.1.2: Write `card-back.tsx`**

```tsx
"use client";
// Face-down card back, used during card-flip animations.
import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardBackProps {
  className?: string;
  motif?: "classic" | "deuce";
}

export function CardBack({ className, motif = "classic" }: CardBackProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "card-back relative aspect-[2/3] w-full rounded-md border bg-[var(--card-back-bg)]",
        motif === "deuce" && "card-back-deuce",
        className,
      )}
    />
  );
}
```

- [ ] **Step 4B.1.3: Write `card-row.tsx`**

```tsx
"use client";
import * as React from "react";
import { CardFace } from "./card-face";
import { CardBack } from "./card-back";
import type { Card } from "@/lib/cards/video-poker";

export interface CardRowProps {
  cards: ReadonlyArray<Card | null>; // null = face-down (during deal animation)
  highlights?: ReadonlyArray<"hold" | "win" | "wild" | null>;
  motif?: "classic" | "deuce";
}

export function CardRow({ cards, highlights, motif }: CardRowProps) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {cards.map((card, i) => (
        <div key={i}>
          {card == null
            ? <CardBack motif={motif} />
            : <CardFace card={card} highlight={highlights?.[i] ?? null} />}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4B.1.4: Write `paytable-panel.tsx`**

```tsx
"use client";
import * as React from "react";
import { type Paytable, HAND_RANK_NAME, HandRank } from "@/lib/cards/video-poker";
import { cn } from "@/lib/utils";

export interface PaytablePanelProps {
  paytable: Paytable;
  /** Currently-active bet (1-5). All paytable rows scale to this bet for display. */
  bet: number;
  /** Top-tier rank (Royal Flush in JoB, Natural Royal Flush in Deuces) — gets the 5-coin bonus highlight. */
  topTierRank: HandRank;
  /** When non-null, this row glows (the player's last winning rank). */
  highlightRank: HandRank | null;
}

export function PaytablePanel({ paytable, bet, topTierRank, highlightRank }: PaytablePanelProps) {
  // Ordered list of paying ranks for this paytable, top-down (best to worst).
  const ROWS: HandRank[] = [
    HandRank.NATURAL_ROYAL_FLUSH,
    HandRank.WILD_ROYAL_FLUSH,
    HandRank.ROYAL_FLUSH,
    HandRank.FOUR_DEUCES,
    HandRank.FIVE_OF_A_KIND,
    HandRank.STRAIGHT_FLUSH,
    HandRank.FOUR_OF_A_KIND,
    HandRank.FULL_HOUSE,
    HandRank.FLUSH,
    HandRank.STRAIGHT,
    HandRank.THREE_OF_A_KIND,
    HandRank.TWO_PAIR,
    HandRank.JACKS_OR_BETTER,
  ];
  const visibleRows = ROWS.filter(r => paytable[r] > 0);

  return (
    <div className="paytable-panel rounded-md border border-[var(--paytable-border)] bg-[var(--paytable-bg)] p-3 sm:p-4">
      <table className="w-full text-xs sm:text-sm font-mono">
        <thead>
          <tr className="text-[var(--paytable-header-fg)]">
            <th className="text-left">hand</th>
            <th className="text-right">pay</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(rank => {
            const isTopAtMaxBet = rank === topTierRank && bet === 5;
            const payout = isTopAtMaxBet ? 4000 : paytable[rank] * bet;
            return (
              <tr
                key={rank}
                className={cn(
                  "paytable-row",
                  highlightRank === rank && "paytable-row-active",
                  isTopAtMaxBet && "paytable-row-bonus",
                )}
              >
                <td className="text-left py-0.5">{HAND_RANK_NAME[rank]}</td>
                <td className="text-right tabular-nums py-0.5">{payout}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4B.1.5: Write `bet-selector.tsx`**

```tsx
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface BetSelectorProps {
  bet: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

export function BetSelector({ bet, onChange, disabled }: BetSelectorProps) {
  return (
    <div role="group" aria-label="Bet per hand" className="flex items-center gap-1">
      <span className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono mr-2">bet:</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          disabled={disabled}
          aria-pressed={bet === n}
          className={cn(
            "h-8 w-8 rounded-sm border font-mono text-sm",
            bet === n ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]" : "border-[var(--color-line-strong)] hover:border-[var(--color-fg)]",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4B.1.6: Write `hold-toggle.tsx`**

```tsx
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface HoldToggleProps {
  held: boolean;
  onToggle: () => void;
  disabled?: boolean;
  position: number; // 1-5, for ARIA
}

export function HoldToggle({ held, onToggle, disabled, position }: HoldToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={held}
      aria-label={`${held ? "Release hold on" : "Hold"} card ${position}`}
      className={cn(
        "h-9 w-full rounded-sm border font-display text-xs uppercase tracking-wider",
        held ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]" : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {held ? "held" : "hold"}
    </button>
  );
}
```

- [ ] **Step 4B.1.7: Verify components typecheck**

```bash
npm run typecheck 2>&1 | tail -3
```

Expected: clean.

### Task 4B.2: CSS tokens + animations

**Files:**
- Modify: `app/globals.css` — append a new section at the end

- [ ] **Step 4B.2.1: Append the cards section**

Append this at the end of `app/globals.css`:

```css

/* ========================================================================
   Card Parlor (video poker)
   Spec: docs/superpowers/specs/2026-05-01-card-parlor-design.md section 2
   ========================================================================
*/

:root {
  /* Shared card visuals */
  --card-face-bg: #f3f0e6;
  --card-back-bg: #1a1f3a;
  --card-suit-red: #c1331a;
  --card-suit-black: #0a0b10;

  /* Paytable panel */
  --paytable-bg: #0a0b10;
  --paytable-border: #2a2f4a;
  --paytable-header-fg: #a3a191;
}

.card-face-hold {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.card-face-win {
  animation: card-win-flash 600ms ease-out;
}

.card-face-wild {
  animation: card-wild-pulse 1500ms ease-in-out infinite;
}

.card-back-deuce {
  background-image: radial-gradient(circle at 50% 50%, rgba(120, 200, 255, 0.4) 10%, transparent 30%);
}

.paytable-row {
  transition: background-color 250ms ease;
}

.paytable-row-active {
  background-color: rgba(212, 255, 58, 0.15);
}

.paytable-row-bonus {
  background-color: rgba(212, 255, 58, 0.25);
  font-weight: bold;
}

/* JoB cabinet palette */
.cabinet-job {
  --color-accent-cabinet: #e6c200;  /* gold */
  background:
    radial-gradient(circle at 20% -10%, rgba(193, 51, 26, 0.15), transparent 40%),
    radial-gradient(circle at 80% 110%, rgba(230, 194, 0, 0.1), transparent 50%),
    #0a0b10;
}

/* Deuces cabinet palette */
.cabinet-deuces {
  --color-accent-cabinet: #5fb3d4;  /* teal */
  background:
    radial-gradient(circle at 20% -10%, rgba(95, 179, 212, 0.15), transparent 40%),
    radial-gradient(circle at 80% 110%, rgba(192, 192, 192, 0.08), transparent 50%),
    #0a0b10;
}

@keyframes card-win-flash {
  0% { box-shadow: 0 0 0 0 rgba(212, 255, 58, 0); }
  50% { box-shadow: 0 0 12px 4px rgba(212, 255, 58, 0.7); }
  100% { box-shadow: 0 0 0 0 rgba(212, 255, 58, 0); }
}

@keyframes card-wild-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(120, 200, 255, 0); }
  50% { box-shadow: 0 0 8px 2px rgba(120, 200, 255, 0.4); }
}

@media (prefers-reduced-motion: reduce) {
  .card-face-win { animation: none; }
  .card-face-wild { animation: none; }
  .paytable-row { transition: none; }
}
```

### Task 4B.3: `/cards/` index page

**Files:**
- Create: `app/cards/page.tsx`

- [ ] **Step 4B.3.1: Write the index**

```tsx
// /cards — index of card parlor games.
import * as React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Card Parlor — Daily Arcade",
  description: "Play-money video poker. Two variants: Jacks or Better and Deuces Wild.",
};

export const dynamic = "force-static";

export default function CardsIndex() {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">card parlor</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
          video poker.
        </h1>
        <p className="text-base sm:text-lg text-[var(--color-fg-muted)] max-w-md">
          Five cards, hold what you want, draw the rest. Play money only — credits live in this browser, reset whenever.
          For today&#39;s puzzles, head <Link className="underline" href="/">home</Link>.
        </p>
      </header>

      <ul className="grid gap-3 sm:gap-4">
        <li>
          <Link
            href="/cards/jacks-or-better"
            className="group relative flex items-center justify-between gap-4 p-5 sm:p-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-line-strong)] transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">9/6 paytable</p>
              <h2 className="font-display font-semibold text-xl sm:text-2xl mt-1">
                Jacks <span className="text-[#e6c200]">or Better</span>
              </h2>
              <p className="text-sm text-[var(--color-fg-muted)] mt-1">
                The classic: pair of jacks pays, royal flush at max bet pays 4000.
              </p>
            </div>
            <span className="font-mono text-sm text-[var(--color-fg-dim)] group-hover:text-[var(--color-accent)]">
              play →
            </span>
          </Link>
        </li>

        <li>
          <div
            aria-disabled="true"
            className="opacity-70 flex items-center justify-between gap-4 p-5 sm:p-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-bg-elevated)]"
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">NSUD paytable · coming soon</p>
              <h2 className="font-display font-semibold text-xl sm:text-2xl mt-1">
                Deuces <span className="text-[var(--color-fg-dim)]">Wild</span>
              </h2>
              <p className="text-sm text-[var(--color-fg-muted)] mt-1">
                Four wild 2s, no pair pays, but five-of-a-kind and natural royals do.
              </p>
            </div>
            <span className="font-mono text-sm text-[var(--color-fg-dim)]">pending</span>
          </div>
        </li>
      </ul>

      <p className="text-xs text-[var(--color-fg-dim)] font-mono pt-4">
        play money only. credits live in this browser, reset whenever you want, and never sync, share, or rank.
      </p>
    </section>
  );
}
```

### Task 4B.4: JoB game route — server wrapper

**Files:**
- Create: `app/cards/jacks-or-better/page.tsx`

- [ ] **Step 4B.4.1: Write the server wrapper**

```tsx
// /cards/jacks-or-better — server wrapper.
import * as React from "react";
import type { Metadata } from "next";
import { JacksOrBetterClient } from "./jacks-or-better-client";

export const metadata: Metadata = {
  title: "Jacks or Better — Card Parlor — Daily Arcade",
  description: "9/6 Jacks or Better video poker, play money only.",
};

export const dynamic = "force-static";

export default function JacksOrBetterPage() {
  return <JacksOrBetterClient />;
}
```

### Task 4B.5: JoB client island (the load-bearing UI)

**Files:**
- Create: `app/cards/jacks-or-better/jacks-or-better-client.tsx`

- [ ] **Step 4B.5.1: Write the client island**

```tsx
"use client";
import * as React from "react";
import {
  startRound, applyHolds, createCryptoRng,
  JOB_PAYTABLE, HandRank, HAND_RANK_NAME,
  loadCredits, saveCredits, loadStats, saveStats, recordHand, resetCredits, resetStats,
  DEFAULT_CREDITS, EMPTY_STATS,
  type Card, type Hand, type RoundStart, type SessionStats,
} from "@/lib/cards/video-poker";
import { CardRow } from "@/components/cards/card-row";
import { PaytablePanel } from "@/components/cards/paytable-panel";
import { BetSelector } from "@/components/cards/bet-selector";
import { HoldToggle } from "@/components/cards/hold-toggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const SLUG = "jacks-or-better";
const CABINET_CLASS = "cabinet-job";

type Phase = "idle" | "dealt" | "drawn";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

export function JacksOrBetterClient() {
  const { push } = useToast();
  const [credits, setCredits] = React.useState<number>(DEFAULT_CREDITS);
  const [stats, setStats] = React.useState<SessionStats>(() => ({ ...EMPTY_STATS, rankHits: {} }));
  const [bet, setBet] = React.useState<number>(5);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [round, setRound] = React.useState<RoundStart | null>(null);
  const [holds, setHolds] = React.useState<readonly boolean[]>([false, false, false, false, false]);
  const [finalHand, setFinalHand] = React.useState<Hand | null>(null);
  const [lastRank, setLastRank] = React.useState<HandRank | null>(null);
  const [lastWin, setLastWin] = React.useState<number>(0);
  const reduced = React.useMemo(prefersReducedMotion, []);

  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    setCredits(loadCredits(SLUG));
    setStats(loadStats(SLUG));
  }, []);

  // Persist credits / stats.
  React.useEffect(() => { saveCredits(SLUG, credits); }, [credits]);
  React.useEffect(() => { saveStats(SLUG, stats); }, [stats]);

  const canDeal = phase !== "dealt" && credits >= bet;
  const canDraw = phase === "dealt";

  function deal() {
    if (!canDeal) return;
    setCredits(c => c - bet);
    const r = startRound(createCryptoRng());
    setRound(r);
    setHolds([false, false, false, false, false]);
    setFinalHand(null);
    setLastRank(null);
    setLastWin(0);
    setPhase("dealt");
  }

  function toggleHold(i: number) {
    if (phase !== "dealt") return;
    setHolds(prev => prev.map((h, idx) => idx === i ? !h : h));
  }

  function draw() {
    if (!canDraw || !round) return;
    const result = applyHolds(round, holds, JOB_PAYTABLE, bet);
    setFinalHand(result.finalHand);
    setLastRank(result.handRank);
    setLastWin(result.payout);
    setCredits(c => c + result.payout);
    setStats(s => recordHand(s, bet, result.payout, result.handRank));
    setPhase("drawn");
  }

  function performReset() {
    if (!confirm("Reset balance to 1000? No real money here — credits are play-money entertainment only.")) return;
    resetCredits(SLUG);
    resetStats(SLUG);
    setCredits(DEFAULT_CREDITS);
    setStats({ ...EMPTY_STATS, rankHits: {} });
    setPhase("idle");
    setRound(null);
    setFinalHand(null);
    setLastRank(null);
    setLastWin(0);
    push("Balance reset to 1000.", "info");
  }

  // Display hand: dealt cards before draw; final hand after.
  const displayCards: ReadonlyArray<Card | null> =
    phase === "drawn" && finalHand
      ? finalHand
      : round
        ? round.hand
        : [null, null, null, null, null];

  const displayHighlights = displayCards.map((_, i): "hold" | "win" | null => {
    if (phase === "drawn" && lastRank != null && lastRank !== HandRank.NONE) return "win";
    if (phase === "dealt" && holds[i]) return "hold";
    return null;
  });

  const primaryButtonLabel = phase === "dealt" ? "Draw" : "Deal";
  const primaryButtonAction = phase === "dealt" ? draw : deal;
  const primaryButtonDisabled = phase === "dealt" ? false : !canDeal;

  return (
    <section className={cn("space-y-5 rounded-[var(--radius-lg)] p-4 sm:p-6", CABINET_CLASS)}>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">card parlor · video poker</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
          Jacks <span className="text-[#e6c200]">or Better</span>
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          9/6 paytable. Play money — no real currency, no leaderboard. Five cards, hold what you want, draw the rest.
        </p>
      </header>

      <PaytablePanel
        paytable={JOB_PAYTABLE}
        bet={bet}
        topTierRank={HandRank.ROYAL_FLUSH}
        highlightRank={lastRank ?? null}
      />

      <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm font-mono">
        <div className="rounded-sm border border-[var(--color-line)] p-2 sm:p-3">
          <span className="block text-[10px] uppercase tracking-widest text-[var(--color-fg-dim)]">balance</span>
          <span className="block text-lg sm:text-xl tabular-nums text-[var(--color-fg)]">{credits}</span>
        </div>
        <div className="rounded-sm border border-[var(--color-line)] p-2 sm:p-3">
          <span className="block text-[10px] uppercase tracking-widest text-[var(--color-fg-dim)]">bet</span>
          <span className="block text-lg sm:text-xl tabular-nums text-[var(--color-fg)]">{bet}</span>
        </div>
        <div className="rounded-sm border border-[var(--color-line)] p-2 sm:p-3">
          <span className="block text-[10px] uppercase tracking-widest text-[var(--color-fg-dim)]">last win</span>
          <span className="block text-lg sm:text-xl tabular-nums text-[var(--color-accent)]">
            {phase === "drawn" ? `+${lastWin}` : "—"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <CardRow cards={displayCards} highlights={displayHighlights} motif="classic" />
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {[0, 1, 2, 3, 4].map(i => (
            <HoldToggle
              key={i}
              held={holds[i] ?? false}
              onToggle={() => toggleHold(i)}
              disabled={phase !== "dealt"}
              position={i + 1}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <BetSelector bet={bet} onChange={setBet} disabled={phase === "dealt"} />
        <Button onClick={primaryButtonAction} disabled={primaryButtonDisabled}>
          {primaryButtonLabel}
        </Button>
        {credits < bet && phase !== "dealt" && (
          <span className="text-xs text-[var(--color-fg-muted)]">Out of credits — reset balance below.</span>
        )}
      </div>

      <details className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-elevated)] p-3 sm:p-4">
        <summary className="cursor-pointer text-sm font-mono text-[var(--color-fg-muted)]">session stats</summary>
        <dl className="grid grid-cols-2 gap-3 mt-3 text-xs sm:text-sm font-mono tabular-nums">
          <div><dt className="text-[var(--color-fg-dim)]">hands played</dt><dd>{stats.handsPlayed}</dd></div>
          <div><dt className="text-[var(--color-fg-dim)]">total wagered</dt><dd>{stats.totalWagered}</dd></div>
          <div><dt className="text-[var(--color-fg-dim)]">total won</dt><dd>{stats.totalWon}</dd></div>
          <div><dt className="text-[var(--color-fg-dim)]">net</dt><dd className={cn(stats.totalWon - stats.totalWagered >= 0 ? "text-[var(--color-accent)]" : "text-[var(--card-suit-red)]")}>{stats.totalWon - stats.totalWagered}</dd></div>
          <div className="col-span-2"><dt className="text-[var(--color-fg-dim)]">best single win</dt><dd>{stats.bestSingleWin}</dd></div>
        </dl>
        <div className="mt-3">
          <Button onClick={performReset} variant="outline">Reset balance</Button>
        </div>
      </details>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {phase === "drawn" && lastRank != null && (
          lastRank === HandRank.NONE
            ? "No win this hand."
            : `${HAND_RANK_NAME[lastRank]} — you win ${lastWin} credits.`
        )}
      </div>

      <p className="text-xs text-[var(--color-fg-dim)] font-mono pt-2">
        <a className="underline" href="/cards">← card parlor</a> · <a className="underline" href="/">today&#39;s puzzles</a>
      </p>
    </section>
  );
}
```

- [ ] **Step 4B.5.2: Verify typecheck and tests still green**

```bash
npm run typecheck 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Expected: typecheck clean. Test count unchanged from end of Phase 4A.

- [ ] **Step 4B.5.3: Production build clean**

```bash
npm run build 2>&1 | tail -15
```

Expected: build succeeds; `/cards` and `/cards/jacks-or-better` listed (likely as static `○`). If `force-static` causes any issue (e.g., due to localStorage hydration), the routes may fall back to dynamic — that's acceptable.

### Task 4B.6: Footer link in arcade-shell

**Files:**
- Modify: `components/arcade-shell.tsx` — add second footer link

- [ ] **Step 4B.6.1: Find the existing footer block and add the cards link**

Current footer (around line 40):

```tsx
            <Link href="/slots" className="hover:text-[var(--color-fg)]">arcade lounge</Link>
            <Link href="/about" className="hover:text-[var(--color-fg)]">about</Link>
```

Replace with:

```tsx
            <Link href="/slots" className="hover:text-[var(--color-fg)]">arcade lounge</Link>
            <Link href="/cards" className="hover:text-[var(--color-fg)]">card parlor</Link>
            <Link href="/about" className="hover:text-[var(--color-fg)]">about</Link>
```

If the existing layout has them in a `gap-X` flex/inline span, the new link inherits the same spacing.

- [ ] **Step 4B.6.2: Verify footer doesn't break visually**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build.

### Task 4B.7: Stage Deploy 1 (Phase 2 + 3 + 4A + 4B)

- [ ] **Step 4B.7.1: Run the full predeploy gate**

```bash
npm run predeploy 2>&1 | tail -10
```

Expected: typecheck clean, lint clean, all tests pass, build clean, bundle-check clean.

- [ ] **Step 4B.7.2: Stage Deploy 1**

```bash
git status -s
git add DECISIONS.md ARCHITECTURE.md \
        docs/superpowers/specs/cards-video-poker-engine.md \
        lib/cards/ \
        app/cards/ \
        components/cards/ \
        components/arcade-shell.tsx \
        app/globals.css
git diff --cached --name-only
```

Verify the staged list includes only the cards-related files (plus the unchanged DECISIONS/ARCH/globals/shell). NOT the slot files.

- [ ] **Step 4B.7.3: Commit Deploy 1**

```bash
git commit -m "$(cat <<'EOF'
cards: ship Jacks or Better + foundation (Phase 2 + 3 + 4A + 4B)

The first deploy of the card parlor. Lands the integration ADRs C1-C6
+ ARCHITECTURE Section 15, the math design spec for the video-poker
engine, the shared engine implementation with full TDD coverage,
the JoB client UI, and the second discreet footer link.

Phase 2 — DECISIONS + ARCHITECTURE:
- Six ADRs C1-C6 mirror the slot ADRs S1-S6 (own section /cards/, no
  streak impact, no leaderboard/submit/Turnstile/OG/DB, localStorage
  credits, no daily-seed integration, sequential ship cycles)
- ARCHITECTURE Section 15 (Card Parlor subsystem)

Phase 3 — math spec:
- docs/superpowers/specs/cards-video-poker-engine.md
- Locked 9/6 JoB paytable and NSUD Deuces paytable values
- 50+ golden-vector test plan for the hand evaluator
- Shuffle uniformity test approach

Phase 4A — shared engine:
- lib/cards/video-poker/{types,rng,deck,evaluate,paytable,round,credits,index}.ts
- 7 test files, ~75 new tests
- Hand evaluator handles standard mode (JoB) and wild mode (Deuces)
  including Ace-low straight detection, Wild Royal vs Natural Royal
  split, Five of a Kind detection, and demotion of pairs/two-pair in
  wild mode
- RNG ported from the slot SlotRng pattern (intentional duplication
  per ARCHITECTURE 15.5)

Phase 4B — Jacks or Better UI:
- /cards index page (JoB live, Deuces "coming soon")
- /cards/jacks-or-better game route + client island
- Six shared display components under components/cards/
- Tideforge-pattern client (state machine, ARIA-live, reduced-motion,
  reset confirmation, session stats)
- "card parlor" footer link added to arcade-shell

Test count: 142 -> 217. Production build clean.

Spec: docs/superpowers/specs/2026-05-01-card-parlor-design.md
Plan: docs/superpowers/plans/2026-05-01-card-parlor.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4B.7.4: Push Deploy 1**

```bash
git push origin main
```

- [ ] **Step 4B.7.5: Poll for deploy + smoke (background)**

Use the same polling pattern from prior deploys. Background command:

```bash
SITE_ID="6a9b822d-6fa1-47df-bfd8-aa5fab4dbe18"
PREV=$(netlify api listSiteDeploys --data="{\"site_id\":\"$SITE_ID\",\"query\":{\"per_page\":1}}" 2>/dev/null | grep -m1 '"id"' | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
# Note: PREV captured here is the deploy BEFORE the push — check git log to confirm
while true; do
  JSON=$(netlify api listSiteDeploys --data="{\"site_id\":\"$SITE_ID\",\"query\":{\"per_page\":1}}" 2>/dev/null)
  ID=$(echo "$JSON" | grep -m1 '"id"' | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
  STATE=$(echo "$JSON" | grep -m1 '"state"' | sed -E 's/.*"state":[[:space:]]*"([^"]+)".*/\1/')
  echo "[$(date +%T)] id=$ID state=$STATE"
  if [ "$ID" != "$PREV" ]; then
    case "$STATE" in ready|error|failed|cancelled) echo "FINAL: $STATE deploy=$ID"; break ;; esac
  fi
  sleep 25
done
echo "=== smoke ==="
curl -s -o /dev/null -w "/: %{http_code}\n" https://daily-arcade.netlify.app/
curl -s -o /dev/null -w "/cards: %{http_code}\n" https://daily-arcade.netlify.app/cards
curl -s -o /dev/null -w "/cards/jacks-or-better: %{http_code}\n" https://daily-arcade.netlify.app/cards/jacks-or-better
curl -s -o /dev/null -w "/slots/tideforge-pearls (regression): %{http_code}\n" https://daily-arcade.netlify.app/slots/tideforge-pearls
```

Expected: all 200 except the deploy-state line(s) before terminal.

---

## Phase 5 — Deuces Wild client UI + Deploy 2

The shared engine + paytable for Deuces is already shipped in Deploy 1. Phase 5 adds only the variant client wrapper and updates the index card.

### Task 5.1: Deuces server wrapper

**Files:**
- Create: `app/cards/deuces-wild/page.tsx`

- [ ] **Step 5.1.1: Write the wrapper**

```tsx
import * as React from "react";
import type { Metadata } from "next";
import { DeucesWildClient } from "./deuces-wild-client";

export const metadata: Metadata = {
  title: "Deuces Wild — Card Parlor — Daily Arcade",
  description: "NSUD Deuces Wild video poker, play money only.",
};

export const dynamic = "force-static";

export default function DeucesWildPage() {
  return <DeucesWildClient />;
}
```

### Task 5.2: Deuces client island

**Files:**
- Create: `app/cards/deuces-wild/deuces-wild-client.tsx`

The Deuces client is structurally identical to JoB except for: paytable, slug, cabinet class, deuce highlighting, copy. Refactor opportunities exist (extract a shared hook), but for two consumers YAGNI says copy.

- [ ] **Step 5.2.1: Write the Deuces client**

Copy `app/cards/jacks-or-better/jacks-or-better-client.tsx` to the new path. Apply these changes verbatim:

- Rename function: `JacksOrBetterClient` → `DeucesWildClient`
- `const SLUG = "jacks-or-better"` → `const SLUG = "deuces-wild"`
- `const CABINET_CLASS = "cabinet-job"` → `const CABINET_CLASS = "cabinet-deuces"`
- All imports: replace `JOB_PAYTABLE` with `DEUCES_PAYTABLE`, replace `HandRank.ROYAL_FLUSH` (passed as `topTierRank`) with `HandRank.NATURAL_ROYAL_FLUSH`
- `import { Rank } from ...` — add Rank to the imports
- In the display-highlights map, add a "wild" highlight for cards where `card.rank === Rank.TWO`:
  ```tsx
  const displayHighlights = displayCards.map((card, i): "hold" | "win" | "wild" | null => {
    if (phase === "drawn" && lastRank != null && lastRank !== HandRank.NONE) return "win";
    if (card != null && card.rank === Rank.TWO) return "wild";
    if (phase === "dealt" && holds[i]) return "hold";
    return null;
  });
  ```
- `motif="classic"` on `<CardRow>` → `motif="deuce"`
- Header title: `Jacks or Better` → `Deuces Wild`, accent color `#e6c200` → `#5fb3d4`
- Cabinet kicker: `9/6 paytable` → `NSUD paytable`
- Cabinet body copy: `9/6 paytable. Play money — no real currency...` → `NSUD paytable. The four 2s are wild — they substitute for any rank or suit. Pairs do not pay; minimum win is three of a kind.`
- Pass `paytable={DEUCES_PAYTABLE}` and `topTierRank={HandRank.NATURAL_ROYAL_FLUSH}` to `<PaytablePanel>`

### Task 5.3: Update `/cards/` index — flip Deuces from "Coming Soon" to live

**Files:**
- Modify: `app/cards/page.tsx`

- [ ] **Step 5.3.1: Replace the Deuces "Coming Soon" card with a live link**

Find the existing `<li>` containing the disabled Deuces card and replace it with:

```tsx
        <li>
          <Link
            href="/cards/deuces-wild"
            className="group relative flex items-center justify-between gap-4 p-5 sm:p-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-line-strong)] transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">NSUD paytable</p>
              <h2 className="font-display font-semibold text-xl sm:text-2xl mt-1">
                Deuces <span className="text-[#5fb3d4]">Wild</span>
              </h2>
              <p className="text-sm text-[var(--color-fg-muted)] mt-1">
                Four wild 2s, no pair pays, but five-of-a-kind and natural royals do.
              </p>
            </div>
            <span className="font-mono text-sm text-[var(--color-fg-dim)] group-hover:text-[var(--color-accent)]">
              play →
            </span>
          </Link>
        </li>
```

### Task 5.4: Stage and ship Deploy 2

- [ ] **Step 5.4.1: Verify gate**

```bash
npm run predeploy 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 5.4.2: Stage Deploy 2 files**

```bash
git status -s
git add app/cards/deuces-wild/ app/cards/page.tsx
git diff --cached --name-only
```

Expected: 3 paths.

- [ ] **Step 5.4.3: Commit Deploy 2**

```bash
git commit -m "$(cat <<'EOF'
cards: ship Deuces Wild + flip index card live (Phase 5)

Adds the Deuces Wild client UI on top of the engine shipped in
Deploy 1. The /cards index card flips from "Coming Soon" to a
live link to /cards/deuces-wild.

Differences from Jacks or Better client:
- DEUCES_PAYTABLE, NATURAL_ROYAL_FLUSH as the top-tier (5-coin bonus)
- cabinet-deuces palette (blue/teal/silver) replacing cabinet-job
- "wild" highlight on any dealt 2 (subtle pulse animation)
- Copy explains the no-pair-pays rule
- card-back-deuce motif on face-down cards

Same engine, same paytable mechanics, different paytable values
and visual identity.

Plan: docs/superpowers/plans/2026-05-01-card-parlor.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5.4.4: Push Deploy 2**

```bash
git push origin main
```

- [ ] **Step 5.4.5: Poll + smoke**

Same pattern as Deploy 1, but smoke `/cards/deuces-wild` 200.

---

## Phase 6 — Docs delta + Deploy 3

### Task 6.1: RUNBOOK update

**Files:**
- Modify: `RUNBOOK.md`

- [ ] **Step 6.1.1: Append a Card Parlor section**

After the existing "Content sources" section (or wherever feature-specific subsystems are listed), append:

```markdown

## Card Parlor (`/cards/...`)

Two video-poker variants live under `/cards/`: 9/6 Jacks or Better
and NSUD Deuces Wild. Both are play-money entertainment with no
server-side surface (no Server Actions, no DB, no Turnstile, no OG).
Per-game credit balance and session stats live in localStorage at
`cards:<slug>:credits` and `cards:<slug>:stats` (default 1000 credits).

### Live URLs
- Index: https://daily-arcade.netlify.app/cards
- Jacks or Better: https://daily-arcade.netlify.app/cards/jacks-or-better
- Deuces Wild: https://daily-arcade.netlify.app/cards/deuces-wild

### Math reference
- Spec: `docs/superpowers/specs/2026-05-01-card-parlor-design.md` (design)
- Spec: `docs/superpowers/specs/cards-video-poker-engine.md` (locked paytables + golden vectors)
- ADRs C1-C6 in `DECISIONS.md` (2026-05-01)
- Architecture: `ARCHITECTURE.md` Section 15

### Adjusting paytables
The paytables in `lib/cards/video-poker/paytable.ts` are locked
constants. Edits MUST be cross-checked against the canonical Wizard
of Odds reference and the transcription tests in `paytable.test.ts`
will need to be updated to match.
```

### Task 6.2: README update

**Files:**
- Modify: `README.md`

- [ ] **Step 6.2.1: Add a brief mention of the card parlor**

Find the existing "Games" or "Sections" list in README.md. Add card parlor as a sibling to the slots section. Example wording:

```markdown
- **Card Parlor** (`/cards/`) — play-money video poker. Jacks or Better and Deuces Wild.
```

### Task 6.3: Stage and ship Deploy 3

- [ ] **Step 6.3.1: Stage**

```bash
git add RUNBOOK.md README.md
git diff --cached --name-only
```

- [ ] **Step 6.3.2: Commit and push**

```bash
git commit -m "$(cat <<'EOF'
docs: add Card Parlor to RUNBOOK and README

Closes the docs delta for the card parlor build. RUNBOOK now
documents the live URLs, math references, and the paytable
adjustment procedure. README mentions the new section alongside
the slot lounge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 6.3.3: Poll + verify**

Background poll. Smoke just the home page (regression check) and one card route after deploy lands.

---

## Self-review

**1. Spec coverage:**

| Spec section | Plan task |
|---|---|
| Routes `/cards/`, `/cards/jacks-or-better`, `/cards/deuces-wild` | 4B.3, 4B.4, 5.1 |
| Discreet footer link "card parlor" | 4B.6 |
| Visual identity, JoB red/gold + Deuces blue/teal | 4B.2 (CSS), 4B.5 (cabinet class), 5.2 |
| Card flip + held glow + paytable highlight + win counter, all reduced-motion gated | 4B.2 (animations) + 4B.5 (timing logic deferred to client implementation) |
| Original CSS+SVG only | 4B.1 (card-face uses inline SVG-style markup with CSS, no external assets) |
| ADRs C1–C6 | 2.1 |
| ARCHITECTURE Section 15 | 2.2 |
| Engine modules: types, rng, deck, evaluate, paytable, round, credits, index | 4A.1–4A.8 |
| Standard hand evaluator (10 ranks) | 4A.4 |
| Wild hand evaluator with Wild/Natural Royal split, Five of a Kind, Four Deuces | 4A.4 |
| 9/6 JoB paytable, NSUD Deuces paytable | 4A.5 (transcription) + 3.1 (canonical-reference verification) |
| Bet selector 1-5 with Royal Flush bonus at 5 coins | 4B.1.5 (selector), 4A.5 (computePayout bonus rule) |
| localStorage per game with credits + stats + reset | 4A.7 (engine) + 4B.5 (UI integration) |
| 50+ golden vectors | 4A.4 + 3.1 (math spec captures all 50+ in Phase 3 doc) |
| Deck shuffle uniformity test | 4A.3.1 (one chi-square test in deck.test.ts) |
| Paytable transcription tests | 4A.5.2 |
| ADR-C6 sequential ship cycles (Deploy 1 + 2 + 3) | 4B.7, 5.4, 6.3 |
| RUNBOOK + README updates | 6.1, 6.2 |
| 142-test baseline holds | every gate step asserts test count |
| Production build clean | 4B.5.3 + each deploy gate |

All success criteria from the spec map to tasks. The math spec (Phase 3) defers the per-row paytable values' canonical-reference verification to the implementer; this is by design — the implementer has web research capability and the canonical Wizard of Odds reference is publicly indexed.

**2. Placeholder scan:** Searched for "TBD", "TODO", "fill in", "etc.". None present. Every task has either a complete code block, a complete command, or a precise file edit instruction.

**3. Type consistency:** `SlotRng` interface is used identically across `rng.ts`, `deck.ts`, `round.ts`. `HandRank` enum values consistent across `types.ts`, `paytable.ts`, `evaluate.ts`, `round.ts`, `credits.ts`. `Card` and `Hand` types consistent. `Paytable` type aliased once in `paytable.ts` and consumed everywhere. The `applyHolds` first arg accepts `{ hand: Hand | readonly Card[]; remainingDeck: readonly Card[] }` which matches `RoundStart` plus the test's manually-constructed Royal Flush fixture.

If you find issues, fix inline. No re-review needed.

---

## Deferred / Out of scope

- Optimal-play strategy hint engine (32-pattern table for JoB, ~50-pattern for Deuces) — informational only; not shipped
- Five-of-a-kind / four-deuces / royal-flush celebration animations — could add in a later polish pass
- Per-game session-history log (last 10 hands list) — could add in a later polish pass
- Cross-device credit sync — depends on PostgresStore (still gated)
- Other video-poker variants (Bonus Poker, Double Bonus, Joker Wild) — easy additions on top of the same engine if/when wanted
