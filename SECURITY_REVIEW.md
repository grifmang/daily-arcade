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

---
---

# Pass 3 — Runtime audit, post-Netlify pivot (2026-04-30)

**Author:** AppSec Engineer (Pass 3 — Runtime, post-pivot)
**Date:** 2026-04-30
**Scope:** **live deployed site** at https://daily-arcade.netlify.app/ (Site ID `6a9b822d-6fa1-47df-bfd8-aa5fab4dbe18`, deploy `69f3e723a3e15943711e65e8`). This pass replaces the BotID + Vercel-env items from Pass 2's gate list with their Netlify + Cloudflare Turnstile equivalents, and adds runtime checks against the actual production responses.

## P3 — What's checked vs. Pass 2

| Pass-2 gate item | Pass-3 disposition |
|---|---|
| (1) `DATABASE_URL` set + PostgresStore wired | **STILL OPEN.** PostgresStore is not yet wired in `lib/store.ts`; the live site uses `InMemoryStore`. This blocks production-grade approval. The current deploy is preview-grade only. |
| (2) Vercel BotID enabled | **REPLACED.** BotID is gone. Cloudflare Turnstile is wired in `lib/turnstile.ts` + `submitScore` + `claimHandle` and is verified live (CSP permits `https://challenges.cloudflare.com`; production site key embedded in game-page HTML; secret key absent from all bundles). |
| (3) Production env has all five secrets | **EXPANDED + SATISFIED.** Production env now has eight: the original five (`SHARE_SIGNING_SECRET`, `CRON_SECRET`, `IP_HASH_SALT_BASE`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`) plus three new (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `NETLIFY_NEXT_SKEW_PROTECTION`). Parent has confirmed all eight present in Production scope. `assertProductionEnv()` updated accordingly (lib/env.ts). |

## P3.1 — Headers audit (live)

Tested via `curl -I` on every required surface. All routes carry the full security-header set with one exception captured below.

| Route | CSP | HSTS | X-Frame-Options | X-Content-Type-Options | Referrer-Policy | Permissions-Policy |
|---|---|---|---|---|---|---|
| `/` | ✓ | ✓ | DENY | nosniff | strict-origin-when-cross-origin | minimal |
| `/g/word-volley` | ✓ | ✓ | DENY | nosniff | ✓ | ✓ |
| `/g/drift-2049` | ✓ | ✓ | DENY | nosniff | ✓ | ✓ |
| `/g/snap-trivia` | ✓ | ✓ | DENY | nosniff | ✓ | ✓ |
| `/leaderboard/word-volley` | ✓ | ✓ | DENY | nosniff | ✓ | ✓ |
| `/about` | ✓ | ✓ | DENY | nosniff | ✓ | ✓ |
| `/og/word-volley?id=fake` | ✓ | ✓ | DENY | nosniff | ✓ | ✓ |
| `/share/notarealid` (404) | ✓ | ✓ | DENY | nosniff | ✓ | ✓ |
| `/api/cron/daily-warm` | ✓ | ✓ | DENY | nosniff | ✓ | ✓ |
| `/_next/static/...css` | (n/a) | ✓ | DENY | nosniff | ✓ | ✓ |
| `/manifest.webmanifest` | **MISSING (F1)** | ✓ | **MISSING** | nosniff | **MISSING** | **MISSING** |

**Live CSP (verified on `/`):**
```
default-src 'self';
script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://challenges.cloudflare.com;
frame-src https://challenges.cloudflare.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

This matches the local `proxy.ts` exactly. No `va.vercel-scripts.com` or `vitals.vercel-insights.com` origins are present anywhere — the analytics drop from ADR-5 took effect.

### F1 — `/manifest.webmanifest` missing four security headers (PATCHED, awaiting redeploy)

**Severity:** P2.
**Description:** The middleware matcher in `proxy.ts` deliberately excluded `manifest.webmanifest` (the file is build-time static and the headers were considered low-value for a JSON manifest). On Netlify, this means CSP / X-Frame-Options / Referrer-Policy / Permissions-Policy are absent on this route. The `[[headers]]` block in `netlify.toml` declares these but Netlify's CDN does not consistently apply the full block to dynamically-served Next.js routes; HSTS and X-Content-Type-Options survive (they're Netlify CDN-default for HTTPS sites), the others do not.
**Risk:** low practical risk — the manifest body is a static JSON document with no scripts, no DOM. But the CSP gap is a defense-in-depth regression and the audit is not allowed to leave it open without a remediation plan.
**Patch:** removed `manifest.webmanifest` from the `proxy.ts` matcher exclusion list. The middleware now applies to this route on the next deploy. Verification step: after the next push to `main`, re-run the header-audit one-liner from RUNBOOK; manifest must show the full set.
**Status:** patched in code; **awaiting redeploy** (this AppSec re-audit will close the finding once the post-deploy header check passes).

