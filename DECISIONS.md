# DECISIONS.md — daily-arcade

Append-only decision log. Newest at the bottom. ADR / phase-handoff / sign-off / risk-accepted entries only.

---

## [2026-04-29] Phase handoff: Brief → Discovery

**From:** App Factory orchestrator
**To:** Principal Engineer

**Brief summary:** Daily-challenge arcade with 3–4 viral mini-games, Wordle-style emoji-grid sharing, streaks, leaderboard. Web-first PWA, Next.js on Vercel, no auth wall. See `BRIEF.md`.

**Open questions for Discovery:**
- Which 3–4 games maximize viral coefficient + daily-return?
- What's the minimum backend (DB/storage) needed for leaderboard + streak sync?
- How do we handle anti-cheat for leaderboards on day-1 (acceptable cheating tolerance)?
- Do we need any LLM/AI features (e.g., daily trivia generation), or fully deterministic seeds?

**Auto-mode authority:** Proceed with low-risk reversible decisions. Stop before paid services, custom domains, or production promotion.

---

## [2026-04-29] Discovery synthesis — what we're building

**From:** Principal Engineer
**Inputs:** `RESEARCH_PRODUCT.md`, `RESEARCH_TECHNICAL.md`

**What we're building (one paragraph):** Daily Arcade is a mobile-first PWA hosting three distinct daily-seeded mini-games — **Word Volley** (5-letter word, 6 guesses), **Drift 2049** (2048-style merge on a daily board), and **Snap Trivia** (5 timed questions) — sharing a single streak counter, a unified emoji-grid share grammar, per-game daily leaderboards with anonymous discriminator-suffixed handles, and signed challenge-link sharing. No auth in MVP; cross-device streak sync deferred to Fast Follow with Clerk. Storage is Postgres-only via Neon Marketplace with a Vercel Runtime Cache layer in front of leaderboard reads. One puzzle per UTC day; clients display local-time countdowns. OG share images and challenge URLs are HMAC-signed to prevent score forgery. Drift 2049 leaderboard top-100 is replay-verified server-side; Word Volley and Snap Trivia are server-validated by construction.

---

## [2026-04-29] ADR-001 — No AI SDK / LLM in MVP

**Decision:** Do not include AI SDK or Vercel AI Gateway in v1.0.
**Why:** None of the MVP features require generation at request time. Daily seed is deterministic. Trivia ships with a curated bank. Adding an LLM dependency adds latency, cost, prompt-injection surface, and zero user value at MVP. Brief allows AI "if justified" — it isn't.
**Alternatives rejected:** LLM-generated trivia at request time (rejected: content quality and prompt-injection risk); LLM-generated daily word (rejected: determinism + share parity is the entire viral mechanic).
**Revisit when:** Editor-reviewed offline trivia generation pipeline becomes useful for content velocity (post-PMF, not before).

---

## [2026-04-29] ADR-002 — Postgres-only storage; defer Redis

**Decision:** Use Neon Postgres (Vercel Marketplace) as the only persistent store. Use Vercel Runtime Cache (60-second TTL) in front of leaderboard reads.
**Why:** MVP traffic fits comfortably in Postgres+RuntimeCache. Adding Redis doubles operational surface for ~20-40ms of latency win that doesn't materially change UX for leaderboard reads.
**Alternatives rejected:** Upstash Redis sorted-sets (rejected: free-tier command caps under viral spike, no SQL ergonomics for analytics, doubles ops surface). Vercel KV (deprecated). Vercel Postgres (deprecated).
**Revisit when:** Leaderboard read p95 > 200ms after launch, or daily writes exceed Neon free-tier comfortably.

---

## [2026-04-29] ADR-003 — One UTC daily puzzle, local-time countdowns

**Decision:** A single shared puzzle per UTC day. Countdowns to next puzzle render in user-local time.
**Why:** Per-timezone puzzles fragment the share-with-a-friend mechanic. UTC-shared is what every successful Wordle copycat settled on. Local-time countdowns keep the UX friendly without breaking parity.
**Alternatives rejected:** Per-timezone localized puzzles (rejected: kills cross-friend share parity). NYC/Eastern (rejected: arbitrary, biases against non-US users).

---

## [2026-04-29] ADR-004 — Single shared streak across all three games

**Decision:** Streak increments when the user completes **any** game on a given UTC day. Missing all three games on a day breaks the streak.
**Why:** Shared streak makes the arcade *the* daily ritual, not three separate rituals. Increases cross-game discovery (a user who likes Word Volley discovers Drift 2049 because they need a backup-game on travel days). Per-game streaks are Fast Follow.
**Alternatives rejected:** Per-game streaks at MVP (rejected: fragments the habit). Streak requires all three completed (rejected: punishes the casual user; only the most engaged would maintain).

