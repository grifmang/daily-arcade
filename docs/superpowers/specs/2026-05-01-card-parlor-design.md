# Card Parlor — Design

**Date:** 2026-05-01
**Author:** Brainstorming session (Claude with grifmang)
**Status:** Approved by user, awaiting spec review
**Live site:** https://daily-arcade.netlify.app/

## Context

Daily-arcade currently hosts three daily-seeded puzzles plus one slot machine (Tideforge Pearls, shipped earlier today). The user wants to add casino card games next, with a heavy emphasis on visuals that read as a slot-machine cabinet. Among casino card games, **video poker** is the only one whose native form lives inside a slot cabinet — paytable on top, 5-card display, hold buttons under each card, big DEAL/DRAW button. That makes it the natural fit for the user's stated aesthetic mandate.

Two video-poker variants ship together because they share roughly 90% of their engine: a deck shuffler, a hand evaluator, a paytable applier, and a round state machine. Only the paytable values and the wild-card rules differ between **Jacks or Better** and **Deuces Wild**. Building both as one effort is materially cheaper than building either alone.

## Scope

**In:**
- A new section **`/cards/`** with two playable games
- **Jacks or Better** at `/cards/jacks-or-better` using the 9/6 paytable (~99.54% RTP under optimal play)
- **Deuces Wild** at `/cards/deuces-wild` using the NSUD paytable (~99.73% RTP under optimal play)
- A `/cards/` index page mirroring `/slots/` in structure
- A second discreet footer link **"card parlor"** in the existing arcade shell
- Original "Vegas video poker cabinet" visual identity, with light differentiation between the two games

**Out (with rationale):**

| Item | Why deferred |
|---|---|
| Optimal-play strategy hint overlay | Personal-entertainment scope; player picks holds however they like. The published RTP figures assume optimal play, so without the hint the empirical RTP will run lower — informational only |
| Other casino card games (Blackjack, Baccarat, Three Card Poker) | Out of scope for this build; user explicitly chose video-poker variants |
| Daily solitaires (Klondike, FreeCell, Spider) | User explicitly steered away from solitaires earlier in the brainstorm |
| Trick-taking games with AI (Hearts, Spades) | High build effort; not on the table |
| Multiplayer card games | Doesn't fit the no-auth/no-DB rails |
| Branded cabinet imagery | Original visuals only; no commercial cabinet art reproduction |
| Real-money framing or affordances | Play-money entertainment only |

## Section 1 — Routing and navigation

### Routes
- **`/cards/`** — index page, two cards (one per game)
- **`/cards/jacks-or-better`** — JoB game route
- **`/cards/deuces-wild`** — Deuces Wild game route

Both game routes are server-prerendered statics with a `"use client"` island for the actual gameplay.

### Navigation
The existing arcade shell footer carries one link today (`arcade lounge` → `/slots`). A second discreet footer link is added: **`card parlor` → `/cards`**. Both links sit alongside the existing `about` link, with the same lowercase-mono styling.

The home page card grid stays unchanged. Daily-arcade's home is "today's three puzzles." The slot lounge and the card parlor are sibling secondary destinations reached only via the footer.

## Section 2 — Visual identity

The aesthetic mandate is "exactly like a slot machine would look." That maps onto a generic Vegas video-poker cabinet vocabulary:

### Shared layout (both games)
- **Top:** lit paytable panel, 11 rows (10 for JoB), each row showing the hand name and per-coin payout. The current matching paytable row highlights live during play — when a final hand evaluates to "Two Pair," the Two Pair row glows.
- **Middle:** 5 card faces in a row, dealt face-down at the start of each round and flipped face-up after deal. Held cards display a steady accent border and a HELD label.
- **Below cards:** a row of 5 HOLD buttons, one per card position, that toggle hold state during the holding phase.
- **Bottom row:** credits counter, bet selector (1–5 coins), last-win panel, and the primary action button (DEAL on round start, DRAW after holds locked).

### Differentiation
The two games share the layout but use different palettes and motifs so they don't feel like reskins:
- **Jacks or Better** — red, black, and gold. Art-deco paytable header rules. Standard 4-suit deck imagery (♠♥♦♣).
- **Deuces Wild** — blue, teal, and silver. The four 2s are the visual hero: card backs feature a glowing 2 motif, and any 2 dealt to the 5-card display gets a subtle pulse animation to remind the player it's wild.

### Animation
- **Card flip** on deal (face-down → face-up over ~250ms) and on draw (replacement card slides in over ~200ms).
- **Held card glow** — steady accent border, no animation.
- **Paytable row highlight** on win — fade-in over ~150ms, holds for the win-display duration.
- **Win counter roll** — credits counter ticks up to the new total when a win lands.
- **`prefers-reduced-motion: reduce`** — every animation collapses to instant reveal. No fades, no slides, no rolls. Both the JS timer paths and the CSS keyframes neutralize, mirroring the pattern Tideforge Pearls uses.

### Assets
All visuals are CSS + inline SVG. No external image assets. No commercial cabinet imagery. Card faces are stylized but standard (suit + rank), drawn as inline SVG components.