### F2 — HSTS max-age trimmed by Netlify (informational)

**Severity:** Info.
**Description:** Local `proxy.ts` and `netlify.toml` both declare `max-age=63072000` (2 years). The live response shows `max-age=31536000` (1 year). This is Netlify's CDN injecting its platform-default HSTS for `*.netlify.app` and overriding our header.
**Risk:** none. 1 year is RFC 6797–compliant and well above the 6-month minimum for hstspreload.org submission. Netlify's HSTS is `includeSubDomains; preload`-equivalent.
**Status:** informational. Documented here. We will not fight Netlify on this; if a custom domain is attached later, our 2-year value will likely apply (Netlify's automatic HSTS is scoped to its subdomain pool).

## P3.2 — Turnstile widget live verification

- **CSP permits the script + iframe origin.** Verified via the live CSP header on `/` and game routes; `https://challenges.cloudflare.com` appears in `script-src`, `connect-src`, and `frame-src`.
- **Production site key is embedded in game-page HTML.** Curling `/g/word-volley` and grepping reveals `0x4AAAAAADGmVuKU_ynym8wp` — that's the public Cloudflare site key, expected and required for the widget to render. The Cloudflare-published always-pass test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) are **absent** from production HTML, confirming the production env is wired correctly.
- **Widget cannot be header-tested without browser interaction** (the script loads on dialog open, not on initial page render). The parent's in-browser smoke confirmed the widget loads and submissions succeed; AppSec accepts that as sufficient end-to-end evidence.

## P3.3 — Cron auth boundary (live)

Tested four negative paths against `https://daily-arcade.netlify.app/api/cron/daily-warm`:

| Scenario | Expected | Actual |
|---|---|---|
| No `Authorization` header | 401, empty body | 401, 0 bytes ✓ |
| Wrong bearer (`Bearer obviously-wrong-secret`) | 401 | 401 ✓ |
| Malformed `Authorization` (`notbearer xyz`) | 401 | 401 ✓ |
| Empty `Authorization` header | 401 | 401 ✓ |

The 200-with-correct-bearer path is verified by inspection of the route handler (only one branch returns 200, gated solely on `auth === \`Bearer ${env.cronSecret}\``); the live `CRON_SECRET` is not held by AppSec by design and is not in scope to test from outside.

## P3.4 — Skew protection (live)

Verified on `/` and `/g/word-volley`: asset URLs include the `dpl=...` deploy-id query parameter, indicating `NETLIFY_NEXT_SKEW_PROTECTION=true` is taking effect. Sample deploy ID observed: `dpl=797a404815047957b4b3767aa3f4cccb5dacc351d3c45edc40de387a2155c7ed363966336537323361336531353934333731316536356538` (the latter half is hex-encoded).

## P3.5 — TLS / HTTPS (live)

| Endpoint | Result |
|---|---|
| `https://daily-arcade.netlify.app/` | HTTP/2 over TLS, verify=0 (success) |
| `https://main--daily-arcade.netlify.app/` | HTTP/2 over TLS, verify=0 (success) |
| `http://daily-arcade.netlify.app/` | 301 → `https://daily-arcade.netlify.app/` |

All paths are TLS-clean. No mixed-content or fallback behavior detected.

## P3.6 — Secrets exposure scan (live)

Scanned 590 KB of bundled JS (11 client chunks pulled from the home page) and 156 KB of rendered HTML (8 routes including manifest and a 404):

| Forbidden literal | Bundle matches | HTML matches |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | 0 | 0 |
| `SHARE_SIGNING_SECRET` | 0 | 0 |
| `CRON_SECRET` | 0 | 0 |
| `IP_HASH_SALT_BASE` | 0 | 0 |
| `postgres://` / `*.neon.tech` | 0 | 0 |
| `Authorization: Bearer <high-entropy>` | 0 | 0 |

The Turnstile **site key** (`0x4AAAAAADGmVuKU_ynym8wp`) is correctly present in HTML — that's the public key consumed by the client widget at interaction time. Expected and required.

The build-time bundle-check script (`scripts/bundle-check.mjs`) provides ongoing protection; it scans `.next/static/**` for `TURNSTILE_SECRET_KEY` and fails the build on detection (proven against an adversarial injection during Phase 5).

## P3.7 — Repository visibility & supply-chain note (NEW)

The repository is **public** at https://github.com/grifmang/daily-arcade. Implications:

- Pull requests, issue threads, code comments, and commit messages are world-readable.
- Anyone can grep the repo for env-var names and the threat-model documents to map our defenses.
- An attacker with a Cloudflare account can read our CSP and reproduce the Turnstile site key (which is fine — site keys are public anyway).

**Mitigations:** RUNBOOK now warns contributors not to paste secrets in any public-facing artifact. Dependabot should be enabled on the repo (recommended in Pass 2; reaffirmed here). No secrets have ever been committed; `.env.example` carries placeholders only. The bundle-check script catches accidental secret-key bundling at build time.

**Residual risk:** Low. Public visibility is a design choice for showcase / portfolio; the threat model assumes unauthenticated readers.

## P3.8 — Updated findings ranked

- **P0:** none.
- **P1:** none.
- **P2 (changed since Pass 2):**
  - **F1: manifest.webmanifest header gap** — patched in code; awaiting redeploy verification. Closes once header check passes after `git push origin main`.
  - **B-100: InMemoryStore in production code path** — still open. The live deploy is preview-grade. Production-grade status is gated on PostgresStore wire-up.
  - CSP `'unsafe-inline'` for scripts — unchanged from Pass 2; tighten with nonces post-launch.
  - Profanity bank minimal — unchanged from Pass 2; expand pre-launch and as users report.
  - npm audit (7 moderate dev/transitive) — unchanged; monitor.
- **P3:**
  - HSTS max-age is 1y on `*.netlify.app` (Netlify CDN floor); informational only.
  - No third-party error tracker (Netlify Function logs only) — same posture as Pass 2.
  - No public-facing `security.txt` (add post-launch).
  - Repository visibility: public — accepted, with RUNBOOK warning.

## P3.9 — Production gate list (re-issued)

**The live preview-grade deploy is approved for continued operation.** AppSec withholds **production-grade** sign-off until:

1. **PostgresStore wired** in `lib/store.ts` and `DATABASE_URL` populated. Until this lands, the leaderboard evaporates on every cold start. This is a hard production blocker. (Carryover from Pass 2 B-100.)
2. **F1 verified closed** on the next deploy: `curl -I https://daily-arcade.netlify.app/manifest.webmanifest` must return CSP, X-Frame-Options, Referrer-Policy, and Permissions-Policy in addition to HSTS and X-Content-Type-Options.
3. **Profanity bank reviewed** by the product owner before public launch (Fast-Follow item; not a hard blocker for production-grade approval, but a launch quality gate).

Optional production-quality wins (not gates):
- Tighten CSP `script-src` from `'unsafe-inline'` to `'strict-dynamic'` with nonces (Next.js Route-Group nonce middleware pattern).
- Submit the apex hostname for HSTS preload at hstspreload.org once a custom domain is attached.
- Enable Dependabot on the GitHub repo.
- Publish a `/.well-known/security.txt`.

## P3 Sign-off

**AppSec approves continued preview-grade operation of the live deploy at https://daily-arcade.netlify.app/.**

**AppSec withholds production-grade approval pending the three gates in §P3.9.**

The Vercel BotID gate from Pass 2 is permanently retired — Cloudflare Turnstile replaces it and is operating correctly in production. The Vercel-env-enforcement gate from Pass 2 is closed (Netlify env contains all eight required vars per parent confirmation; `assertProductionEnv()` enforces five of those at module load).

Pass 3 closing date: 2026-04-30. Next AppSec touchpoint: post-PostgresStore-wire-up runtime audit (Pass 4, scoped to the swap and the live data path). No periodic runtime audit is scheduled before then.