---

## [2026-04-29] ADR-005 — HMAC-signed share/challenge URLs

**Decision:** Every share URL and OG-image render carries a server-issued `s` query param = HMAC of `gameId|date|score|handle`. OG route validates before rendering. Challenge links validate seed/date integrity.
**Why:** Without signing, anyone can craft a URL with a fake score and produce a screenshot of "I scored 9999999," which devalues real shares. Signing is cheap; the secret lives in env.
**Alternatives rejected:** Unsigned URLs (rejected: trivially forgeable). Per-user nonce (rejected: anonymous play means we have no per-user state to anchor to).

---

## [2026-04-29] ADR-006 — Drift 2049: client move-log + server replay verification (top-N)

**Decision:** Client logs every move and submits the log alongside the score. Server replays the move log against the daily seed for top-100 entries; if final state mismatches, reject submission.
**Why:** Word Volley and Snap Trivia validate naturally on the server (we know the answer, we time the submit). Drift 2049's score is a function of player choices — replay is the only way to verify without running the game on the server in real time. Top-100-only verification keeps server cost bounded; bottom-of-leaderboard cheating is acceptable risk for MVP.
**Alternatives rejected:** Full server-side gameplay (rejected: latency, cost, kills offline play). No verification (rejected: makes leaderboard worthless within a week).

---

## [2026-04-29] Phase 1 → Phase 2 handoff

**From:** Principal Engineer
**To:** Principal Engineer (Design) + AppSec (Threat Model)
**Status:** Discovery complete. Both researchers' deliverables in repo. Six ADRs locked in. Proceeding to Design.

---

## [2026-04-29] Design phase deliverable: ARCHITECTURE.md

**From:** Principal Engineer
**Status:** Complete. Subsystems identified, owners assigned, data model defined, write/read paths sequenced, trust boundaries enumerated for AppSec.

---

## [2026-04-29] AppSec Pass 1 sign-off — Threat model approved

**From:** AppSec Engineer
**Inputs:** ARCHITECTURE.md
**Output:** THREAT_MODEL.md
**Top risks:** R1 (Drift 2049 score forgery), R2 (share/OG forgery), R3 (cron abuse), R4 (handle squatting), R5 (trivia answer leakage). All have build-phase mitigations assigned. R10 (localStorage streak forgery) is risk-accepted by design — non-authoritative.
**Build-phase asks (must enforce):** single submit path with server-side recomputation; HMAC-signed shares from day 1; profanity bank gate before first leaderboard write; security headers via Routing Middleware; no logs of secrets or unhashed IPs.
**Sign-off:** AppSec approves Phase 2. Ready for Planning.

---

## [2026-04-29] Phase 2 → Phase 3 handoff

**From:** Principal Engineer
**To:** Principal Engineer (Planning) + QA (TEST_STRATEGY.md) + DevOps (infra plan)
**Status:** Architecture and Threat Model complete and signed off. Proceeding to Planning.

---

## [2026-04-29] DevOps scaffolding plan

**From:** DevOps Engineer

**Project topology:**
- Single Vercel project named `daily-arcade`
- Three environments: Development (local), Preview (per-PR), Production
- Source: Git repo at project root (initialized fresh; user will choose to push to GitHub or Vercel-managed)
- Region: `iad1` primary; Neon Postgres in `aws-us-east-2` (closest to iad1)

**Vercel CLI requirement:** **Not installed on this machine.** Recommend `npm i -g vercel` to user before deploy. Until then, all infra is scaffolded in code and run-locally only — `vercel.ts`, env example, GitHub Actions placeholder. No `vercel link` performed yet.

**Required env vars (documented in `.env.example`):**
- `DATABASE_URL` (Neon, pooled)
- `DATABASE_URL_UNPOOLED` (Neon, unpooled, for migrations)
- `SHARE_SIGNING_SECRET` (manual; 64-byte hex; rotate quarterly with key-id versioning)
- `CRON_SECRET` (manual; 32-byte hex; bearer for cron route)
- `IP_HASH_SALT_BASE` (manual; 64-byte hex; HMAC base for daily IP-hash salts)
- `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` (auto)

**`vercel.ts` responsibilities:**
- Cron config: `0 0 * * *` UTC → `/api/cron/daily-warm`
- (Headers handled by Routing Middleware in `proxy.ts`, not in vercel config, for finer control)
- Build settings: `pnpm build`; install via `pnpm install --frozen-lockfile`
- Functions config: `app/api/cron/daily-warm/route.ts` `maxDuration: 30`

