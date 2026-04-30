# TEST_STRATEGY.md — daily-arcade

**Author:** QA Engineer
**Date:** 2026-04-29
**Status:** Pre-build strategy. Updated as suite stabilizes.

---

## 1. Test pyramid for this app

This is a thin server with rich client mechanics, signed share URLs, and an integrity-sensitive leaderboard. The pyramid skews **integration-heavy** because the bugs that hurt are at the seams (submit → DB → leaderboard → share).

| Layer | Share of total tests | Why |
|---|---|---|
| **Unit** | 50% | Game mechanics (Word Volley scoring, Drift 2049 merge, Snap Trivia timing), seed PRNG, HMAC, date helpers — all pure functions. Cheap, valuable. |
| **Integration** | 35% | Submit Server Action end-to-end (BotID stub → rate limit → validate → write → sign), DB queries, Drift replay verifier, OG image renderer. Use real Postgres (ephemeral). |
| **E2E** | 15% | The 6 critical user journeys (below) on Chromium + Mobile-Chromium viewport. Headless on CI; headed locally for debugging. |

We will *not* write component snapshot tests. Snapshots become noise within a sprint.

---

## 2. Critical user journeys (E2E coverage)

The flows that, if broken, lose users or break credibility. Each gets a Playwright spec.

1. **First-time player completes Word Volley and copies share grid**
   - Land on `/` → click Word Volley → play 6 guesses → see win/lose state → click share → share text on clipboard matches expected emoji-grid pattern
2. **First-time player submits to leaderboard**
   - Complete a game → submit dialog → enter handle → success → leaderboard shows entry with correct rank + discriminator on collision
3. **Daily seed parity**
   - Two browsers (different sessions) load `/g/word-volley` on the same UTC day → identical target word
4. **Streak survives navigation and reload**
   - Complete a game → reload → streak chip shows 1-day streak → navigate away and back → still 1
5. **Share URL → OG image renders**
   - Visit `/share/<id>` → fetch the `og:image` URL → returns 200 with image content; tampered query (`?score=99999`) returns 400
6. **Challenge link prefills handle**
   - Visit `/g/word-volley?from=ALICE` → submit dialog opens with "ALICE" prefilled

---

## 3. Risk-targeted areas (more coverage)

### Submit Server Action — the integrity surface
- Happy path: each game (×3)
- Reject branches: BotID fail, rate-limit hit, invalid handle, profanity, score mismatch, missing date param, signature replay
- Concurrency: two submits with the same handle on the same day → both succeed with different discriminators

### Drift 2049 replay verifier
- Golden-vector fixtures: known seed → known move log → known final state
- Tampered move logs (alter one move) → reject
- Empty / single-move logs → reject as malformed

### HMAC signing
- Round-trip sign+verify
- Forged signatures rejected
- Key rotation: old key-id still validates pre-rotation URLs; new URLs use new key-id
- Constant-time comparison verified (mutation testing on the comparator)

### Daily seed engine
- Golden vectors for at least 30 dates
- Same date → same seed across processes
- Day-rollover at 00:00 UTC handled by clock mock

### Rate limiter
- Burst of 6 submits in 1 minute → 6th rejected
- 21 submits across a day → 21st rejected
- Multiple games rate-limit independently

---

## 4. Tools

| Concern | Tool |
|---|---|
| Unit & integration | **Vitest** + `@vitest/coverage-v8` |
| E2E | **Playwright** (Chromium + Mobile Chromium) |
| Accessibility in E2E | **`@axe-core/playwright`** |
| Network mocks (where unavoidable) | **MSW** |
| DB for integration | **Real Neon branch** for CI; **`pg-mem`** for unit-adjacent tests where setup cost matters |
| Test data factories | Hand-written `lib/test/factories.ts`; no Faker dependency for test stability |

---

## 5. CI gates

- **On every PR:** typecheck + lint + unit + integration + Playwright smoke (≤ 4 specs covering home, one game completion, share, leaderboard)
- **On `main` after merge:** full Playwright suite + axe-core sweep
- **Nightly:** dependency audit (`npm audit`), Lighthouse CI on preview
- **Lint config:** `eslint-config-next` + `@typescript-eslint/*` strict; `--max-warnings 0`

A flaky test gets quarantined to a `flaky` tag for one sprint. If it can't be fixed, it's deleted. **Retries are banned in test config.**

---

## 6. Data strategy

- **Unit/integration:** seeded factory functions for `leaderboard_entries`, `daily_seeds`, etc. Each test creates its own rows; no shared mutable state.
- **E2E:** ephemeral Postgres branch per CI run via Neon; tests insert their own seed for the dates they exercise.
- **Local dev:** `pnpm db:reset` reseeds with 30 days of `daily_seeds`, the curated trivia bank, and a small dictionary subset.

---

## 7. Accessibility test plan

- `axe-core` runs against every Playwright page-fixture in the suite
- Critical components covered specifically: on-screen keyboard, handle picker dialog, share grid, leaderboard table
- Manual screen-reader pass (VoiceOver iOS, NVDA Windows) before Phase 5 sign-off
- `prefers-reduced-motion` respected — verified via Playwright CSS media query emulation

---

## 8. Performance test plan

- Lighthouse CI on preview, mobile profile, 4G throttling
- Per-route budget enforced: failure on regression > 10% from baseline
- Bundle size check (`next-bundle-analyzer` in PR if > 120KB entry)

---

## 9. Security test plan (coordinated with AppSec Pass 2)

Tests we own (vs. AppSec audit):

- Headers test: hit deployed preview, assert presence of all THREAT_MODEL §7 headers
- Signature forgery test: tamper with `?s=` and assert OG returns 400
- Cron route auth test: hit `/api/cron/daily-warm` without bearer → 401, no body

---

## 10. Bug severity definitions

- **P0** — site down, data corruption, security exploit, leaderboard top-10 forgeable. Ship-blocker.
- **P1** — core flow broken (cannot complete a game; cannot submit; cannot share). Ship-blocker unless explicit risk acceptance.
- **P2** — degraded UX (broken animation, wrong empty state copy, layout issue at uncommon viewport). Fix this sprint.
- **P3** — cosmetic, nice-to-have, edge browser. Backlog.

---

## 11. Bug report template (`BUGS.md` rows use this)

```
### B-NNN — short title — P0/P1/P2/P3

**Steps to reproduce**
1. ...
**Expected:** ...
**Actual:** ...
**Environment:** preview / branch / commit-sha
**Notes:**
```

---

## 12. Exit criteria for Phase 6

- 0 P0 open
- 0 P1 open (or risk-accepted with sign-off in DECISIONS.md)
- All E2E specs green on preview
- axe-core suite zero violations
- Performance budgets met