## Section 3 — Integration ADRs (C1–C6)

These mirror the slot integration ADRs (S1–S6) that govern the Tideforge subsystem.

### ADR-C1 — Card games live under `/cards/<slug>`, separate from `/slots/`
The user explicitly chose a separate section over folding video poker into `/slots/`. The home grid stays unchanged. A second discreet footer link "card parlor" provides the only nav into `/cards/`.

### ADR-C2 — No streak impact
Card games are off-streak entertainment, exactly like slots. The streak counter remains a daily-puzzle-exclusive primitive.

### ADR-C3 — No leaderboard, no submit, no Turnstile, no OG
No new Server Actions. No DB writes. No Turnstile invocations. No OG image routes for card games. The server-side surface stays unchanged.

### ADR-C4 — Play-money credits in localStorage, per game
- `cards:jacks-or-better:credits` (default 1000)
- `cards:jacks-or-better:stats` (cumulative session stats)
- `cards:deuces-wild:credits` (default 1000)
- `cards:deuces-wild:stats` (cumulative session stats)

Each game has its own credit balance and reset button. localStorage is editable in DevTools; risk-accepted because there's no gated content. No real-money framing in copy ("credits," not "dollars" or "coins"; reset confirmation explicitly says "no real money here").

### ADR-C5 — No daily-seed integration
Per-hand `crypto.getRandomValues` RNG, fresh per hand. The daily seed engine remains daily-puzzle-exclusive. Card games and slot games are both unlimited-play entertainment with non-deterministic outcomes.

### ADR-C6 — Sequential ship cycles
Jacks or Better ships first, in its own commit and auto-deploy. Deuces Wild follows in its own commit, layering the wild-card logic and Deuces paytable onto the proven engine. Two separate deploys — each independently revertable.

## Section 4 — Engine architecture

A shared pure-logic module at `lib/cards/video-poker/` powers both games. Server-safe (no React, no DOM, no Node-only imports), small enough to ship in the client bundle for both routes without duplication.

### Module shape
- **`types.ts`** — `Card`, `Suit`, `Rank`, `Hand`, `HandRank` enums and types
- **`deck.ts`** — `createDeck()` returns a 52-card array; `shuffle(deck, rng)` Fisher-Yates against a `SlotRng` interface (reusing the contract from Tideforge — same `crypto.getRandomValues` runtime, same xoshiro256** seedable for tests)
- **`evaluate.ts`** — `evaluateHand(cards, options)` classifies a 5-card hand into `HandRank`. Wild-card support gated by `options.wildRank: Rank | null`
- **`paytable.ts`** — exports two paytables, one per variant, as `Record<HandRank, number>` (per-coin values; max-bet bonus for Royal Flush handled in the consumer)
- **`round.ts`** — round state machine: `dealing → holding → drawing → evaluating → done`
- **`index.ts`** — barrel re-exports for the variant clients

### Hand evaluator hierarchy
**Standard (Jacks or Better):**
1. Royal Flush
2. Straight Flush
3. Four of a Kind
4. Full House
5. Flush
6. Straight
7. Three of a Kind
8. Two Pair
9. Jacks or Better (pair of J/Q/K/A)
10. (no pay — anything below)

**Wild (Deuces Wild):**
1. Natural Royal Flush (no wilds)
2. Four Deuces (all four 2s in hand)
3. Wild Royal Flush (royal using ≥1 deuce as wild)
4. Five of a Kind
5. Straight Flush
6. Four of a Kind
7. Full House
8. Flush
9. Straight
10. Three of a Kind
11. (no pay — anything below)

Note: Deuces Wild has no separate Two Pair / Pair payouts; minimum paying hand is Three of a Kind. This is canonical Deuces Wild — pairs are too easy with four wilds in the deck.

### State machine semantics

```
dealing   — RNG draws 5 cards from the shuffled deck; round transitions to holding
holding   — player toggles HOLD on 0–5 cards; primary action button reads DRAW
drawing   — held cards stay; un-held cards are replaced from the same deck (next 5−heldCount cards in shuffle order)
evaluating — final hand classified; paytable applied; credits updated
done      — UI displays result; primary action button reads DEAL to start next round
```

The deck shuffle is per-round, not per-deal; the draw step pulls from the same shuffled deck rather than re-shuffling. This is the standard physical-cabinet behavior.

## Section 5 — Paytables (final values locked in Phase 3 math spec)

This design spec captures **paytable identity** (which paytables are in use) but defers **exact per-row values** to the Phase 3 math design spec, where they'll be transcribed against canonical references and tested with golden vectors.

### Jacks or Better — 9/6 paytable
The "9/6" name refers to the Full House (9) and Flush (6) per-coin payouts. Royal Flush bonus on max bet (5 coins): 800 × 5 = 4000 coin payout. Per-coin values for ranks 1–4 coins are linear (e.g., 250 / 500 / 750 / 1000 for Royal); only the 5-coin Royal triggers the bonus to 4000. RTP under optimal play: ~99.54%.