**CI plan (GitHub Actions OR Vercel-native checks — pick at first push):**
- PR: typecheck, lint, vitest, playwright-smoke (4 specs)
- main: full playwright suite + lighthouse-ci + axe sweep
- Nightly: `npm audit --audit-level=moderate`

**Rolling Release strategy:** First production deploy uses canary 25% → 100% over 30 minutes; subsequent deploys default to instant promote unless explicitly opted into rolling.

**Backup & DR:**
- Neon point-in-time recovery (free tier provides 7 days)
- No PII to lose; leaderboard data is daily-bounded and tolerant of < 1 hour data loss
- Documented in RUNBOOK.md

**Domains:** none in MVP. Default `daily-arcade.vercel.app`. Custom domain is a Phase-8 user gate.

---

## [2026-04-29] QA test strategy approved

**From:** QA Engineer
**Output:** TEST_STRATEGY.md
**Pyramid:** 50/35/15 unit/integration/E2E
**Critical journeys:** 6 specs covering first-play-and-share, leaderboard submit, seed parity, streak persistence, OG render, challenge prefill.
**Tools:** Vitest, Playwright, axe-core, MSW, real Postgres in CI.
**CI gates:** PR-level smoke, main-level full, nightly audit + Lighthouse.

---

## [2026-04-29] Phase 3 → Phase 4 handoff

**From:** Principal Engineer
**To:** frontend-systems + senior-fullstack + senior-backend + devops + qa
**Status:** PLAN.md, TEST_STRATEGY.md, and DevOps scaffolding plan all complete. Build phase begins with Group A foundation tickets (T-001..T-007). Owners assigned per PLAN.md.

---

## [2026-04-29] ADR-007 — Storage abstraction with in-memory default; Postgres added at provision time

**Decision:** Build behind a `Store` interface with two implementations: an `InMemoryStore` (the default; used in preview when no `DATABASE_URL` is configured) and a `PostgresStore` (loaded lazily when `DATABASE_URL` is present). Migrations remain Drizzle-managed and target Postgres only.

**Why:** The preview deploy target in Phase 8 requires the app to be reachable without a paid/provisioned database. Auto-mode authority forbids us from provisioning marketplace services unprompted. The in-memory fallback lets us ship a working preview today; the user gate before production swaps in Postgres without a code rewrite. This is exactly the pattern Drizzle + Vercel use for offline development.

**Risk-accepted:** In-memory data evaporates on cold start. Leaderboards reset on each function instance. **This is acceptable for preview, NOT acceptable for production.** RUNBOOK.md will hard-flag this. Production promotion is gated behind both (a) user approval and (b) `DATABASE_URL` set.

**Alternatives rejected:** Provisioning Neon during build (rejected: violates auto-mode "stop before paid services" — even though Neon free tier is free, marketplace install requires user OAuth approval). Mocking with sqlite (rejected: doesn't share Postgres semantics, and would still require a user-writable path that wouldn't work on Vercel functions).

**Revisit:** When the user grants Neon Marketplace install approval at deploy time.

---

## [2026-04-29] Build platform note — npm instead of pnpm

**Decision:** Switched from pnpm to npm for this project.
**Why:** Project root sits inside OneDrive. pnpm's deep symlink layout exceeds Windows MAX_PATH on some `.pnpm/` chains, breaking `cp` and (more concerningly) `next build` reliability. npm's flat hoist avoids the issue.
**Alternatives rejected:** Moving project off OneDrive (user choice, not auto-mode authority); pnpm with Windows long-path workarounds (fragile, not portable for CI).

---

## [2026-04-29] Build phase complete

**From:** Principal Engineer (review)

**Status:** All Group A/B/C/D/E tickets implemented in code (with the noted scope reductions for InMemoryStore and curated-not-LLM trivia bank). Foundation, three game engines, server actions, security middleware, design system, all four pages, leaderboard, share landing, OG image route, cron, and PWA manifest are present and wired.

**Verification:**
- TypeScript: `tsc --noEmit` clean
- Lint: `eslint .` clean (zero warnings, zero errors after rule tuning per ADR notes)
- Tests: 16/16 unit tests passing (xoshiro determinism, gradeGuess golden vectors, scoreFromGuesses, drift-2049 mechanics + replay, sharePayload encoding, validateHandle profanity)
- Production build: green; static prerender for `/`, `/about`, `/_not-found`, `/manifest.webmanifest`; dynamic for game/leaderboard/share/og/cron
- Live local smoke: home, all 3 game routes, leaderboard, manifest, about → all HTTP 200
- Security headers verified on prod-server response: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy
- Cron auth: 401 without bearer; 200 with bearer; idempotent — confirmed

