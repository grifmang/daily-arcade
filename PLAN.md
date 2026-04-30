# PLAN.md — daily-arcade

**Author:** Principal Engineer
**Date:** 2026-04-29 (v1, pre-build); 2026-04-30 (v2, post-Netlify pivot)
**Status:** v2 — pivot phase 0 active; v1 build tickets annotated for inheritance.

> **Pivot note (2026-04-30):** v1 of this plan delivered all build, polish, security, and docs phases against Vercel. The user has confirmed Netlify as the deploy target. v2 inserts a **Pivot Phase 0** ticket bucket (P-001..P-052) ahead of the existing flow and annotates which v1 tickets carry forward as-is, which are superseded, and which need re-spec. See `DECISIONS.md` ADRs 1–5 dated 2026-04-30.

---

## How to read this

- Tickets are ID'd `T-001`..`T-NNN`. They map to a single PR each.
- Each ticket has: **Owner**, **Depends on**, **Acceptance criteria**, **Effort**.
- Phase gates: Build cannot start ticket T-N until all `Depends on` are merged.
- Effort: S (≤ ½ day), M (1 day), L (2–3 days), XL (4–7 days).

---

## Phase 3 — Planning artifacts (this ticket bucket)

| ID | Ticket | Owner | Effort | Status |
|---|---|---|---|---|
| **P-001** | Author this PLAN.md | principal | S | Done (v1); v2 adds Pivot Phase 0 below |
| **P-002** | Author TEST_STRATEGY.md | qa | S | Done |
| **P-003** | DevOps scaffolding plan recorded in DECISIONS.md | devops | S | Done |

---

## Pivot Phase 0 — Netlify re-platform (2026-04-30)

This bucket ships ahead of any new feature work. Group by surface: Config/build → Bot-protection wire-up → Cron → Docs. All tickets reference DECISIONS.md ADRs 1–5 (2026-04-30).

### Pivot Group 1 — Config & build (devops)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| **P-001** | Delete `vercel.ts` and `.vercel/vercel.json` (preserve nothing — committed-config-only deletion) | devops | — | XS | Files removed; `tsc --noEmit` and `next build` still pass without them |
| **P-002** | Add `netlify.toml` at repo root: `[build]` (`command = "next build"`, `publish = ".next"`), `[functions."daily-warm"] schedule = "0 0 * * *"`, `[[headers]]` fallback security headers (defense-in-depth — `proxy.ts` is authoritative) | devops | P-001 | S | `netlify build` (or `netlify dev`) starts cleanly; scheduled function shows `Scheduled` badge after first published deploy; do **not** add `[[plugins]] @netlify/plugin-nextjs` block (auto-installed) |
| **P-003** | Update `proxy.ts` CSP per THREAT_MODEL.md §P3.4: drop `va.vercel-scripts.com` + `vitals.vercel-insights.com`; add `https://challenges.cloudflare.com` to `script-src`, `connect-src`, `frame-src` | devops | P-001 | XS | curl test on dev server confirms new CSP; no other directives changed |
| **P-004** | Drop the `x-vercel-cron === "1"` alternative-auth branch from `app/api/cron/daily-warm/route.ts`; bearer-only | senior-backend | P-001 | XS | Route returns 401 without bearer; returns 200 with bearer; existing cron secret env unchanged |
| **P-005** | Update `.env.example`: remove "Vercel Marketplace" comment from DB section; add `TURNSTILE_SITE_KEY=<your-turnstile-site-key>` and `TURNSTILE_SECRET_KEY=<your-turnstile-secret-key>` placeholders; add comment that real values are set via Netlify CLI/UI | devops | — | XS | `.env.example` lists names + safe placeholders only; no real keys ever |
| **P-006** | Confirm `package.json` scripts work under Netlify build (no Vercel-specific assumptions) | devops | P-002 | XS | `npm run build` and `npm test` both pass under `netlify dev` |
| **P-007** | Add `@netlify/functions` devDependency for scheduled-function types | devops | P-001 | XS | `package.json` updated; lockfile regenerated; types resolve in `netlify/functions/*.mts` |

### Pivot Group 2 — Bot protection (senior-backend)

