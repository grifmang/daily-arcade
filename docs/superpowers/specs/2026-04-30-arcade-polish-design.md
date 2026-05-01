# Arcade Polish Phase 1 — Design

**Date:** 2026-04-30
**Author:** Brainstorming session (Claude with grifmang)
**Status:** Approved by user, awaiting spec review
**Live site:** https://daily-arcade.netlify.app/

## Context

The MVP shipped on 2026-04-30 (DECISIONS.md ADRs 1–7). Two improvements have outsized retention/share-coefficient impact for low effort and zero coupling to streak storage or Postgres:

1. **Trivia recycle cliff.** `lib/content/trivia.ts` ships with 60 questions; at 5 picks/day the bank cycles every 12 days. Persona "Morning-coffee Ali" plays daily and will hit repeats inside two weeks. RESEARCH_PRODUCT §6 set the production target at 500.
2. **OG percentile badge.** The submit Server Action already returns `{rank, total}`; the OG render route already exists. Extending the OG image to brand the share with rank/percentile is roughly a one-day change with disproportionate share-coefficient impact (Persona "Lunch-break Lex" wants "top X%" for clout).

## Scope

**In:**
- Feature 1 — Trivia bank expansion (60 → ~500 hand-filtered questions sourced from Open Trivia DB)
- Feature 2 — Dynamic OG percentile badge (submit-time snapshot, asymmetric display rule)

**Out (with rationale):**

| Item | Why deferred |
|---|---|
| 7-day streak milestone badge | Depends on durable streak — gated on PostgresStore phase |
| Per-game streaks | Same dependency |
| Echo Reflex (4th game) | Path B; separate phase, no shared code |
| PostgresStore swap | Path C; separate phase; not a prerequisite for these two features |
| Profanity bank expansion | Already deferred in BUGS.md B-101 |
| LLM-generated trivia pipeline | Path D; would replace this phase's manual filter approach |
| Render-time live OG percentile | CDN cost too high; submit-time freeze is the correct trade-off |

## Feature 1 — Trivia bank expansion

### Goal
Increase `TRIVIA_QUESTIONS` from 60 to **between 450 and 550 on-brand entries**, breaking the 12-day recycle cliff. At 5/day the new pool cycles every ~100 days — past any reasonable retention horizon.