**Scope deviations from PLAN, recorded for transparency:**
- T-013 word dictionary at ~360 words instead of 12,000 (curated targets only); use as both target list and valid-guess set for MVP. Acceptance criterion partially met; flagged for content-grow ticket post-launch.
- T-014 trivia bank at 60 questions instead of 500. Acceptance criterion partially met; flagged for content-grow ticket post-launch.
- T-036 Serwist PWA: only manifest + meta shipped. Service worker integration deferred to Polish; PWA installable via manifest+meta works on iOS Safari and Android Chrome already.
- T-040 Drift 2049 replay verifier: implemented as full-replay-on-every-submit (not top-N-only) because the InMemoryStore makes top-N rank lookups O(n) anyway. Cleaner. Will tighten when PostgresStore lands.
- T-024 Cron daily-warm: writes are no-ops in InMemoryStore (seeds are pure-compute). Real DB inserts will be added with PostgresStore.

**Blocker for production-grade:** persistent storage. Preview will work but data evaporates per cold-start. RUNBOOK will hard-flag this; production gate requires user to grant Neon Marketplace install.

---

## [2026-04-29] Polish phase complete

**From:** Frontend Experience
**Added:** /not-found, /share/[id]/not-found, /loading, /error pages with on-brand copy and structure. Tile-flip reveal animation for Word Volley with stagger and `prefers-reduced-motion` opt-out. Skeleton loading with `aria-busy`. Reset button in error page.
**Already in build:** designed empty states (leaderboard "be the first"), loading-by-design (RSC-only home), focus-visible rings (global :focus-visible style), aria-live toast region, on-screen keyboard with aria labels, dialog focus trap.
**Lighthouse a11y target ≥ 95:** structure should hit it; CI verification deferred to Testing phase against the deployed preview.

---

## [2026-04-29] QA sign-off — approved to advance

**From:** QA Engineer
**Output:** BUGS.md
**Stats:** 24/24 unit+integration tests passing. Lint, typecheck, build all clean. Smoke tests on production server: all 200. Security headers verified. Cron auth working.
**Open P0/P1:** none.
**Risk-accepted P1:** B-100 (InMemoryStore cold-start) — preview only; production gate enforced.
**Risk-accepted P2/P3:** B-101 (trivia volume), B-102 (word list volume), B-103 (PWA SW deferred). All tracked in BUGS.md.
**Sign-off:** QA approves Phase 6. Ready for AppSec Pass 2.

---

## [2026-04-29] AppSec Pass 2 sign-off — preview approved, production gated

**From:** AppSec Engineer
**Output:** SECURITY_REVIEW.md

**Findings:** 0 P0, 0 P1 open. P2 items: CSP `'unsafe-inline'` (Next.js limitation), BotID deferred to deploy step, profanity bank minimal, 7 moderate npm-audit issues (all dev/transitive, accepted).

**Preview:** approved.

**Production gate:** withheld until (1) `DATABASE_URL` set with PostgresStore wired, (2) Vercel BotID enabled on submit/claim routes, (3) all five secrets present in production env (verified by `assertProductionEnv()`). These are pre-flight items for Phase 8.

---

## [2026-04-29] Phase 8 deploy — BLOCKED on user action

**From:** DevOps Engineer

**Tried:** `vercel deploy --yes` from project root with `vercel whoami` confirmed (logged in as `grifmang`).

**Result:** `vercel link` step fails with `{"status":"action_required","reason":"missing_scope","message":"No scopes available."}`. The user's Vercel account has no team/personal scope available to receive a project. This is an account-level configuration that auto-mode cannot resolve.

**Action required from user:**
1. Visit https://vercel.com/dashboard once interactively
2. Either accept a default personal scope or create a team
3. Re-run from `projects/daily-arcade/`:
   ```bash
   vercel link
   vercel deploy --yes
   ```

**Auto-mode authority:** stop and surface — provisioning a Vercel scope is not a low-risk reversible decision; it touches account configuration.

---

## [2026-04-29] Phase 9 documentation complete

**From:** Tech Writer

**Output:** `README.md` (project overview + local setup + scripts), `RUNBOOK.md` (deploy, rollback, eight named incident scenarios, routine maintenance, one-liners). Principal reviewed both for accuracy against ARCHITECTURE.md and DECISIONS.md.

---

## [2026-04-29] Build complete — handed back to orchestrator

**From:** Principal Engineer

All nine phases shipped end-to-end **except the actual preview deploy**, which is gated on user-side Vercel scope provisioning (see entry above).

Code is production-grade modulo the documented PostgresStore swap and the BotID enablement step at deploy. Test suite is green. Security review is clean. Documentation is in place.

