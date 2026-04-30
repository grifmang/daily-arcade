# THREAT_MODEL.md — daily-arcade

**Author:** AppSec Engineer (Pass 1 — Design-time)
**Date:** 2026-04-29
**Status:** Pre-Build threat model. Pre-deploy audit will produce SECURITY_REVIEW.md.

---

## 1. Assets

| Asset | Sensitivity | Notes |
|---|---|---|
| Daily seed (today's puzzle config) | Low | Public after daily reset; not protected from disclosure. Disclosure *before* reset would let attackers pre-compute scores; protected by being computed inside the function only. |
| Leaderboard integrity | **High** | The whole social value of the product. Forged entries on top of leaderboard kill credibility. |
| Share URL signature secret (`SHARE_SIGNING_SECRET`) | High | Compromise allows score forgery. Must rotate without breaking outstanding URLs (key-id versioning). |
| Cron secret (`CRON_SECRET`) | Medium | Compromise lets attacker re-trigger seed generation; bounded blast radius (rate-limited inserts). |
| Trivia question bank | Medium | Disclosure ahead of date trivializes Snap Trivia leaderboard. Mitigated by per-day question selection happening server-side at submit time. |
| Database `DATABASE_URL` | Critical | Standard secret. Server-only; env-managed. |
| User PII | None | No PII collected. Handles are pseudonyms. IPs are hashed with daily salt for dedup only and not retained beyond 60 days. |

---

## 2. Trust boundaries (numbered for STRIDE)

1. **Browser ⟷ Vercel Edge/CDN**
2. **CDN ⟷ Functions Runtime (Server Actions, Route Handlers)**
3. **Functions ⟷ Neon Postgres**
4. **External actor ⟷ Cron route**
5. **External actor ⟷ Share/OG render route**
6. **Service worker ⟷ Server (offline cache fetch)**

---

## 3. STRIDE per boundary

### Boundary 1 — Browser ⟷ CDN

| Threat | Applies | Mitigation |
|---|---|---|
| **S**poofing | Yes (forged share URLs, fake handles) | HMAC-signed share URLs. Handles are not identity (no auth claim attached). |
| **T**ampering (in-flight) | Yes | HTTPS only; HSTS; secure cookie attributes (when added in Fast Follow). |
| **R**epudiation | N/A | Anonymous play; no actions to repudiate beyond public leaderboard entries. |
| **I**nformation disclosure | Low | No sensitive data crosses this boundary. Today's seed is public after the day starts. |
| **D**oS | Yes | Vercel platform protections; Routing Middleware rate-limits per IP-hash on `/api/leaderboard` and Server Actions. |
| **E**levation of privilege | N/A in MVP | No roles. |

### Boundary 2 — CDN ⟷ Functions

| Threat | Applies | Mitigation |
|---|---|---|
| **S**poofing | Yes (clients forging Server Action calls) | Vercel BotID on submit routes. Signature checks on share routes. Server validates every input via Zod. |
| **T**ampering | Yes (manipulated request bodies) | Zod schemas on every route. Server-side score recomputation (do not trust client-claimed score). |
| **R**epudiation | N/A | Logs include IP-hash and timestamp for attribution if needed. |
| **I**nformation disclosure | Yes (error message leakage) | Generic error responses; never echo internal exception messages. Server logs detail; client sees "Couldn't verify." |
| **D**oS | Yes | Per-IP-hash rate limit (5 submits/min, 20/day). BotID weeds out automated traffic. |
| **E**levation of privilege | N/A in MVP | |

### Boundary 3 — Functions ⟷ Postgres

| Threat | Applies | Mitigation |
|---|---|---|
| **S**poofing | No | Driver-level auth via `DATABASE_URL`. |
| **T**ampering | Yes (SQL injection if we slip up) | Drizzle parameterized queries everywhere. **No raw SQL with user input in MVP.** |
| **R**epudiation | N/A | DB writes auditable via `created_at`. |
| **I**nformation disclosure | Yes (over-fetching, leaking IP-hashes in API responses) | Explicit column selects; never return `ip_hash` in any client response. |
| **D**oS | Yes (write-amplification attacks) | Rate limits applied **before** DB writes; Neon connection pooling via `DATABASE_URL` (pooled). |
| **E**levation of privilege | N/A in MVP | Single DB user, scoped permissions. |

### Boundary 4 — External ⟷ Cron route

| Threat | Applies | Mitigation |
|---|---|---|
| **S**poofing | Yes — anyone can hit `/api/cron/daily-warm` | Bearer `CRON_SECRET` check **plus** verify `request.headers.get('x-vercel-cron')` matches Vercel's cron format. Reject all others with 401 (no body). |
| **T**ampering | N/A — no body | |
| **D**oS | Yes (forced re-warming) | Idempotent: if seed already exists, no-op. Rate limit by IP. |

### Boundary 5 — External ⟷ Share/OG render

| Threat | Applies | Mitigation |
|---|---|---|
| **S**poofing | Yes — forging a share with a fake score | HMAC-signed payload. Render refuses if signature invalid. |
| **T**ampering | Yes — query-string manipulation | Same HMAC. Any change to score/handle/date breaks signature. |
| **I**nformation disclosure | Low — share metadata is public | OG image only renders bounded fields (handle, score, game, date). Never render IP, internal IDs, secrets. |
| **D**oS | Yes — OG image rendering is CPU-non-trivial | CDN-cached by URL (URL = canonical signed payload). Repeat hits served from CDN. |

### Boundary 6 — Service worker ⟷ Server

| Threat | Applies | Mitigation |
|---|---|---|
| **T**ampering | Yes — SW caching stale-but-signed assets | Service worker only caches public, idempotent GETs. Submits are network-only. |
| **I**nformation disclosure | No | Cached responses are public seed/data. |

---

## 4. Auth model

### MVP: No identity layer

- Players are anonymous; "handle" is a pseudonym, not an account.
- Discriminator-on-collision pattern (Discord-style) handles namespace conflicts without auth.
- Streaks live in localStorage + IndexedDB. Loss is possible if user clears storage. **Documented limitation.**
- Risk accepted: a user can self-impersonate — there is no authoritative "this handle is mine." Mitigation in MVP is bounded daily uniqueness (one handle+discriminator per day per leaderboard).

### Fast Follow: Clerk for cross-device streak sync

When auth is added:
- Magic-link or social sign-in via Clerk
- Migrate localStorage streak to server on first sign-in
- Never replace the local streak with a strictly lower value (prefer max(local, server))

---

## 5. Authz model

### MVP: trivial

- Public reads: home, leaderboards, share pages, OG renders
- Public writes: submit score (per Server Action) — gated by BotID + rate limit + server-side verification
- Privileged writes: only the Cron route, gated by bearer + Vercel header
- No admin UI in MVP; trivia bank changes are migration-driven

### Fast Follow: identity-based authz

- Owner of a streak can edit handle, opt into PWA push, etc. Requires Clerk session.

---

## 6. Top risks (ranked)

### R1 — Leaderboard score forgery (Drift 2049) — High

**Scenario:** Attacker crafts a Server Action call with score=999999 and handle="WINNER". Without server-side verification, this lands at top of leaderboard.

**Mitigation in design:**
- Word Volley and Snap Trivia: server replays guesses/answers and recomputes score; client claim is ignored.
- Drift 2049: client submits move log; server replays moves against daily seed; if final state != claimed, reject.
- Top-100 only is replay-verified to bound CPU; rest is "trusted-but-bounded" with rate limits and BotID.

**Residual risk:** Scores below top-100 aren't replay-verified. Acceptable for MVP because they're not visible.

**Owner:** senior-backend.

### R2 — Share/OG image forgery — High

**Scenario:** Attacker crafts a URL with `?score=99999&handle=WINNER` and produces a screenshot of a fake leaderboard topper, posts it to social.

**Mitigation:** every share URL has an HMAC `s` param signed server-side at submit time. OG render refuses without valid signature.

**Owner:** senior-backend.

### R3 — Cron route abuse — Medium

**Scenario:** Public hits `/api/cron/daily-warm` to force seed regeneration or to crash the function via repeated calls.

**Mitigation:** bearer `CRON_SECRET` + Vercel cron header check. Idempotent — re-runs are no-ops. Rate limit by IP-hash for unauthorized callers (return 401 quickly, no DB hit).

**Owner:** senior-backend + devops.

### R4 — Handle squatting / abusive content — Medium

**Scenario:** Users pick handles like racial slurs, brand impersonation, harassment of named individuals.

**Mitigation:** server-side profanity bank check at handle claim time. Reject and offer alternatives. Disallow Unicode confusables; ASCII alphanumeric + underscore only. Provide a "report this handle" affordance on leaderboards (queues for manual review; trivial in MVP).

**Owner:** senior-fullstack (handle validation), product (profanity bank curation).

### R5 — Trivia answer leakage — Medium

**Scenario:** Client-side code exposes the correct answer for trivia questions, allowing automated cheating.

**Mitigation:** Snap Trivia client receives `(prompt, choices)` only. Correct answer lives server-side. Submit Server Action sends user's choice + timing; server validates. Client never holds the answer.

**Owner:** senior-fullstack + senior-backend.

### R6 — Service worker cache poisoning — Medium

**Scenario:** Compromised CDN cache poisons SW; users get malicious shell.

**Mitigation:** SW only caches GETs from same-origin to known precache paths. Versioned bundles (filename hash). SW update on every release; user gets fresh shell within one navigation.

**Owner:** senior-fullstack.

### R7 — IP-hash collisions / dedup bypass — Low

**Scenario:** Daily IP-hash salt is leaked or guessable; attacker correlates IP-hashes across days to deanonymize users.

**Mitigation:** Daily salt rotates at 00:00 UTC. Salt is server-only env. IP-hash is dropped after 60 days. We're hashing for dedup, not identity — even leak doesn't reveal PII because we never stored IP.

**Owner:** devops + senior-backend.

### R8 — Dependency supply-chain — Medium

**Scenario:** A transitive npm dep is compromised post-install.

**Mitigation:** lockfile committed; `npm audit` in CI; Dependabot enabled; minimal direct deps. Defer non-essential libraries.

**Owner:** devops.

### R9 — Rate-limit evasion via handle rotation — Medium

**Scenario:** Attacker submits with rotating handles to bypass per-handle rate limits.

**Mitigation:** Rate limit primarily by IP-hash (per game+date), not by handle. BotID raises the bar for distributed bot networks.

**Owner:** senior-backend.

### R10 — Local storage streak forgery — Low (intentional)

**Scenario:** Power user edits localStorage to fake a 999-day streak.

**Mitigation:** None. The streak is not authoritative; it's a personal display. No server-side claim is made about streaks in MVP. **Risk-accepted by design.** When auth is added in Fast Follow, server-side streak becomes authoritative for sync.

---

## 7. Headers checklist (DevOps to enforce in `proxy.ts` middleware)

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' va.vercel-scripts.com vitals.vercel-insights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' va.vercel-scripts.com vitals.vercel-insights.com *.neon.tech; frame-ancestors 'none';` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

CSP `'unsafe-inline'` for scripts is regrettable for Next.js inline runtime; tighten to `'strict-dynamic'` with nonces in Fast Follow. Document residual risk.

---

## 8. Secrets inventory

| Secret | Where | Rotation |
|---|---|---|
| `DATABASE_URL` | Vercel env (Neon Marketplace auto-provisioned) | Per Neon rotation policy |
| `DATABASE_URL_UNPOOLED` | Vercel env (Neon Marketplace) | Same as above |
| `SHARE_SIGNING_SECRET` | Vercel env (manual) | Quarterly; key-id versioning so existing URLs still validate |
| `CRON_SECRET` | Vercel env (manual) | Per release |
| `IP_HASH_SALT_BASE` | Vercel env (manual) | Annual; daily salt = HMAC(date, base) |

No secrets in repo. `.env.example` documents *names only*.

---

## 9. AppSec sign-off (Pass 1)

The architecture is acceptable to proceed to Planning. Key build-phase asks for senior-backend:

- All score submits run through one validated path (one Server Action; no parallel "fast path")
- Every score is server-recomputed; client `score` is informational only
- HMAC-signed share/OG URLs from day 1 (not "we'll add it later")
- Profanity bank for handles before first leaderboard write goes live
- Routing Middleware sets the headers above; verify in deployed preview during Pass 2
- Logs never include the share signing secret or the unhashed IP

**Sign-off recorded in DECISIONS.md.**

---

## Pass 2 will verify

- Headers actually present on prod responses
- `npm audit` clean, Dependabot enabled
- BotID firing on intended routes
- Rate limits enforced, not just configured
- Source maps not exposing server code
- No accidental client-bundle leak of `correct_index` from trivia, target word from word_volley, or move-log replay logic
- Cron route returns 401 with no body for unauthenticated callers

---

# Pass 3 — Design-time delta (post-Netlify pivot)

**Author:** AppSec Engineer (Pass 3 — Design-time, post-pivot)
**Date:** 2026-04-30
**Status:** Pre-implementation. A separate runtime AppSec Pass 3 (pre-deploy) will verify enforcement once the implementation lands. This section updates Pass 1's threat model under three changes: (a) bot protection swapped from Vercel BotID (never wired) to Cloudflare Turnstile (first-time wiring); (b) host platform swapped from Vercel to Netlify; (c) cron route's alternative auth path (`x-vercel-cron` header) removed — bearer-only.

## P3.1 What changed in the threat surface

| Change | Threat-surface impact |
|---|---|
| Bot protection: BotID → Turnstile | Bot-mitigation moves from a host-platform feature to an app-level integration with an external service (Cloudflare). Adds an outbound HTTPS dependency (`challenges.cloudflare.com/turnstile/v0/siteverify`). New CSP origins. Requires a server-side secret (`TURNSTILE_SECRET_KEY`) and a public site key (`TURNSTILE_SITE_KEY`). |
| Host: Vercel → Netlify | Boundary 1's CDN origin changes. Function runtime is Netlify Functions (Node) for SSR/Route Handlers, Netlify Edge Functions (Deno) for Middleware. No PII processing change. Skew protection becomes opt-in (recommended). |
| Cron: dual-auth → bearer-only | Removes one rejection condition (the `x-vercel-cron` header check). Slightly tightens the threat — only the bearer matters now — but also removes a defense-in-depth signal. Compensated by the scheduled function calling internally with the bearer; no public scheduler can forge the header anyway. |
| Analytics: Vercel Analytics + Speed Insights → none (built-in Netlify analytics) | Two `script-src` and `connect-src` origins removed from CSP. Net CSP reduction. |

## P3.2 STRIDE re-evaluation (rows that changed)

### Boundary 1 — Browser ⟷ Netlify CDN (was Vercel CDN)

| Threat | Pass 1 mitigation | Pass 3 mitigation |
|---|---|---|
| **D**oS | Vercel platform protections; rate-limits per IP-hash | Netlify platform protections; same per-IP-hash rate limits at the Server Action layer (unchanged). Netlify CDN absorbs at the network layer. |

No other changes in Boundary 1.

### Boundary 2 — CDN ⟷ Functions

| Threat | Pass 1 mitigation | Pass 3 mitigation |
|---|---|---|
| **S**poofing | Vercel BotID on submit routes. Signature checks on share routes. Server validates every input via Zod. | **Cloudflare Turnstile** verification on `submitScore` and `claimHandle` Server Actions. Token verified server-side via siteverify; fail-closed on non-success or timeout. Signature checks on share routes unchanged. Server validates every input via Zod. |
| **D**oS | Per-IP-hash rate limit; BotID weeds out bots | Per-IP-hash rate limit (5 submits/min, 20/day) — unchanged. Turnstile weeds out automated traffic before rate-limit counter is incremented (Turnstile fail = early reject; we do not consume a rate-limit slot for failed-bot challenges). |

### Boundary 4 — External ⟷ Cron route

| Threat | Pass 1 mitigation | Pass 3 mitigation |
|---|---|---|
| **S**poofing | Bearer `CRON_SECRET` **plus** verify `x-vercel-cron` header | **Bearer `CRON_SECRET` only.** The Netlify Scheduled Function (`netlify/functions/daily-warm.mts`) is the only legitimate scheduled caller and supplies the bearer. The previous header-check provided no incremental security against an attacker who already has the bearer (the header is trivially forgeable from outside if you know its name); removing it loses no real defense. |
| **T**ampering | N/A — no body | Unchanged. Route handler is `GET`, no body. |
| **D**oS | Idempotent; rate limit by IP for unauth callers | Unchanged. Idempotent on the seed compute (pure function). Unauthorized requests get 401 without DB hit. |

### New: Boundary 7 — Functions ⟷ Cloudflare Turnstile siteverify

This boundary did not exist in Pass 1 (BotID was a Vercel platform integration with no explicit outbound boundary).

| Threat | Mitigation |
|---|---|
| **S**poofing | Outbound TLS to `challenges.cloudflare.com` (Cloudflare-issued cert chain). The siteverify response includes `hostname` field — verifier asserts response `hostname` matches `process.env.NETLIFY_URL` or the configured deploy URL (defense against secret-key reuse on a different domain). |
| **T**ampering | Body is signed by TLS; we accept the JSON response only on HTTP 200 + `success: true` + matching `hostname`. |
| **R**epudiation | Verifier logs `{verdict, errorCodes}` on failure (never the token itself). |
| **I**nformation disclosure | We send only `secret` + `response` token. We **deliberately omit** the optional `remoteip` field — our existing privacy posture is to never share raw IP with third parties. `IP_HASH_SALT_BASE`-hashed IPs are not portable to Cloudflare's deduplication anyway. |
| **D**oS | If Turnstile is unreachable (network error, 5xx, timeout > 10s), fail-closed: reject the submission. This is a stricter-than-Arcjet-default posture (Arcjet defaults fail-open). Justified because (a) the legitimate-user impact is "wait a moment and resubmit," and (b) the bypass impact of fail-open during a Cloudflare incident is unbounded leaderboard pollution. |
| **E**levation of privilege | N/A. |

Token reuse is prevented by Cloudflare server-side: each token is single-use (`timeout-or-duplicate` error code on second siteverify of the same token). We do **not** need a local nonce store.

## P3.3 Top risks — re-ranked

R1 (leaderboard score forgery), R2 (share/OG forgery), R5 (trivia answer leakage), R6 (SW cache poisoning), R7 (IP-hash collisions), R8 (supply chain), R10 (localStorage streak forgery): **unchanged** — the pivot doesn't move these.

R3 (cron route abuse): **slightly tightened** by bearer-only path eliminating ambiguity. Risk level unchanged (Medium).

R4 (handle squatting / abusive content): **mitigated stronger** — Turnstile gate applies to `claimHandle` as well. Distributed handle-squat-by-bot is now a hard challenge to clear at scale. Risk level can drop Medium → Low if the profanity bank is curated to spec. **Recommendation:** keep at Medium until profanity bank is reviewed in Pass 3 runtime.

R9 (rate-limit evasion via handle rotation): **mitigated stronger** by Turnstile. Distributed bot networks have to clear a Turnstile challenge per submission, regardless of handle rotation. Risk level Medium → Low. The IP-hash rate limit remains the second layer.

### New: R11 — Turnstile fail-open by misconfiguration — High

**Scenario:** A developer accidentally swaps the verifier to fail-open (e.g. by catching the timeout error and returning `{ ok: true }` for "graceful degradation"), reopening the bot vector.

**Mitigation:**
- `lib/turnstile.ts` exports a single function with strict typed return; no overload that returns "ok=true on error."
- Unit tests must include explicit "fail-closed on timeout" and "fail-closed on non-200" cases.
- AppSec Pass 3 runtime must red-team the verifier path (artificial network failure → reject).
- Code review gate: the verifier file is in the Pass 3 review scope.

**Owner:** appsec + senior-backend.

### New: R12 — Turnstile site-key / secret-key cross-environment reuse — Medium

**Scenario:** Someone copies the production secret key into the deploy-preview environment to "make it work," and a deploy preview becomes a forgery vector against the production hostname.

**Mitigation:**
- `lib/turnstile.ts` substitutes Cloudflare's published always-pass test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) when `NODE_ENV !== "production"`. No production keys ever flow into preview / dev environments.
- Verifier asserts response `hostname` matches the expected deploy hostname (`NETLIFY_URL` or production canonical).
- Documented in RUNBOOK: do not use production Turnstile keys outside production.

**Owner:** devops.

### New: R13 — Client bundle leak of `TURNSTILE_SECRET_KEY` — Critical (if it happened)

**Scenario:** A misuse in `lib/env.ts` or the Turnstile component imports the secret key into a client component or RSC payload, exposing it in browser bundles.

**Mitigation:**
- `lib/turnstile.ts` is `import "server-only"` at the top.
- The secret key is only read inside `verifyTurnstile()`, never exported or returned.
- Build-time check: grep production client bundles for the literal string `TURNSTILE_SECRET_KEY` and fail the build if present (add to QA pre-deploy script).
- The site key is the only Turnstile env that ever reaches the client.

**Owner:** appsec + devops.

## P3.4 Headers checklist — Pass 3 update

`proxy.ts` CSP, with deltas vs Pass 1:

| Directive | Pass 1 value | Pass 3 value |
|---|---|---|
| `default-src` | `'self'` | `'self'` (unchanged) |
| `script-src` | `'self' 'unsafe-inline' va.vercel-scripts.com vitals.vercel-insights.com` | `'self' 'unsafe-inline' https://challenges.cloudflare.com` |
| `style-src` | `'self' 'unsafe-inline'` | unchanged |
| `img-src` | `'self' data: blob:` | unchanged |
| `font-src` | `'self' data:` | unchanged |
| `connect-src` | `'self' va.vercel-scripts.com vitals.vercel-insights.com` | `'self' https://challenges.cloudflare.com` |
| `frame-src` | (not present — covered by `default-src`) | `https://challenges.cloudflare.com` (explicit, narrower than `default-src 'self'` would allow) |
| `frame-ancestors` | `'none'` | unchanged |
| `base-uri` | `'self'` | unchanged |
| `form-action` | `'self'` | unchanged |

`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`: unchanged.

`'unsafe-inline'` for scripts remains regrettable; tightening to `'strict-dynamic'` with nonces is still Fast Follow. The pivot does not change that calculus.

**Net CSP posture:** **strictly tighter than Pass 1.** Two origins added (Turnstile script + frame), two origins removed (Vercel analytics). The added origins are narrower-purpose (one vendor for one feature) than the removed ones (two products from the host platform).

## P3.5 Secrets inventory — Pass 3 update

| Secret | Where | Rotation |
|---|---|---|
| `DATABASE_URL` | Netlify env (Neon direct) | Per Neon rotation policy |
| `DATABASE_URL_UNPOOLED` | Netlify env (Neon direct) | Same |
| `SHARE_SIGNING_SECRET` | Netlify env (manual) | Quarterly; key-id versioning so existing URLs still validate |
| `CRON_SECRET` | Netlify env (manual) | Per release |
| `IP_HASH_SALT_BASE` | Netlify env (manual) | Annual; daily salt = HMAC(date, base) |
| `TURNSTILE_SITE_KEY` | Netlify env (manual, public) | On Cloudflare key rotation; not security-sensitive but breaks client widget if mismatched |
| `TURNSTILE_SECRET_KEY` | Netlify env (manual, server-only) | Annual or on incident; rotation requires simultaneous swap with site key in Cloudflare dashboard |

`.env.example` documents names + safe placeholders only. No secrets in repo. **Production Turnstile keys are never written to any committed file** — they are set via Netlify CLI or UI at deploy time.

## P3.6 AppSec sign-off (Pass 3 design-time)

Architecture and threat model are acceptable to proceed to implementation under the pivot. Implementation gates for senior-backend:

- `lib/turnstile.ts` is `import "server-only"` and exports a single fail-closed verifier.
- `verifyTurnstile()` is called as the **first** step of `submitScore` and `claimHandle`, before rate-limit and before any DB read or write. Token verification consumes no rate-limit slot.
- The verifier asserts response `hostname` matches the expected deploy hostname.
- The verifier never logs the token.
- Unit tests cover: success, invalid token, timeout (fail-closed), non-200 (fail-closed), `timeout-or-duplicate` (fail-closed), `hostname` mismatch (fail-closed).
- The CSP delta in `proxy.ts` matches the table in P3.4 exactly.
- The client widget renders on submit and claim forms only. No widget on read-only routes.
- Build-time bundle-grep for `TURNSTILE_SECRET_KEY` is added to the pre-deploy QA script.

## P3.7 Pass 3 (runtime, pre-deploy) will verify

- Turnstile widget renders on submit + claim forms; a deploy-preview run with the test keys reaches a successful submission.
- Server-side verifier rejects an obviously bad token with 403; client surfaces a generic "couldn't verify, try again."
- Server-side verifier fail-closes on artificial network failure to `challenges.cloudflare.com` (curl-level test).
- CSP on production responses contains the new origins exactly as P3.4 specifies; no extras.
- Production client bundle does not contain `TURNSTILE_SECRET_KEY` literal.
- `assertProductionEnv()` rejects boot if either Turnstile var is missing in production.
- Cron route rejects without bearer (401, no body); the scheduled function's invocation log shows successful daily warming.
- All five existing secrets remain enforced; rotation runbook intact.

**Sign-off:** conditional on implementation matching the gates above. Final Pass 3 (runtime) sign-off occurs after QA smoke and before production promotion.
