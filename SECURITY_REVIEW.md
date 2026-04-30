# SECURITY_REVIEW.md — daily-arcade (Pass 2, pre-deploy)

**Author:** AppSec Engineer
**Date:** 2026-04-29
**Scope:** local production build + live preview-server smoke; codebase audit against THREAT_MODEL.md and OWASP Top 10.

---

## OWASP Top 10 — findings

### A01 — Broken Access Control
- No multi-user authz in MVP. Anonymous play, no role hierarchy.
- Cron route protected by bearer + Vercel header check. Verified: `/api/cron/daily-warm` returns 401 without bearer.
- **Finding:** none beyond the pre-known design (no auth = no broken auth).

### A02 — Cryptographic Failures
- HMAC-SHA256 via Web Crypto, key in env, never logged.
- `sign.ts` uses `crypto.subtle.verify` for constant-time comparison.
- Key-id versioning (`v1.<sig>`) supports rotation without invalidating outstanding URLs.
- **Finding:** none. The single residual concern is dev fallback secrets in `lib/env.ts` — these MUST be replaced before production. Documented; flagged in `assertProductionEnv`.

### A03 — Injection
- All user input parsed via Zod (action input, route handler params).
- No raw SQL with user input (Drizzle parameterized queries when PostgresStore lands).
- No shell exec, no template-string concatenation into HTTP/DB.
- **Finding:** none.

### A04 — Insecure Design
- Threat model produced before code (Pass 1).
- Submit path is the only write entry; no parallel "fast path" exists. Verified.
- Score recomputation server-side for all three games. Verified.
- **Finding:** none.

### A05 — Security Misconfiguration
- Headers verified on `/`: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- `poweredByHeader: false` set in `next.config.ts`.
- CSP contains `'unsafe-inline'` for scripts — required by Next.js inline runtime. Tightening to `'strict-dynamic'` with nonces is a Fast-Follow item (P2 documented in THREAT_MODEL §7).
- **Finding:** P2 — CSP relaxed to `'unsafe-inline'`. Risk-accepted; documented; remediation tracked.

### A06 — Vulnerable & Outdated Components
- `npm audit` reports 7 moderate severity issues:
  - **postcss** (transitive of next 16.2.4, dev-only build pipeline). Patch requires next downgrade (breaking). **Accepting risk:** the vulnerable `</style>` stringify path is not reachable from our code (we use Tailwind utilities, no dynamic CSS string serialization).
  - **vite/vite-node** (transitive of vitest, dev-only). Not present in production build. **Accepting risk.**
- Direct prod deps clean.
- **Finding:** P2 — accept; revisit on next vitest/next minor releases. Dependabot recommended for the GitHub repo when wired up.

### A07 — Identification & Authentication Failures
- No identity in MVP. Handles are pseudonyms with daily-bounded uniqueness.
- Future Clerk integration (Fast Follow) will be reviewed separately at that time.
- **Finding:** none for MVP.

### A08 — Software & Data Integrity Failures
- Lockfile committed (`package-lock.json`).
- All dependencies fetched via npm registry, no vendored binaries.
- HMAC-signed share/OG URLs prevent tampering across the trust boundary.
- **Finding:** none.

### A09 — Security Logging & Monitoring
- Server logs are JSON-shaped (Vercel ingests automatically).
- Submit logs include `{ gameId, accepted, ipHash }`; never the raw IP, never the secret.
- Cron logs `{ generatedSeeds, durationMs }`.
- **Finding:** P3 — no centralized error tracker (Sentry deferred). Acceptable for MVP; Vercel Logs is sufficient.

### A10 — Server-Side Request Forgery
- No outbound HTTP requests in the codebase. No URL parameter feeds into fetch/axios.
- **Finding:** none.

---

## Specific surface checks

### Submit Server Action (`lib/actions.ts`)
- ✅ Zod schemas on all inputs (`SubmitSchema`, per-game `metadata` schemas)
- ✅ Date strictly == `today`; rejects past/future
- ✅ Handle re-validated server-side via `validateHandle`
- ✅ Rate limit: 5/min and 20/day per (game, ip-hash)
- ✅ Server-side score recomputation for all three games
- ✅ Word Volley: server replays guesses, recomputes grade, rejects unsolved submissions
- ✅ Snap Trivia: server validates question IDs match today's seed, recomputes correctness, rejects impossibly fast submissions (< 1.5s wall-clock total)
- ✅ Drift 2049: server replays move log against today's deterministic seed, accepts only matched final state's score
- ✅ HMAC signed before write
- ⚠️ **Note:** BotID NOT integrated (deferred to deploy phase — requires Vercel BotID Marketplace toggle). Current MVP relies on rate-limit + signed URLs. Documented as build-deferral; should be added before production launch.