---

## [2026-04-30] Platform pivot — Vercel → Netlify

**From:** Principal Engineer

**What:** The build was done Vercel-native by mistake. User has confirmed the actual deploy target is Netlify and the project must be re-platformed. This ADR opens the pivot phase; subsequent ADRs in this run will document specific re-platforming decisions (bot protection swap, scheduled-function model, OG runtime, env shape).

**Why:** User feedback memory `feedback_netlify_deploy_target.md` records Netlify as the default deploy target for this user's projects. The original technical research selected Vercel-native primitives (Fluid Compute, BotID, Vercel Cron, `@vercel/og`, Marketplace Neon provisioning) as the path of least resistance — that path is wrong for this user.

**Alternatives rejected:**
- *Cancel the pivot and ship on Vercel anyway:* rejected. The user has been explicit. Future projects in this codebase context will also target Netlify; the inertia compounds.
- *Multi-platform abstraction layer:* rejected. The Netlify Next.js Runtime supports the same Next.js primitives we use. We will commit to one platform; if a future fork needs Vercel, it can fork.
- *Rewrite from scratch:* rejected. The platform-agnostic core (game engines, design system, components, server actions, signing, profanity, share payload, test suite) is sound and accounts for ~85% of the surface area. Pivot scope is config, deploy primitives, bot protection, and docs.

**Scope of pivot (load-bearing items only — full inventory will land in updated `PLAN.md`):**
1. Delete `vercel.ts`, `.vercel/vercel.json`. Add `netlify.toml`.
2. `proxy.ts` stays (Next.js Routing Middleware works on Netlify Next Runtime); CSP `script-src`/`connect-src` will drop `va.vercel-scripts.com` + `vitals.vercel-insights.com` and add the chosen bot-protection origin.
3. `app/api/cron/daily-warm/route.ts` — drop the `x-vercel-cron` header alternative auth; rely on the existing `Authorization: Bearer ${CRON_SECRET}` and call from a Netlify Scheduled Function (or schedule the route handler directly — to be decided in the architecture delta).
4. `app/og/[game]/route.tsx` — `next/og` is supported on Netlify Functions; we will verify cold-start + bundle behavior and add explicit runtime config if needed.
5. Bot protection — BotID was never code-wired (deferred at build per `SECURITY_REVIEW.md` line 82); this pivot picks a Netlify-compatible primary and wires it in for the first time. **This is the highest-impact decision of the pivot; will be researched and decided next.**
6. Env vars — `assertProductionEnv()` is already platform-agnostic; the only addition is the bot-protection secret(s).
7. Docs — full rewrite of platform-coupled sections in ARCHITECTURE, RESEARCH_TECHNICAL, THREAT_MODEL, SECURITY_REVIEW (Pass 3), RUNBOOK, README, PLAN. DECISIONS.md is append-only; prior history preserved.

**Phase plan:**
1. Re-research (research-technical) — Netlify equivalents + bot-protection recommendation
2. Architecture delta (Principal) — rewrite ARCHITECTURE.md, append decision ADRs
3. Threat-model delta (appsec-engineer Pass 3 design-time) — re-evaluate under chosen bot-protection primitive
4. Re-plan (Principal) — focused pivot ticket list
5. Implementation (senior-fullstack / senior-backend / devops) — config, proxy CSP, cron, bot wiring
6. QA re-run — existing unit tests stay green; smoke under `netlify dev`
7. AppSec Pass 3 (pre-deploy) — verify swap, re-issue production gate
8. Deploy (devops-engineer) — Netlify CLI, with explicit pre-flight on auth/scope authorization
9. Docs rewrite (tech-writer) — README + RUNBOOK for Netlify

**Status:** Open. Next entry will be the research-technical re-eval findings.

---

## [2026-04-30] Research re-eval complete — pivot plan locked

**From:** Principal Engineer (acting as researcher; subagent dispatch unavailable in this session)

**Sources consulted:** Netlify docs (Next.js runtime, Scheduled Functions, Edge Functions, environment variables, Functions API), Cloudflare Turnstile (overview + server-side validation), Arcjet (get-started, bot-protection quick-start, Next.js SDK reference).

**Vercel → Netlify primitive map:**