Spec source: DECISIONS.md ADR-1, THREAT_MODEL.md §P3.6 gates.

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| **P-010** | Update `lib/env.ts`: add `turnstileSiteKey` (with `NODE_ENV !== "production"` substitution to test key `1x00000000000000000000AA`), add `turnstileSecretKey` (with `NODE_ENV !== "production"` substitution to test key `1x0000000000000000000000000000000AA`); extend `assertProductionEnv()` to require both | senior-backend | P-005 | S | Unit test: in non-prod, `env.turnstileSecretKey` returns the test key without warning; in prod with both unset, `assertProductionEnv()` returns `{ ok: false, missing: ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] }` |
| **P-011** | Create `lib/turnstile.ts` (`import "server-only"` at top): exports `verifyTurnstile(token: string): Promise<{ ok: true } | { ok: false, codes: string[] }>`. POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `{ secret, response }` (omit `remoteip`); 10s `AbortController` timeout; fail-closed on non-200, JSON parse failure, or `success: false`; verifies response `hostname` matches `process.env.URL` (Netlify-provided) when `success: true`; never logs the token | senior-backend | P-010 | M | All cases unit-tested per §P3.6 gate list (success, invalid token, timeout, non-200, `timeout-or-duplicate`, hostname mismatch); module is `import "server-only"`; no dynamic require of secret |
| **P-012** | Create `components/TurnstileWidget.tsx` (client component): renders the Turnstile widget via vanilla `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, exposes a callback that returns the token; styled to match design system; reset on submit failure | senior-fullstack | P-010 | M | Widget renders on dev with test site key; `onVerify(token)` fires; widget resets on parent-triggered failure |
| **P-013** | Wire `TurnstileWidget` into the submit form (existing handle picker / submit dialog); pass token to `submitScore` Server Action; surface generic "couldn't verify" on failure with reset | senior-fullstack | P-011, P-012 | M | E2E: a successful submit in dev (test key always passes) lands a leaderboard row; widget visible in form |
| **P-014** | Wire `TurnstileWidget` into the claim-handle dialog; pass token to `claimHandle` Server Action | senior-fullstack | P-011, P-012 | S | E2E: claim-handle dialog shows widget; first-time submit succeeds in dev |
| **P-015** | Modify `submitScore` Server Action: accept `turnstileToken` in input schema; call `verifyTurnstile(turnstileToken)` as **step 1** (before rate-limit, before any DB read); on `ok: false`, return generic error and log `{ codes }` (not the token) | senior-backend | P-011 | M | Integration test: submit without token → 403; submit with invalid token (mock `success: false`) → 403, no rate-limit slot consumed; submit with passing token → existing pipeline runs |
| **P-016** | Modify `claimHandle` Server Action: same Turnstile gate as P-015 | senior-backend | P-011 | S | Integration test parallel to P-015 |
| **P-017** | Add build-time bundle-grep step to `package.json` scripts (`bundle:check`): runs `next build` then greps `.next/static/**/*.js` for the literal `TURNSTILE_SECRET_KEY` and fails if found; document in RUNBOOK pre-deploy checklist | devops + appsec | P-011 | S | New script in `package.json`; CI runs it; intentional injection of the literal causes the script to fail (proves the check works) |

### Pivot Group 3 — Cron (Netlify Scheduled Function)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| **P-020** | Create `netlify/functions/daily-warm.mts`: scheduled function whose body is `await fetch(\`${process.env.URL}/api/cron/daily-warm\`, { headers: { Authorization: \`Bearer ${process.env.CRON_SECRET}\` } })`; logs result; sets `export const config = { schedule: "0 0 * * *" }` (or relies on `netlify.toml` per ADR-2) | senior-backend + devops | P-002, P-004 | S | `netlify functions:invoke daily-warm` in dev hits the route handler with the bearer; production deploy shows `Scheduled` badge; route handler logs reflect the call |

### Pivot Group 4 — QA & smoke

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| **P-030** | Verify the existing 24 Vitest unit tests still pass after Group 1+2+3 changes | qa | P-007, P-017, P-020 | XS | `npm test` green; no skipped tests |
| **P-031** | Add Vitest tests for `lib/turnstile.ts` (success, invalid token, timeout, non-200, `timeout-or-duplicate`, hostname mismatch) — minimum 6 cases | qa + senior-backend | P-011 | M | Test file `lib/turnstile.test.ts` exists; all cases assert fail-closed on negative paths |
| **P-032** | Update integration tests for `submitScore` and `claimHandle` to mock Turnstile verifier (test key always passes; explicit failure cases cover reject branches) | qa | P-015, P-016 | M | Existing integration test file extended; reject branches added; CI green |
| **P-033** | Smoke under `netlify dev`: home loads, all three games playable, submit succeeds with test Turnstile key, leaderboard renders, share landing renders, OG image returns 200 with valid signature | qa | P-002, P-013, P-014, P-020 | S | Manual smoke checklist completed and recorded as a comment in BUGS.md |

### Pivot Group 5 — AppSec Pass 3 runtime (pre-deploy)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| **P-040** | AppSec Pass 3 runtime audit per THREAT_MODEL.md §P3.7 against a Netlify deploy preview | appsec | P-033 + Group 5 deploy | M | All seven verification items from §P3.7 pass; new SECURITY_REVIEW.md section appended (Pass 3) |

### Pivot Group 6 — Pre-flight gates (USER ACTION REQUIRED — surface to parent)

These are not tickets I execute. They are explicit pre-flight items for the user to action **before** P-051 below. Surfacing now per operating rules.

| ID | Item | Who | Notes |
|---|---|---|---|
| **PF-1** | Authorize Netlify CLI on this machine (`netlify login`) and select team/scope for the `daily-arcade` site | **user** | Interactive auth; cannot be scripted |
| **PF-2** | Provide `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (parent holds these) to be set via `netlify env:set` | **user** | Real keys never written to any committed file or to my context |
| **PF-3** | Provide `DATABASE_URL` and `DATABASE_URL_UNPOOLED` from Neon (existing project or new direct project) | **user** | Same env names as before; only provisioning UI changes |
| **PF-4** | Confirm production hostname is `daily-arcade.netlify.app` (or other) so that hostname-match in `lib/turnstile.ts` is correct | **user** | Locked: `daily-arcade.netlify.app` |

### Pivot Group 7 — Deploy (devops)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| **P-050** | `netlify init` / `netlify link` against the `daily-arcade` site | devops | PF-1 | S | Site linked; `.netlify/state.json` produced (gitignored) |
| **P-051** | Set production env: `netlify env:set` for `SHARE_SIGNING_SECRET`, `CRON_SECRET`, `IP_HASH_SALT_BASE`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `NETLIFY_NEXT_SKEW_PROTECTION=true`. **Surface this command list back to parent — values held there.** | devops + user | PF-1..PF-4 | S | All eight envs present in production scope (verified via `netlify env:list`); secrets marked as `Contains secret values` per Netlify Secrets Controller |
| **P-052** | `netlify deploy --build` (preview), smoke; then on user approval, `netlify deploy --build --prod` | devops + user gate | P-051, P-040 | S | Preview URL reachable; production URL reachable; first-30-min monitoring window opened |

---

## Pivot inheritance map — which v1 tickets carry forward

**Carries forward unchanged** (game logic, design system, data model — all platform-agnostic):

T-002 (shadcn/ui + tokens), T-003 (Drizzle setup), T-004 (initial migration), T-006 (daily seed engine), T-007 (HMAC sign/verify), T-010 (Word Volley), T-011 (Drift 2049), T-012 (Snap Trivia), T-013 (word lists), T-014 (trivia bank), T-021 (`claimHandle` core — Turnstile gate added by P-016), T-022 (leaderboard read; cache primitive renamed but tag-based invalidation unchanged), T-031 (streak storage), T-032 (share grid + share landing), T-033 (leaderboard UI), T-034 (challenge link), T-035 (handle picker), T-036 (PWA / Serwist), T-040 (Drift replay verifier), T-041 (IP-hash salt rotation), T-042 (rate limiter), T-050..T-053 (polish), T-054..T-055 (Lighthouse / CWV gates).

**Modified by Pivot Phase 0** (originals merged but superseded as noted):

- T-001 (scaffold) — `vercel.ts` deleted by P-001; `netlify.toml` added by P-002.
- T-005 (Routing Middleware headers) — CSP updated by P-003.
- T-020 (`submitScore`) — Turnstile gate added by P-015.
- T-023 (OG image route) — runtime config unchanged; runs on Netlify Function instead of Vercel Function (no code change required, ADR-3).
- T-024 (cron route) — alt-auth branch dropped by P-004.
- T-025 (Vercel BotID integration) — **superseded** by P-010..P-017 (Turnstile). Original ticket was deferred at build, never wired.

**Phase 5 polish / Phase 6 testing / Phase 7 AppSec Pass 2** — all deliverables stand. New AppSec Pass 3 runtime is added (P-040) under the pivot.

**Phase 8 deploy** — original D-001..D-004 superseded by P-050..P-052 (Netlify CLI instead of Vercel).

**Phase 9 docs** — README + RUNBOOK rewrites are deferred to the docs phase at the end of the pivot (W-003 and W-004 below).

---

## Phase 4 — Build tickets

### Group A — Foundation (must precede everything)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| T-001 | `create-next-app` scaffold (TS strict, Tailwind 4, App Router, Turbopack), Node 24 engines, ~~`vercel.ts` config~~ → **superseded by P-001/P-002** (`netlify.toml`) | devops | — | S | Done in v1; pivot deletes `vercel.ts` |
| T-002 | shadcn/ui init + Tailwind tokens (colors, type scale, spacing, radii, motion durations) reflecting brand direction (retro-arcade modern editorial) | frontend-systems | T-001 | M | `components/ui/*` includes Button/Card/Dialog/Input/Toast; `lib/design-tokens.ts` documents the tokens; storybook-style demo route at `/_design` (dev-only) |
| T-003 | Drizzle ORM + Neon driver setup; migration scaffolding | senior-backend | T-001 | S | `drizzle.config.ts` present; `pnpm db:generate` and `pnpm db:migrate` work locally against `.env.local` |
| T-004 | Initial migration: `daily_seeds`, `leaderboard_entries`, `shares`, `trivia_questions`, `word_targets`, `word_dictionary` per ARCHITECTURE.md | senior-backend | T-003 | M | Migration applies cleanly; indexes match spec; seed script can insert N rows |
| T-005 | Routing Middleware (`proxy.ts`) emitting all security headers from THREAT_MODEL.md §7 — **CSP updated by P-003 (Pass 3 §P3.4)** | devops | T-001 | S | Done in v1; pivot updates CSP origins |
| T-006 | Daily seed engine (`lib/seed.ts` with xoshiro256\*\* + golden-vector tests) | senior-backend | T-001 | S | Pure functions; Vitest unit tests cover golden vectors; never imports browser-only APIs |
| T-007 | HMAC signing/verification helper (`lib/sign.ts`) with key-id versioning | senior-backend | T-001 | S | Sign + verify round-trip tests; rejects modified payloads; supports rotated keys |

### Group B — Game engines (parallelizable after Group A)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| T-010 | Word Volley mechanic (client component, custom on-screen keyboard, guess validation, share-grid emoji) | senior-fullstack | T-002, T-006 | L | Plays end-to-end against a stub seed; mobile keyboard renders correctly at 360px; share grid matches Wordle convention |
| T-011 | Drift 2049 mechanic (4×4 board, swipe + arrow keys, score, move-log capture) | senior-fullstack | T-002, T-006 | L | Plays against stub seed; move log captured for replay; share grid renders peak-tile bar |
| T-012 | Snap Trivia mechanic (5 questions, 10s timer per Q, score formula, share grid) | senior-fullstack | T-002, T-006 | M | Plays against stub seed; timer is monotonic; share grid renders ⚡✅❌ pattern |
| T-013 | Word target list + 5-letter dictionary bundle (gzipped JSON; loaded by route) | senior-backend | T-004 | S | `data/word-targets.json` (≥ 2,500 entries) and `data/word-dictionary.json` (≥ 12,000 entries) committed; gzipped size < 100 KB |
| T-014 | Trivia content bank — initial 500 questions (curated, evergreen-tagged) | senior-backend | T-004 | L | 500 rows seedable; categories balanced; ≥ 80% evergreen; profanity bank included as separate file |

### Group C — Server seam (depends on Group A; parallel with Group B)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| T-020 | Server Action `submitScore` with full validation pipeline (~~BotID~~ → rate limit → handle validate → server-side score recompute → write → sign + return share URL) — **Turnstile gate added by P-015** | senior-backend | T-004, T-006, T-007 | XL | Done in v1 minus the BotID step; pivot adds Turnstile as step 1 |
| T-021 | Server Action `claimHandle` (3-12 chars, profanity check, returns first-time discriminator) | senior-fullstack | T-004 | S | Returns deterministic discriminator on repeated claim with same handle; rejects profanity; rejects non-ASCII alphanumeric |
| T-022 | Route Handler `GET /api/leaderboard/[game]` with Runtime Cache (60s TTL) | senior-backend | T-004 | S | Returns top 100 by `(score DESC, created_at ASC)`; cache key per `(game, date)`; `updateTag` called on submit |
| T-023 | OG image route `app/og/[game]/route.tsx` using `ImageResponse`; verifies signature; renders bounded fields | senior-backend | T-007 | M | Returns 400 on invalid signature; 200 with image on valid; CDN cache headers set |
| T-024 | Daily cron `app/api/cron/daily-warm/route.ts` (writes next 7 days of seeds + IP-hash daily salt rotation) — **alt-auth branch dropped by P-004; scheduled invoker added by P-020** | senior-backend | T-006 | S | Done in v1; pivot simplifies auth to bearer-only |
| ~~T-025~~ | ~~Vercel BotID integration~~ — **superseded by P-010..P-017 (Cloudflare Turnstile)**. Originally deferred at build, never wired. | — | — | — | Replaced by Pivot Group 2 |

### Group D — Arcade shell + share + leaderboard UI (depends on Groups A–C)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| T-030 | Arcade shell layout: nav, footer, install prompt, three-game grid on home, streak chip, countdown | frontend-systems | T-002 | M | Mobile-first; renders with no JS for the static shell; no CLS; accessible nav |
| T-031 | Streak storage helpers (localStorage + IndexedDB shadow) and React hooks | senior-fullstack | T-001 | M | Survives selective localStorage clear; unit tests for date-rollover edge cases (DST, leap, etc.) |
| T-032 | Share grid component + copy-to-clipboard + native Web Share API + share landing page (`/share/[id]`) | senior-fullstack | T-007, T-020, T-023 | M | Clipboard copies plain text + URL; Web Share invoked when available; share landing renders OG meta tags |
| T-033 | Leaderboard route (`/leaderboard/[game]`) with 60s polling; rank highlight for current user | senior-fullstack | T-022 | S | Top 100 visible; user's own row highlighted if present; loading + empty states designed |
| T-034 | Challenge link entry point: `?d=<date>&from=<handle>` shows pre-filled handle in submit dialog; date param ignored if not today | senior-fullstack | T-021, T-031 | S | Handle pre-filled; navigating from challenge URL on a non-today date shows "this challenge is from a past day" |
| T-035 | "First-time leaderboard submit" handle picker dialog | frontend-systems | T-021 | S | Dialog blocks submit until handle is claimed; shows discriminator on collision |
| T-036 | PWA: Serwist setup, manifest, install prompt UI | senior-fullstack | T-001, T-030 | M | Installable on mobile Chrome + iOS Safari; offline mode serves shell + today's seed; icon & splash assets present |

### Group E — Anti-cheat hardening (depends on Group C)

| ID | Ticket | Owner | Depends on | Effort | Acceptance |
|---|---|---|---|---|---|
| T-040 | Drift 2049 server-side replay verifier (top-N entries) | senior-backend | T-011, T-020 | L | Pure function takes (seed, moveLog) → final state + score; rejects mismatched logs; replays into integration test set |
| T-041 | IP-hash daily salt rotation cron + retention purge (60d) | senior-backend | T-024 | S | Daily salt rotates; rows older than 60d have `ip_hash` nulled; tested |
| T-042 | Rate limiter (per IP-hash, per game+date, sliding-window) | senior-backend | T-020 | S | Limits enforced; integration tests for hit/miss; documented in RUNBOOK |

---

## Phase 5 — Polish (frontend-experience)

| ID | Ticket | Effort | Acceptance |
|---|---|---|---|
| T-050 | All async surfaces have loading + error + empty states (home, leaderboard, share, each game) | M | No surface displays "undefined" or a blank state; designed empty states use copy from Frontend Design |
| T-051 | a11y pass: keyboard nav for each game; focus management on Submit dialogs; aria-live for game results; on-screen keyboard fully accessible | L | axe-core in Playwright suite has zero violations on `/`, `/g/*`, `/leaderboard/*`, `/share/*` |
| T-052 | Motion polish: share-grid reveal, streak increment, daily countdown ticker; respects `prefers-reduced-motion` | S | Motion plays once per session; reduced-motion users see no decorative animation |
| T-053 | Form polish: handle picker validation messages, profanity error message, discriminator collision UX | S | Inline error text, no toasts for validation, focus stays in dialog on error |
| T-054 | Lighthouse a11y ≥ 95 on all four primary routes | gate | Verified on preview deploy |
| T-055 | Core Web Vitals pass on mobile (LCP < 2.5s, INP < 200ms, CLS < 0.1) | gate | Verified on preview Speed Insights |

---

## Phase 6 — Testing (qa-engineer)

QA executes TEST_STRATEGY.md. P0/P1 must be zero before ship. See `BUGS.md` for tracking.

---

## Phase 7 — Security audit (appsec-engineer Pass 2)

Pass-2 checklist run against the deployed preview. Output: `SECURITY_REVIEW.md`. P0/P1 must be remediated.

---

## Phase 8 — Deploy (devops-engineer)

> **Pivot note:** D-001..D-004 below are **superseded** by Pivot Group 7 (P-050..P-052). The original Vercel-CLI deploy was never executed (blocked at scope provisioning). Netlify deploy steps live above.

| ID | Ticket | Acceptance | Status |
|---|---|---|---|
| ~~D-001~~ | ~~Vercel project created + linked~~ | — | Superseded by P-050 |
| ~~D-002~~ | ~~Preview deploy of main green~~ | — | Superseded by P-052 (preview phase) |
| ~~D-003~~ | ~~Human gate: Promote to Production~~ | — | Superseded by P-052 (prod phase) |
| ~~D-004~~ | ~~First-30-min monitoring window~~ | Error rate baseline; CWV in green; no 5xx spikes | Carried forward in spirit; Netlify dashboard + Functions logs replace Vercel observability |

---

## Phase 9 — Documentation (tech-writer)

| ID | Ticket | Acceptance | Status |
|---|---|---|---|
| W-001 | README.md (what it is, local setup, deploy, common tasks) | New contributor can `pnpm dev` from a clean clone in < 10 min | Done in v1; **W-003 supersedes deploy section** |
| W-002 | RUNBOOK.md (app down, error spike, slow page, failed deploy, DB exhaustion, third-party outage) | All scenarios from devops template covered | Done in v1; **W-004 rewrites for Netlify** |
| **W-003** | Rewrite README.md deploy section for Netlify: `netlify init`, env-set commands, `netlify deploy` flow; new local dev guidance for `netlify dev` | New contributor can deploy a preview from a clean clone in < 15 min using the Netlify CLI | Pending — final phase of pivot |
| **W-004** | Rewrite RUNBOOK.md: deploy/rollback/incident scenarios swapped to Netlify CLI (`netlify deploy --build`, `netlify rollback`, `netlify functions:invoke daily-warm`, `netlify env:list`); add Cloudflare Turnstile incident scenario (Cloudflare outage = submissions fail-closed; user-facing copy + opsplaybook); add scheduled-function "missed run" scenario | All eight original scenarios rewritten for Netlify; two new Turnstile-specific scenarios added; one-liners section updated | Pending — final phase of pivot |

---

## Risk register (live, updated as we go)

| Risk | Status | Mitigation |
|---|---|---|
| Trivia content scarcity | Open | T-014 ships 500 curated; grow via offline LLM-generation pipeline post-PMF |
| Drift 2049 replay false-rejects | Open | T-040 includes generous tolerance for floating-point edge cases (none expected — all integer ops) |
| Day-1 viral spike on free tier | Open | Document scaling path in RUNBOOK; Neon free tier ≈10k DAU; if exceeded, upgrade plan to be flagged with user |
| iOS Safari PWA installability quirks | Open | T-036 acceptance includes manual iOS install verification |

---

## Acceptance gate to exit Build (Phase 4)

- All T-tickets merged
- Preview deploy reachable
- CI green: typecheck, lint, unit, integration, E2E smoke
- AppSec build-phase asks all visible in code (single submit path, HMAC sign on shares, profanity bank, security headers, no secret logging)

---

## Acceptance gate to exit Pivot Phase 0 (2026-04-30)

- P-001..P-007 merged: `vercel.ts` and `.vercel/` gone, `netlify.toml` present, CSP updated, cron bearer-only, env example updated, `@netlify/functions` installed
- P-010..P-017 merged: `lib/turnstile.ts` (server-only) + `<TurnstileWidget>` + verifier wired into both Server Actions; bundle-grep gate live
- P-020 merged: `netlify/functions/daily-warm.mts` exists and is scheduled
- P-030..P-033 green: existing 24 unit tests still pass + new Turnstile verifier tests + integration tests updated + manual smoke under `netlify dev` recorded
- P-040 sign-off: AppSec Pass 3 runtime verification list (THREAT_MODEL.md §P3.7) all green against a Netlify deploy preview
- PF-1..PF-4 confirmed by user: Netlify CLI authorized, Turnstile keys held by parent ready to set, Neon credentials ready, hostname locked
- P-050..P-052 ready to execute (do not run without explicit user go-ahead per operating rules)
- W-003, W-004 drafted and signed off
- DECISIONS.md ADRs 1–5 (2026-04-30) referenced by every changed file; no entries removed
