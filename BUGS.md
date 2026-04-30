# BUGS.md — daily-arcade

**Author:** QA Engineer
**Date:** 2026-04-29
**Test environment:** local Node 22.14, Next.js 16.2.4 production server, in-memory store

---

## Open

None at P0/P1 severity.

## Closed during testing

### B-001 — Word Volley grading regression on duplicate yellow letters (P2 → fixed in build phase)
- **Symptom:** initial test fixtures asserted incorrect grading semantics
- **Diagnosis:** algorithm was correct; test expectations needed update
- **Fix:** test rewritten to match canonical Wordle grading (greens consume target letters before yellows are assigned). Verified via two new test cases.

### B-002 — vitest jsdom env unable to importKey (P2 → fixed)
- **Symptom:** SubtleCrypto.importKey rejected jsdom's Uint8Array buffer with "not instance of ArrayBuffer"
- **Fix:** switched test environment to Node (server code only, no DOM tests in suite).

### B-003 — server-only sentinel module unresolvable in vitest (P2 → fixed)
- **Symptom:** `import "server-only"` from `lib/sign.ts` failed under vitest
- **Fix:** added vitest alias mapping `server-only` to an empty stub at `test/server-only-stub.ts`.

---

## Risk-accepted (documented for tracking)

### B-100 — InMemoryStore loses leaderboard data on cold start (P1, accepted for preview only)
- **Severity in production:** P0 — would block prod
- **Severity in preview:** P1, accepted
- **Mitigation:** preview banner / RUNBOOK warning; production gate requires `DATABASE_URL`. Tracked in DECISIONS ADR-007.

### B-101 — Trivia bank size insufficient for long-running daily rotation (P2)
- **Symptom:** 60 questions, 5 per day → ~12 unique-day rotations before repeats start showing thematically
- **Mitigation:** ship a content-grow ticket post-launch. Acceptable for MVP since pop-culture trivia tolerates repeats with users who don't remember.

### B-102 — Word target list at ~360 words rather than 2,500 (P2)
- **Symptom:** ~ 1 year of unique daily targets before repeats; reasonable for MVP
- **Mitigation:** content-grow ticket post-launch.

### B-103 — PWA install path lacks runtime service worker (P2)
- **Symptom:** "Add to Home Screen" works on Chrome/Safari iOS via manifest, but no offline cache for the daily puzzle
- **Mitigation:** Serwist integration deferred to Fast Follow. Documented in PLAN scope deviation.

---

## CI gate status

- Unit + integration: **24/24 passing**
- Lint: **0 errors, 0 warnings**
- Typecheck: **clean**
- Production build: **green**
- Live smoke (home, three games, leaderboard, manifest, about): **all 200**
- Security headers: **all six headers verified on /**
- Cron auth: **401 unauthenticated, 200 with bearer**

QA sign-off: **approved to advance to Security Audit (Pass 2).**