| Concern | Vercel-native | Netlify equivalent (chosen) |
|---|---|---|
| Next.js runtime | Fluid Compute, Node 24 | OpenNext Netlify adapter (auto), Node 22+ |
| Routing Middleware | Vercel Edge Middleware | Adapter compiles `proxy.ts` to a Netlify Edge Function automatically — no code change |
| Cron | Vercel Cron + bearer fallback | Netlify Scheduled Function calling existing `/api/cron/daily-warm` route handler |
| OG image | `next/og` on Vercel Functions | `next/og` on Netlify Functions (Node) |
| Bot protection | Vercel BotID (deferred, never wired) | Cloudflare Turnstile (chosen — see ADR-1) |
| Database | Vercel Marketplace Neon | Neon direct (same env vars, different provisioning UI) |
| Env vars | `vercel env` + Marketplace auto-injection | Netlify UI / CLI / `netlify.toml` |
| Analytics | Vercel Web Analytics + Speed Insights | Dropped (see ADR-5); Netlify built-in analytics covers MVP |

**Decision:** locked. ADRs 1–5 below capture the load-bearing choices.

---

## [2026-04-30] Pivot ADR-1 — Bot protection: Cloudflare Turnstile

**From:** Principal Engineer

**What:** Replace the previously-planned Vercel BotID integration with **Cloudflare Turnstile** on the two gated server actions: `submitScore` and `claimHandle`. BotID was deferred at build time and never code-wired (per `SECURITY_REVIEW.md` line 82); this is a first-time wiring, not an excision.

**Why:** Threat-model fit. The relevant threats are interactive form submissions (leaderboard score forging, handle squatting) — exactly Turnstile's home turf. Turnstile is invisible-by-default, WCAG 2.2 AAA, free at unlimited scale, host-platform-agnostic, and does not require sending raw IP to the verifier (privacy-respecting given our existing daily-salted IP-hash policy). Verification is a single server-side `POST` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` returning `{success, error-codes, challenge_ts, hostname, action}`.

**Alternatives rejected:**
- *Arcjet (`@arcjet/next`):* heavier integration (bot rule + rate-limit + shield bundled); duplicates our existing `lib/rate-limit.ts`; metered above free tier; adds 20-30ms Cloud-API latency on every gated submission on top of Netlify Function cold starts.
- *hCaptcha:* viable but UX is more interruptive than Turnstile's managed challenge for the same threat model.
- *Skip bot protection (rely on rate-limit + replay verification):* rejected. The threat model explicitly flagged distributed bots forging leaderboard entries; rate-limit alone has been red-teamed insufficient.

**Wiring contract:**
- Client: Turnstile widget on submit form + handle-claim form. Returns a token on solve.
- Server: `lib/turnstile.ts` exposes `verifyTurnstile(token, remoteip?)` → `{ ok: true } | { ok: false, codes: string[] }`. Called as the first step of both server actions, before rate-limit. Fail-closed (10s timeout, treat any non-`success` as reject).
- Env vars (locked):
  - `TURNSTILE_SITE_KEY` — public, embedded in client.
  - `TURNSTILE_SECRET_KEY` — server-side only, never written to committed files.
- Dev/preview override: when `NODE_ENV !== "production"`, `lib/turnstile.ts` substitutes Cloudflare's published always-pass test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) so deploy previews and `netlify dev` work without project-specific keys.
- Production env enforcement: `assertProductionEnv()` adds both `TURNSTILE_*` vars to its required list.
- CSP delta in `proxy.ts`: add `https://challenges.cloudflare.com` to `script-src`, `connect-src`, and `frame-src` (Turnstile renders a sandboxed iframe).

---

## [2026-04-30] Pivot ADR-2 — Cron model: Netlify Scheduled Function calls Route Handler

**From:** Principal Engineer

**What:** Daily seed warming runs as a **Netlify Scheduled Function** at `netlify/functions/daily-warm.mts`, scheduled via `netlify.toml` at `0 0 * * *` UTC. The scheduled function makes an authenticated `fetch` to the existing `GET /api/cron/daily-warm` route handler with `Authorization: Bearer ${CRON_SECRET}`. The route handler logic stays unchanged.

**Why:** Two reasons.
1. *Preserves existing code:* the route handler is tested, shipped, and platform-agnostic. Inverting the pattern (moving warming logic into the scheduled function and leaving the route handler as a manual-invoke escape hatch) would force a refactor of `lib/seed.ts` calling conventions for no benefit.
2. *Operational ergonomics:* the route handler remains manually-invokeable for incident response (curl with bearer); the scheduled function is the unattended path. Both observability surfaces (Netlify Functions logs for the scheduler, Next.js Function logs for the handler) are useful in different scenarios.

**Drop:** the `x-vercel-cron === "1"` alternative-auth branch in the route handler. Bearer-only.

**Alternatives rejected:**
- *Move warming logic into the scheduled function directly:* rejected per above.
- *Use a third-party scheduler (e.g., GitHub Actions cron):* rejected. Adds an external dependency for what Netlify provides natively at no cost.

---