### Deuces Wild — NSUD paytable
"NSUD" stands for **Not So Ugly Deuces**, the canonical 99.73%-RTP variant of Deuces Wild. The defining row is the Straight Flush / Four of a Kind / Full House / Flush / Straight / Three of a Kind tuple. The Phase 3 math spec will lock the exact values against Wizard of Odds canonical reference.

### Bet selection
Both games support 1–5 coin bet via a bet selector. The Royal Flush bonus on max bet (the 250 × 5 = 1250 → 4000 jump) is the only non-linear paytable element; every other row scales linearly with bet.

## Section 6 — Math verification approach

Video poker math verification is qualitatively different from slot reels. The published RTP for both paytables assumes **optimal-strategy** play — the player holds the correct cards on every deal per a precomputed strategy table. Random-hold play produces a much lower empirical RTP, and we don't ship a strategy hint engine.

What we do verify:
1. **Hand evaluator correctness** — golden vectors for 50+ known hands, covering each rank, plus edge cases:
   - Ace-low straight (A-2-3-4-5)
   - Ace-high straight (10-J-Q-K-A)
   - Royal Flush vs Straight Flush boundary
   - Four of a Kind with wild card vs natural Four of a Kind (Deuces only)
   - Five of a Kind only legal with wilds (Deuces only)
   - Wild Royal Flush vs Natural Royal Flush distinction (Deuces only)
2. **Deck shuffle uniformity** — chi-square-style test over 100k shuffles, verifying that each card-position pairing is roughly uniformly distributed.
3. **Paytable transcription** — both paytables locked as constants, asserted against canonical published values in tests.
4. **Round state machine invariants** — held cards never change between deal and draw; drawing draws exactly `5 − heldCount` cards from the deck; total cards drawn per round never exceeds 10 (5 dealt + 5 replacements).

What we **don't** verify:
- **Optimal-play RTP simulation.** Would require building a full strategy table (32 hold patterns for JoB, ~50 patterns for Deuces Wild) — significant engineering for an informational guarantee in personal-entertainment scope. Documented as deferred in the math spec.

## Section 7 — Sequencing

| Phase | Deliverable |
|---|---|
| **Phase 1** — design lock | Approved (this spec) |
| **Phase 2** — ADRs + architecture delta | Append C1–C6 to `DECISIONS.md`; add Section 15 (Card Parlor subsystem) to `ARCHITECTURE.md` |
| **Phase 3** — math design spec | New spec at `docs/superpowers/specs/cards-video-poker-engine.md` covering deck/evaluator/paytable details with locked per-row values |
| **Phase 4A** — shared engine TDD | Implement `lib/cards/video-poker/` with full test coverage; commit locally |
| **Phase 4B** — Jacks or Better client UI | `app/cards/jacks-or-better/` + supporting components; ship JoB |
| **Phase 5** — Deuces Wild client UI | `app/cards/deuces-wild/` reusing the engine with the variant paytable + wild-card layer; ship Deuces |
| **Phase 6** — docs delta + final review | RUNBOOK update, README update, cross-feature final review |

Build effort estimate: ~75% of Tideforge's effort for both games combined. The shared engine pays for itself starting with game #2.

## Section 8 — Success criteria

This phase is done when:
1. Both `/cards/jacks-or-better` and `/cards/deuces-wild` return HTTP 200 on the live site
2. The `/cards/` index renders both games as live cards (no "coming soon" placeholders)
3. Both games are playable end-to-end: deal → hold → draw → evaluate → credit update → next round
4. The hand evaluator passes all 50+ golden-vector tests
5. The deck shuffle passes the uniformity test
6. Both paytables are locked as constants and transcription-tested
7. localStorage persistence works for credits and stats (per-game keys)
8. Reset balance flows work and explicitly disclaim real-money framing
9. `prefers-reduced-motion: reduce` collapses all animations to instant reveal
10. The 142-test baseline holds or grows; no regressions
11. Production build clean; both new routes prerendered as static
12. ADRs C1–C6 written into `DECISIONS.md` with the same rigor as S1–S6
13. RUNBOOK and README mention the card parlor

## Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Hand-evaluator bugs in edge cases (Ace-low straight, Wild Royal vs Natural Royal) | M | 50+ golden-vector tests with named edge cases; both reviewers will spot-check |
| Paytable transcription error | M | Constants asserted against canonical Wizard of Odds reference; one off-by-one in a single row would be caught by RTP-pattern tests over 10k random hands |
| Reduced-motion miss in JS or CSS layer | L | Both layers tested in isolation; pattern proven in Tideforge |
| localStorage quota exhaustion (cumulative stats over many sessions) | L | Stats are bounded — count of hands, total wagered, total won, biggest win — no unbounded arrays |
| Visual identity feels too similar to Tideforge | L | Different palette (red/gold + blue/teal vs Prussian-blue/bronze), different layout (paytable panel up top vs bonus meter on side), different player vocabulary (cards/holds/draws vs reels/spins/multipliers) |
| Player confusion between JoB no-pair-pays and Deuces no-pair-pays | L | Each game's paytable is rendered live in the cabinet; the player sees what pays and what doesn't every hand |

---

End of design.