### Source
**Open Trivia DB** (https://opentdb.com/api.php). Free, attribution-required, no warranty.

Pull strategy:
- **Categories (6):** General Knowledge, Science & Nature, Entertainment: Film, Entertainment: Music, History, Geography
- **Difficulty:** easy + medium only (no hard — anti-persona is hardcore gamers per RESEARCH_PRODUCT §2)
- **Type:** multiple choice only
- **Encoding:** `encode=url3986` to avoid HTML-entity mojibake
- **Volume:** ~250 per category × 6 categories = ~1,500 raw questions; target ~85 surviving per category after filtering = ~510 final

### Filter pass — performed in conversation, no new infra
Filter is run once, by Claude in a follow-up implementation session. **No new dependency, no new env var, no build-time API call.** Filter rules applied in order:

1. **Dedup against the existing 60** — case-insensitive prompt match + Levenshtein ≥ 0.85 similarity
2. **Drop dated content** — phrases like "currently the President of," "the recently elected," "the latest…"
3. **Drop encoding bugs** — URL-decode failures, unbalanced quotes, mojibake remnants
4. **Drop tone misfits** — questions phrased awkwardly or in a register inconsistent with the existing bank ("dry, friendly, terse" per RESEARCH_PRODUCT §9)
5. **Drop unsafe content** — slurs, sexual content, anything that violates brand voice or would embarrass a player sharing
6. **Normalize** — title case for choice arrays where appropriate, strip whitespace, ensure exactly 4 choices per question, ensure `correctIndex` lands within the choices array

### Output
A revised `lib/content/trivia.ts` exporting `TRIVIA_QUESTIONS` in its **existing shape**. Consumers (`pickTriviaIds` in `lib/seed.ts` and the Snap Trivia client) work unchanged.

### Attribution
Add a one-line source attribution to the file header:
```ts
// Questions sourced and hand-filtered from Open Trivia DB (https://opentdb.com).
// Used under their license: free, attribution required, no warranty.
```
Add the same attribution to RUNBOOK.md under a new "Content sources" section.

### Quality gate (before merging)
- 450 ≤ `TRIVIA_QUESTIONS.length` ≤ 550
- File size budget: <100KB raw (~75KB at 500 entries × ~150 bytes is the realistic landing)
- Spot-check by user: random sample of 20 reviewed for quality and tone before merge
- Existing tests pass unchanged (the trivia game logic is content-agnostic)

## Feature 2 — Dynamic OG percentile badge

### Goal
Render rank-or-percentile information on the per-share OG image (`/og/<game>?id=<shareId>`) so the social-preview line "Daily Arcade — Word Volley — handle scored 92" can become "Daily Arcade — Word Volley — handle scored 92, top 3%."

### Snapshot timing — submit-time, frozen
The submit Server Action already computes `{rank, total}`. We persist these onto the share record at submit:

- **Schema delta (today, in `lib/store.ts`'s `ShareRecord` type):** add `rankAtSubmit: number | null` and `totalAtSubmit: number | null`. Both nullable so backwards compatibility with existing share records (rendered today) is automatic — they fall through to the "no badge" branch.
- **When PostgresStore lands** (separate phase): the `shares` table CREATE statement includes both columns nullable. No migration backfill needed — null is the safe default.
- **OG render reads frozen values directly.** No DB query for "current rank" at OG render time. CDN cache hit rate stays high; OG performance is unchanged from today.

### Display rule — asymmetric, first-match cascade
Rank is 1-indexed. `total` is the count of submissions for `(gameId, date)` at submit time.

| Cascade priority | Condition | Badge content | Visual treatment |
|---|---|---|---|
| 1 | `rank === 1 && total >= 50` | `TOP 1%` | Hero — large, accent color, positioned above score |
| 2 | `rank / total <= 0.05` | `TOP 5%` | Prominent — medium, accent color |
| 3 | `rank / total <= 0.10` | `TOP 10%` | Prominent — medium, plain color |
| 4 | `rank <= Math.min(100, Math.ceil(total * 0.25))` | `RANK #N` | Plain — small, muted color, below score |
| 5 | else | (no badge) | Score is the only score-related element |

The `min(100, ceil(total*0.25))` clamp on rule 4 prevents nonsense like "RANK #99 of 100" — that's not flattering. In a 60-player day, only top 15 see "RANK #N." In a 1000-player day, top 100 see it.

The asymmetric rule biases the OG image toward bragging when there's something to brag about and toward humble score-only otherwise.

### Why submit-time snapshot, not render-time live
A render-time live percentile would always be accurate but every social share would trigger a DB query, killing CDN cache and growing cost linearly with shares. Submit-time freeze is the correct trade-off:
- Pro: CDN-cacheable per shareId; OG render stays a pure read of the share record
- Con: a "TOP 3%" snapshot from 8am may technically be "TOP 7%" by midnight as more players submit
- Mitigation: the asymmetric rule means stale percentiles are only "stale brags," never "stale shame"

### Tests
- **`og/[game]/route.test.tsx`** (new): given share records at the percentile boundaries (top 1% with total ≥ 50, top 1% with total < 50, top 5%, top 10%, plain rank, below threshold), render the OG image and assert displayed badge text matches the rule
- **`lib/actions.test.ts`** (extend existing): `submitScore` now writes `rankAtSubmit` and `totalAtSubmit` onto the share record; assert the values match the returned `{rank, total}`
- **`lib/store.ts`** integration: a new share without these fields renders the "no badge" branch (backwards compat regression test)

## Sequencing

1. **Trivia bank expansion first** — pure content swap, zero schema, zero risk; commit + `git push origin main` → auto-deploy
2. **OG percentile badge second** — `ShareRecord` field addition + submit action change + OG render branch + tests; commit + `git push origin main` → auto-deploy

Two separate commits, two separate deploys. Each revertable independently if a deploy comes up red.

## Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| OpenTDB content quality variance | M | Manual filter pass before merge; user spot-checks 20-question random sample; existing 60 stay as the tone anchor |
| OpenTDB attribution miss | L | File-header note + RUNBOOK content-sources entry |
| OG percentile feels stale by EOD | L | Asymmetric rule keeps stale percentiles to "stale brags" only |
| Bundle size growth from 500-question file | L | ~75KB is well within budget; trivia.ts is already shipped on the client |
| Existing trivia tests break with new bank | L | Tests are over the daily-seed picker, not specific question content; should pass unchanged |
| Migration churn when PostgresStore lands | L | New fields nullable from day one; null = safe default = no badge; PostgresStore phase needs no backfill |

## Success criteria

This phase is done when:
1. `lib/content/trivia.ts` exports between 450 and 550 questions sourced from the merged OpenTDB pull + curated 60
2. `pickTriviaIds` returns reproducible 5-question picks per date over the new bank (existing test stays green)
3. The OG image at `/og/<game>?id=<shareId>` renders the correct badge tier for share records at each cascade boundary (5 new test cases pass)
4. The submit Server Action persists `rankAtSubmit` and `totalAtSubmit` onto the share record (extended test passes)
5. A new commit on `main` triggers an auto-deploy that lands `state=ready`
6. Live OG check: a real Word Volley submission renders the correct badge on `daily-arcade.netlify.app/og/word-volley?id=<id>`
7. No regression in the existing 42-test suite (combined total: 47 tests passing)
8. RUNBOOK.md and `lib/content/trivia.ts` carry OpenTDB attribution