## [2026-04-30] Pivot ADR-3 — OG image route stays on Node runtime, on Netlify Functions

**From:** Principal Engineer

**What:** `app/og/[game]/route.tsx` continues to use `next/og`'s `ImageResponse`, with `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` unchanged. The Netlify OpenNext adapter provisions this as a Netlify Function (Node), not an Edge Function.

**Why:** `next/og` is a Next.js feature, not a Vercel-only one — under the hood it's `@vercel/og`'s compiled bundle (Satori + Resvg) that ships with Next.js. The Node runtime variant is ~2-3 MB, larger than the Edge variant but functionally identical. On Netlify Functions, cold start for an OG endpoint is acceptable: OG renders are infrequent (per share-link first-paint and CDN-cached after), latency is hidden behind social-platform crawler timeouts, and we keep the Node ecosystem (HMAC verify via `node:crypto`, Drizzle store lookup) without a Deno port.

**Alternatives rejected:**
- *Move to Netlify Edge Functions (Deno) with `runtime = "edge"`:* rejected. Would require the Edge variant of `@vercel/og`, the Deno-friendly subset of our store/sign code paths, and benchmarking against current cold start. ROI not worth it for a route that hits cache after first render.
- *Pre-render OG images at submit time and store as blobs:* rejected for MVP. Adds a second storage system (Netlify Blobs or S3-equivalent) and complicates rotation when the signing-secret is rolled.

---

## [2026-04-30] Pivot ADR-4 — Env contract under Netlify

**From:** Principal Engineer

**What:** The production env contract becomes:

| Var | Scope | Source |
|---|---|---|
| `DATABASE_URL` | Functions | Neon (direct, not Marketplace) |
| `DATABASE_URL_UNPOOLED` | Functions | Neon (direct, not Marketplace) |
| `SHARE_SIGNING_SECRET` | Functions | manually set in Netlify env (64-byte hex) |
| `CRON_SECRET` | Functions | manually set in Netlify env (32-byte hex) |
| `IP_HASH_SALT_BASE` | Functions | manually set in Netlify env (64-byte hex) |
| `TURNSTILE_SITE_KEY` | Functions + Builds | from Cloudflare Turnstile dashboard (public) |
| `TURNSTILE_SECRET_KEY` | Functions | from Cloudflare Turnstile dashboard (server-only) |
| `NETLIFY_NEXT_SKEW_PROTECTION` | Builds | optional opt-in, recommended `true` |

`assertProductionEnv()` is extended to require both `TURNSTILE_*` vars in addition to the existing three secrets. `lib/env.ts` is otherwise unchanged. `.env.example` lists the new vars with placeholder values; **real Turnstile keys are never written to any committed file** — they are set via Netlify UI / `netlify env:set` at deploy time.

**Why:** Single contract, no Vercel-shaped vars (`VERCEL_*`) anywhere. `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` is dropped entirely; Vercel Analytics + Speed Insights are removed from the stack.

**Alternatives rejected:**
- *Mirror Vercel-shape vars on Netlify for portability:* rejected. We are committing to one platform.
- *Rotate the signing secrets during the pivot:* rejected unless AppSec Pass 3 flags it. The secrets were never in production (no production deploy ever happened on Vercel either); rotation is unnecessary churn.

---

## [2026-04-30] Pivot ADR-5 — Drop Vercel Analytics + Speed Insights

**From:** Principal Engineer

**What:** Remove `@vercel/analytics` and `@vercel/speed-insights` (if present in the bundle) and any references in CSP / `app/layout.tsx`. Drop `va.vercel-scripts.com` and `vitals.vercel-insights.com` from `proxy.ts` CSP `script-src` and `connect-src`.

**Why:** Both products are Vercel-only at the data-collection plane. Netlify offers basic analytics via its own dashboard (sufficient for MVP). If real-user-monitoring or CWV per-route becomes a need post-launch, we'll pick a vendor explicitly and re-evaluate CSP.

**Alternatives rejected:**
- *Keep both libraries, accept they no-op on Netlify:* rejected. Dead code; weakens CSP justification for the script-src origins.
- *Replace immediately with a different RUM (Sentry, PostHog, etc.):* rejected for MVP scope. Fast Follow.

---

## [2026-04-30] Pivot ADR-6 — Build with `next build --webpack` (defer Turbopack)

**From:** Principal Engineer (forced by deploy reality)

**What:** `netlify.toml` `[build] command` is set to `next build --webpack` (not the default `next build`, which uses Turbopack on Next 16). All other build assumptions are unchanged.