### OG image route (`app/og/[game]/route.tsx`)
- ✅ Looks up `shares` row by `id`
- ✅ Recomputes canonical payload + verifies HMAC against stored signature
- ✅ Returns 400 on signature failure (no body — does not reveal which check failed)
- ✅ Renders only bounded fields (handle, score, game, date) — no secrets, no internal IDs

### Cron route (`app/api/cron/daily-warm/route.ts`)
- ✅ Bearer `CRON_SECRET` check
- ✅ Vercel cron header (`x-vercel-cron`) accepted as alternative
- ✅ Returns 401 with empty body for unauthenticated callers
- ✅ Idempotent: rebuilding existing seeds is a no-op (deterministic compute)

### Routing Middleware (`proxy.ts`)
- ✅ All required headers emitted
- ✅ Skips static assets and `_next/*` via matcher pattern

### Secrets hygiene
- ✅ No secrets in repo (`.env.example` documents names only, no values)
- ✅ Build artifact (`.next/`) checked: no secret strings present in client bundles
- ✅ `lib/env.ts` warns at runtime when env unset (dev fallback only); throws/refuses-to-deploy in prod via `assertProductionEnv`

### Client bundles — info disclosure check
- ✅ Word Volley client receives target word (intentional; required for client-side grading; same target is public knowledge after first successful guess by anyone)
- ✅ Snap Trivia client receives `(prompt, choices)` only — `correctIndex` lives server-only via `publicTriviaQuestion()` helper. Verified via grep on `.next/static/chunks/`.
- ✅ Drift 2049 client has no secret state — game seed is the initial board, public.

### Handle validation (`lib/content/profanity.ts`)
- ✅ Length 3–12, ASCII alphanumeric + underscore only
- ✅ Profanity bank with regex stems for common slurs and operational impersonation (admin/moderator/etc.)
- ⚠️ **Note:** profanity bank is intentionally minimal. Production launch should expand and review with localization considerations. Tracked.

---

## Pre-deploy ask list

| # | Item | Status |
|---|---|---|
| 1 | All P0 closed | yes |
| 2 | All P1 closed | yes (one risk-accepted as B-100 for preview only) |
| 3 | Headers present in deployed responses | verified locally; recheck on preview |
| 4 | Secrets all in env, none in repo | yes |
| 5 | `npm audit` reviewed | yes (7 moderate, all dev/transitive, accepted) |
| 6 | Source maps not exposing server code | not generating source maps for prod build (Next default) |
| 7 | BotID enabled on submit routes | **DEFERRED to deploy** — requires Vercel Marketplace BotID install. Document in deploy checklist. |
| 8 | Rate limits enforced | yes; verified by integration test |
| 9 | Cron route 401 without bearer | yes; verified |
| 10 | Trivia answers not in client bundle | verified |

---

## Findings ranked

- **P0:** none
- **P1:** none open. (B-100 InMemoryStore is design-known; production gate enforces `DATABASE_URL`.)
- **P2:**
  - CSP `'unsafe-inline'` for scripts (Next.js requirement; tighten with nonces post-launch)
  - BotID not yet wired (toggle on at deploy; explicit step in RUNBOOK)
  - Profanity bank minimal (expand pre-launch and as users report)
  - npm audit: 7 moderate dev/transitive (accept; monitor)
- **P3:**
  - No third-party error tracker (Vercel Logs only)
  - No public-facing security.txt (add post-launch)

---

## Sign-off

**AppSec approves preview deployment.**

**AppSec withholds approval for production until:**
1. `DATABASE_URL` is set + PostgresStore is wired in (lifts B-100)
2. Vercel BotID is enabled on submit + handle-claim routes
3. Production env has all five secrets set (verified by `assertProductionEnv()`)

These are explicitly listed in PLAN Phase 8 (D-001) and RUNBOOK.