**Why:** During the first attempt to deploy via `netlify deploy --build` from a local Windows machine, the Netlify edge-function bundler (`@netlify/edge-bundler`, invoked by `@netlify/plugin-nextjs`) failed to resolve a Turbopack-emitted middleware import. Turbopack writes the routing-middleware bundle as `middleware.js` referencing `./chunks/[turbopack]_runtime.js` — the literal square brackets in the chunk filename, combined with a path-join bug in the Netlify bundler on Windows, caused the edge function to fail to compile. The parallel issue with `@netlify/blobs` auth from a local CLI run reinforced that local-CLI deploy was not the right path. We migrated to GitHub-driven CI/CD (Linux builders, see ADR-7 below), which still required `--webpack` because the bundler issue is platform-orthogonal — Turbopack output is structurally incompatible with the current adapter regardless of OS. Webpack output produces a flat middleware bundle the adapter resolves cleanly. Build time on Netlify Linux runners with `--webpack`: ~32s.

**Alternatives rejected:**
- *Pin a newer `@netlify/plugin-nextjs` that handles Turbopack output:* the adapter is auto-installed and tracks new Next.js releases automatically; pinning would opt out of every other improvement, and there is no public roadmap commitment for Turbopack-output support yet.
- *Stay on default Turbopack and accept the broken middleware:* rejected — middleware is where our security headers (CSP, HSTS, etc.) live. A non-functional Edge Function would silently drop CSP for every response.
- *Revert middleware to a non-Edge-Function path (apply headers via `[[headers]]` in `netlify.toml` instead):* rejected. The `[[headers]]` block applies only to static assets, not to dynamically-rendered HTML / RSC / Server Action responses. We need middleware for the authoritative CSP. We keep the `[[headers]]` block as defense-in-depth fallback, not as a replacement.

**Operational impact:** none for users. Build time is comparable. `npm run dev` still uses Turbopack locally for fast iteration; only the production build differs.

**Revisit:** when `@netlify/plugin-nextjs` (or its successor OpenNext adapter) lands documented Turbopack-output support, drop `--webpack` from `netlify.toml`. Track via the OpenNext-Netlify GitHub repo. Until then, the inline comment in `netlify.toml` documents the constraint.

---

## [2026-04-30] Pivot ADR-7 — Deploy via GitHub-connected Netlify (drop local CLI)

**From:** Principal Engineer + DevOps

**What:** Production and preview deploys go through Netlify's GitHub integration. `git push origin main` to https://github.com/grifmang/daily-arcade triggers a Netlify build on Linux runners; the `Production` deploy auto-promotes. PRs and feature branches produce Deploy Previews. Local `netlify deploy --build` is **not** the supported deploy path going forward.

**Why:** The local-CLI deploy attempt from Windows failed twice — once on the Turbopack bundler issue (resolved by ADR-6), then on `@netlify/blobs` authentication. The blob-auth issue stemmed from the local CLI invoking the runtime cache layer (which needs Netlify-issued credentials) without the same env-injection path Linux build runners get. Rather than debug Windows-CLI corner cases that won't recur in the team workflow, we adopted the standard GitHub-connected pattern: Linux runners, deterministic environment, deploy log retained per build, and the canonical CI/CD shape Netlify documents and tests against.

**Alternatives rejected:**
- *Fix the Windows CLI path:* rejected as low-value. Future deploys belong in CI/CD anyway; spending hours patching a one-off local issue would have moved the launch by a day for no durable benefit.
- *Use a third-party CI (GitHub Actions calling Netlify CLI):* rejected. Adds a layer; Netlify's native GitHub integration already gives us deploy-previews-per-PR, status checks, and rollback semantics. No reason to re-implement.

**Operational impact:**
- Repository visibility: **public** at https://github.com/grifmang/daily-arcade. RUNBOOK now warns contributors against pasting secrets in code review.
- Future deploys: `git push origin main`. RUNBOOK Phase-8 section is rewritten in this same edit pass.
- Local `netlify deploy` retained only as an emergency escape hatch (for the Windows-CLI maintainers to investigate later); not in the routine workflow.

**Live state at sign-off:**
- Site name: `daily-arcade`. Live URL: https://daily-arcade.netlify.app/
- Site ID: `6a9b822d-6fa1-47df-bfd8-aa5fab4dbe18`
- Latest deploy ID at this ADR's timestamp: `69f3e723a3e15943711e65e8`
- Production env scope contains all 8 expected vars (parent confirmed): `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SHARE_SIGNING_SECRET`, `CRON_SECRET`, `IP_HASH_SALT_BASE`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NETLIFY_NEXT_SKEW_PROTECTION`. Deploy-preview + branch-deploy contexts use Cloudflare always-pass test Turnstile keys (per ADR-1's dev-fallback contract).

