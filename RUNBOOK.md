# RUNBOOK.md — daily-arcade

**Audience:** future-you at 2 AM, or whoever is on-call.
**Maintained by:** DevOps + Principal Engineer.
**Last revised:** 2026-04-30 for Netlify deploy target + GitHub-driven CI/CD. The 2026-04-29 v1 of this runbook targeted Vercel; that history is preserved in git.

---

## At a glance

- **Stack:** Next.js 16 / Node 22+ on **Netlify** (OpenNext adapter, auto-installed)
- **Deploy flow:** **GitHub → Netlify**. `git push origin main` triggers an auto-deploy (per ADR-7, 2026-04-30).
- **Repository:** https://github.com/grifmang/daily-arcade — **PUBLIC**. Never paste secrets in code review, issues, PRs, or commit messages.
- **Live URL (production):** https://daily-arcade.netlify.app/
- **Site ID (Netlify):** `6a9b822d-6fa1-47df-bfd8-aa5fab4dbe18`
- **Build command:** `next build --webpack` (Turbopack output is incompatible with the current Netlify edge bundler — see ADR-6).
- **DB (production):** Neon Postgres (direct project) — currently using InMemoryStore in code paths until PostgresStore is wired (production-grade gate, see Pass 3 below).
- **Bot protection:** Cloudflare Turnstile on `submitScore` and `claimHandle` Server Actions.
- **Daily reset:** 00:00 UTC. `netlify/functions/daily-warm.mts` (Netlify Scheduled Function) fires the bearer-authenticated `/api/cron/daily-warm` route handler.
- **No third-party error tracker yet.** Netlify Function logs are the source of truth.

---

## Pre-flight checklist (before first deploy)

These items are user-side and not scriptable. Confirm each before starting the deploy flow:

1. **GitHub repo connected to Netlify site** — once-only, done via the Netlify UI. The site reads `netlify.toml` from the repo root and runs `next build --webpack` on Linux runners.
2. **Netlify site name + hostname** — site name `daily-arcade`, production hostname `daily-arcade.netlify.app` (custom domain optional, post-launch).
3. **Cloudflare Turnstile site provisioned** — both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` set in Netlify env. Free at unlimited scale; create at the Cloudflare dashboard.
4. **Neon project provisioned** — `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (pooled and unpooled connection strings) set in Netlify env. Direct project, not Marketplace-installed.

---

## Routine deploy (GitHub-driven)

**The supported path is `git push origin main` to https://github.com/grifmang/daily-arcade.** Netlify watches the repo and:

- Pushes to `main` → production deploy on https://daily-arcade.netlify.app/.
- Pushes to a feature branch → Deploy Preview at `<branch-name>--daily-arcade.netlify.app/` (uses test Turnstile keys per ADR-1).
- Pull requests → Deploy Preview with status checks reported back to the PR.

Before pushing, run `npm run predeploy` locally as a tripwire. CI on Netlify will rebuild from scratch regardless.

```bash
git status                       # ensure clean tree
npm run predeploy                # typecheck + lint + test + build + bundle:check
git push origin main             # triggers Netlify build (Linux, ~32s)
# watch the deploy in the Netlify dashboard or via:
netlify deploy --status
```

### Local Netlify CLI: emergency escape hatch only

`netlify deploy --build` from a developer machine is **not** the routine path. We attempted it once on 2026-04-30 and hit two blockers (Turbopack bundler bug + `@netlify/blobs` auth from local CLI) — see ADR-7. It is retained only for emergency-debug scenarios and may continue to fail on Windows. If you genuinely need it, work around the auth issue by running `netlify env:get` first and ensure your local environment matches what CI gets.

### Setting environment variables (one-time)

```bash
# Production scope (these are already set on the live site as of 2026-04-30; included for reference and rotation)
netlify env:set SHARE_SIGNING_SECRET "$(openssl rand -hex 64)"
netlify env:set CRON_SECRET           "$(openssl rand -hex 32)"
netlify env:set IP_HASH_SALT_BASE     "$(openssl rand -hex 64)"
netlify env:set DATABASE_URL          "<from Neon>"
netlify env:set DATABASE_URL_UNPOOLED "<from Neon>"
netlify env:set TURNSTILE_SITE_KEY    "<from Cloudflare Turnstile dashboard>"
netlify env:set TURNSTILE_SECRET_KEY  "<from Cloudflare Turnstile dashboard>" --secret
netlify env:set NETLIFY_NEXT_SKEW_PROTECTION "true"

netlify env:list                      # verify all eight present
```

Deploy-preview and branch-deploy contexts use the Cloudflare always-pass test Turnstile keys (set automatically by `lib/env.ts` when `NODE_ENV !== "production"`); production uses the real ones.

Use `--secret` (or the UI's "Contains secret values" toggle) on `TURNSTILE_SECRET_KEY` and any other server-only secret you do not want surfaced in build logs.

### Setting environment variables (one-time)

```bash
netlify env:set SHARE_SIGNING_SECRET "$(openssl rand -hex 64)"
netlify env:set CRON_SECRET           "$(openssl rand -hex 32)"
netlify env:set IP_HASH_SALT_BASE     "$(openssl rand -hex 64)"
netlify env:set DATABASE_URL          "<from Neon>"
netlify env:set DATABASE_URL_UNPOOLED "<from Neon>"
netlify env:set TURNSTILE_SITE_KEY    "<from Cloudflare Turnstile dashboard>"
netlify env:set TURNSTILE_SECRET_KEY  "<from Cloudflare Turnstile dashboard>" --secret
netlify env:set NETLIFY_NEXT_SKEW_PROTECTION "true"

netlify env:list                      # verify all eight present
```

Use `--secret` (or the UI's "Contains secret values" toggle) on `TURNSTILE_SECRET_KEY` and any other server-only secret you do not want surfaced in build logs.

---

## Production deploy (preview-grade currently live)

**Current status (as of 2026-04-30, AppSec Pass 3 runtime):** the live site is **preview-grade**, not production-grade. PostgresStore is not yet wired; data evaporates on cold start. Promotion to production-grade is gated on the PostgresStore swap (see SECURITY_REVIEW.md Pass 3).

**Pre-flight gate (every deploy):**

1. `npm run predeploy` green locally (typecheck + lint + test + build + bundle:check). The bundle-check step asserts that `TURNSTILE_SECRET_KEY` does not appear in any client bundle.
2. PR reviewed; status checks (Netlify Deploy Preview) green.
3. Cron schedule confirmed: Netlify dashboard → Functions → `daily-warm` shows `Scheduled` badge and `0 0 * * *`. (Note: scheduled functions only run on **published** deploys, never on Deploy Previews.)
4. Custom domain (optional) attached + DNS verified.

**Production-grade gate (additional, before declaring the site production):**

5. `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set in Production env, **and** PostgresStore wired in `lib/store.ts`. Without both, `lib/store.ts` continues to use InMemoryStore — leaderboard data evaporates on every function cold start.
6. `SHARE_SIGNING_SECRET`, `CRON_SECRET`, `IP_HASH_SALT_BASE` set in Production env (each unique per environment).
7. `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` set in Production env (the secret marked as `Contains secret values`).

**Promote:**
```bash
git push origin main
```

That's it. Netlify builds on Linux runners and auto-publishes the production deploy to https://daily-arcade.netlify.app/.

**Watch (first 30 minutes after a production push):**
```bash
# tail Netlify Function logs (linked CLI required)
netlify logs:function

# confirm scheduled functions
netlify functions:list

# inspect the latest deploy
netlify api listSiteDeploys --data '{"site_id": "6a9b822d-6fa1-47df-bfd8-aa5fab4dbe18"}' | jq '.[0]'
```

Verify on the production URL:
- `curl -I https://daily-arcade.netlify.app/` returns 200 and CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy. CSP must include `https://challenges.cloudflare.com` in `script-src`/`connect-src`/`frame-src` and must NOT include `va.vercel-scripts.com` or `vitals.vercel-insights.com`.
- `curl -I https://daily-arcade.netlify.app/manifest.webmanifest` returns the same security-header set (the matcher fix from 2026-04-30 covers this route).
- `curl https://daily-arcade.netlify.app/api/cron/daily-warm` returns 401.
- Submit a test entry on each of the three games — confirm the Turnstile widget appears in the dialog (or is invisible and auto-passes for the legitimate user) and the leaderboard accepts the entry.
- `curl -sL https://daily-arcade.netlify.app/g/word-volley | grep -oE "0x4AAAAAA[A-Za-z0-9_-]+"` returns the production Turnstile site key (proves prod env is wired).

---

## Rollback

Netlify keeps every deployment immutable. Two paths:

### Fast path — Netlify dashboard
Dashboard → Deploys → find the previous known-good deploy → click "Publish deploy". Instant repointing.

### CLI path
```bash
netlify api listSiteDeploys --data '{"site_id": "6a9b822d-6fa1-47df-bfd8-aa5fab4dbe18"}' | jq '.[0:5]'
netlify rollback                             # rolls back to the previous published deploy
```

### Git path (creates a new deploy from a previous commit)
```bash
git revert <bad-commit-sha>
git push origin main                          # Netlify will deploy the revert as a fresh build
```

```bash
netlify api listSiteDeploys --data '{"site_id": "<site-id>"}' | jq '.[0:5]'
netlify rollback                              # rolls back to the previous published deploy
```

Or via Dashboard → Deploys → "Publish deploy" on a known-good build.

Effect: the published deploy URL is repointed at the prior immutable build. Skew protection (if enabled via `NETLIFY_NEXT_SKEW_PROTECTION=true`) keeps in-flight clients on the deploy that served their initial page until they navigate. No DB schema migrations are forward-incompatible at MVP, so rollback is safe in either direction. Re-verify with `netlify logs:function`.

---

## Scenarios

### S1 — App is down (5xx wall)
**Symptom:** Netlify status page red; users get 500/502/504.
**Diagnose:**
1. `netlify logs:function | grep -iE "error|exception"` — look for stack traces
2. Open the deploy in Netlify Dashboard; check function build status and the OpenNext adapter version pinned at build time
3. Check Neon dashboard for connection errors (`too_many_connections`, instance unhealthy)

**Mitigate (in order):**
1. Rollback to previous deployment (`netlify rollback`)
2. If DB-related: verify Neon instance is reachable; rotate `DATABASE_URL` if compromised; bump connection pool size
3. If global Netlify outage: post status update; nothing to do but wait

### S2 — Error rate spike (>1% 5xx)
**Symptom:** Function logs show climbing 5xx rate.
**Diagnose:**
1. `netlify logs:function --since=5m` — group by route
2. Most likely culprits in MVP: submit Server Action (DB write failures), OG image route (signature edge cases), Turnstile fail-closed during a Cloudflare incident (see S9)

**Mitigate:**
1. If signature verification is the failure: rotate `SHARE_SIGNING_SECRET` only after confirming new URLs validate (key-id versioning means existing URLs keep working under v1; new URLs will use v2 — only deploy v2 after the rollover)
2. If DB writes are failing: switch to InMemoryStore env temporarily by setting `DATABASE_URL=` empty. **Acceptable as a 30-minute mitigation only.**

### S3 — Slow page (LCP > 4s on mobile)
**Symptom:** Core Web Vitals regression.
**Diagnose:**
1. Lighthouse on `/` and the three game routes
2. Inspect bundle size via `next build` output (in CI logs)
3. Check that the daily seed cache is hitting (function logs show `daily-warm` ran successfully at 00:00 UTC)

**Mitigate:**
1. Confirm Tailwind 4 build artifacts gzipped < 50KB
2. Verify `next/font` is loaded; check FOIT/FOUT not regressing
3. If seed cache is missing: confirm `daily-warm` scheduled function is firing — `netlify functions:list` should show next-run and last-run; force-warm via authenticated GET to `/api/cron/daily-warm`

### S4 — Failed deploy
**Symptom:** `netlify deploy --build` returns non-zero; preview URL never goes green.
**Diagnose:** Read the build log surfaced in CLI output, or open the deploy in the Netlify Dashboard → "Deploy log".

Common causes:
- Missing env in Production / Deploy-Preview scopes (check `netlify env:list`)
- TypeScript error introduced after PR review (pre-merge `npm run predeploy` should have caught)
- OpenNext adapter version drift after a Next.js bump (we do not pin the adapter; expected)
- Bundle-check failure (the predeploy script catches `TURNSTILE_SECRET_KEY` leakage into the client bundle — investigate which file flagged)

**Mitigate:** fix the underlying cause; previous published deploy is unaffected.

### S5 — DB connection exhaustion
**Symptom:** Submits start returning 500; logs show `too many clients`.
**Diagnose:**
1. Neon dashboard → connections graph
2. Confirm we're using `DATABASE_URL` (pooled) for runtime, `DATABASE_URL_UNPOOLED` only for migrations

**Mitigate:**
1. Force a redeploy (Netlify rebuilds connection pools on cold start). For routine: `git commit --allow-empty -m "force redeploy" && git push`. For emergency only: `netlify deploy --build --prod` (caveat: local CLI is the escape-hatch path per ADR-7).
2. If sustained: bump Neon plan or add Redis cache layer in front of leaderboard reads.
3. As emergency: switch traffic 100% to fine-grained cache reads (already a 60s TTL; bump to 5 min in `actions.ts` `getLeaderboard`).

### S6 — Third-party integration outage (Neon, Cloudflare Turnstile)
- **Neon outage:** see S5; the in-memory fallback is a 30-min mitigation.
- **Cloudflare Turnstile outage:** see S9 below.
- (Clerk, when added in Fast Follow, gets its own scenario here.)

### S7 — Cron failed to fire
**Symptom:** Today's seed not warmed; first-load LCP regressed.
**Diagnose:**
1. Netlify Dashboard → Functions → `daily-warm` → invocation history
2. `netlify functions:list` shows next-run timestamp
3. Check `CRON_SECRET` not rotated mid-day on the Netlify side without the function deploy redeploying with the new value

**Mitigate:**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://daily-arcade.netlify.app/api/cron/daily-warm
```
Idempotent. Force-warms.

You can also invoke the scheduled function directly from the CLI for ad-hoc warming:
```bash
netlify functions:invoke daily-warm
```
(This works against `netlify dev` for local testing; in production the scheduled function runs only on the Netlify cron — manual invoke is via the route handler curl above.)

### S8 — Leaderboard appears reset to zero
**Symptom:** All daily counts at 0 even though users played.
**Diagnose:** Almost certainly InMemoryStore in use without realizing it. Check that `DATABASE_URL` is set in Production env via `netlify env:list`.
**Mitigate:** set `DATABASE_URL`; redeploy. Lost data is unrecoverable but daily-bounded.

### S9 — Cloudflare Turnstile outage / fail-closed event
**Symptom:** Submission attempts get the generic "We couldn't verify this submission. Try again." error. Function logs show `[submit] turnstile rejected` with `internal-timeout` or `internal-non-200` codes. Cloudflare status page shows incident.

**Why we fail-closed:** the verifier's design (`lib/turnstile.ts`) treats any non-success outcome as a reject. The alternative — fail-open during a Cloudflare incident — would unbound bot-driven leaderboard pollution for the duration of the outage. See `THREAT_MODEL.md` §P3.2 (Boundary 7) and R11.

**Diagnose:**
1. Cloudflare status page (cloudflarestatus.com) for ongoing incidents
2. `netlify logs:function | grep "turnstile rejected"` — look at the `codes` field; `internal-timeout` and `internal-non-200` indicate Cloudflare-side, `invalid-input-response` and `timeout-or-duplicate` are user-side
3. From a server, `curl -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify -d "secret=$TURNSTILE_SECRET_KEY&response=test"` to confirm the endpoint is reachable

**Mitigate:**
- **Default:** wait. Cloudflare incidents are typically <30 min. Users get a clear retry CTA.
- **Emergency only (do not do this routinely):** if the outage is sustained and the threat-model owner approves the temporary risk, deploy a hot-patch to `lib/turnstile.ts` that returns `{ ok: true }` unconditionally. **This must be reverted within 1 hour and accompanied by a public-facing post-mortem.** Treat as last resort.

### S10 — Suspected `TURNSTILE_SECRET_KEY` leak
**Symptom:** Cloudflare flags unusual siteverify volume; or a code review caught the literal in a client bundle; or a developer accidentally logged it.

**Diagnose:**
1. Run `npm run bundle:check` against the latest production bundle
2. `netlify logs:function | grep TURNSTILE_SECRET_KEY` — must return zero matches
3. Check git history for accidental commit of the literal: `git log -p | grep -i TURNSTILE_SECRET_KEY`

**Mitigate (in order):**
1. **Rotate the Turnstile secret key immediately** in the Cloudflare dashboard. The site key can stay; rotating only the secret key invalidates outstanding tokens but does not break the client widget.
2. `netlify env:set TURNSTILE_SECRET_KEY <new-value>` and `netlify deploy --build --prod` — secret-key reads are at request time (no rebuild required for the read, but the redeploy ensures consistent state).
3. Trigger an AppSec Pass 3 sub-audit; capture root cause and ship a `bundle:check` extension covering the new failure mode.

---

## Card Parlor subsystem

The card parlor is a sibling lounge to the daily three. It runs entirely client-side: no Server Actions, no Route Handlers, no DB writes, no Turnstile, no OG, no cron. Credits + session stats live in `localStorage` per game. See ARCHITECTURE Section 15 for the full subsystem contract.

### Live URLs
- Index: https://daily-arcade.netlify.app/cards/
- Jacks or Better: https://daily-arcade.netlify.app/cards/jacks-or-better
- Deuces Wild: https://daily-arcade.netlify.app/cards/deuces-wild

### Math reference docs
- Design spec: `docs/superpowers/specs/2026-05-01-card-parlor-design.md` (rationale, scope, integration boundaries).
- Math spec: `docs/superpowers/specs/cards-video-poker-engine.md` (locked paytable values, RTP figures, golden vectors).
- Decision log: ADRs C1–C6 in `DECISIONS.md` (2026-05-01) — routing, no-streak, no-leaderboard, localStorage credits, no-daily-seed, sequential ship cycles.
- Architecture: `ARCHITECTURE.md` Section 15 — subsystem ownership table, state machine, evaluator modes, a11y commitments, performance budget.

### Paytable-adjustment procedure
Paytables are locked constants in `lib/cards/video-poker/paytable.ts` (`JOB_PAYTABLE` for 9/6 Jacks or Better, `DEUCES_PAYTABLE` for NSUD Deuces Wild). They are looked up by reference identity in two places (top-tier bet=5 bonus map and wild-mode evaluator routing in `round.ts`) — never spread, shallow-copy, or hand-roll a Paytable-shaped value.

To adjust a paytable:

1. **Cross-check the proposed values against the canonical Wizard of Odds tables** for the variant in question. (Wizard of Odds is a public reference site for casino math, used here only for value verification — not a brand we are emulating. The paytable values themselves are widely-published facts that encode no copyrightable expression.)
2. Update the constant in `lib/cards/video-poker/paytable.ts`.
3. **Update the transcription tests in `lib/cards/video-poker/paytable.test.ts`** so each per-rank value matches the new paytable verbatim. The transcription tests exist precisely to catch silent typos in the locked constants — they must be re-locked, not deleted.
4. Re-run the math spec's golden vectors (`lib/cards/video-poker/round.test.ts` etc.) and confirm RTP figures still match the spec, or update the math spec figures alongside the paytable change.
5. Note the change as a new ADR in `DECISIONS.md` if the variant identity is changing (e.g. 9/6 → 8/5 JoB is a different variant; a typo correction is not).

### Engine doc cross-reference
- Subsystem: `ARCHITECTURE.md` Section 15
- ADRs: C1 (routing) · C2 (no streak) · C3 (no submit/Turnstile/OG/DB) · C4 (localStorage credits) · C5 (no daily seed) · C6 (sequential ship cycles) — all in `DECISIONS.md` 2026-05-01

### Incident response — card route hangs / freezes
**Symptom:** loading `/cards/jacks-or-better` or `/cards/deuces-wild` produces a blank screen, infinite spinner, or browser-tab freeze on DEAL.

**First suspect: the RNG.** A power-of-2 `nextInt` truncation bug previously caused an infinite loop in `lib/cards/video-poker/rng.ts` whenever `max` was a power of 2 (the card-shuffle Fisher-Yates path calls `nextInt(32)`, `nextInt(16)`, ... so it is exposed). Fixed in commit `cae0fd5` ("fix(rng): infinite loop on power-of-2 nextInt — drop >>> 0 on limit"). Look for:
- The in-source `// CAREFUL` comment in `lib/cards/video-poker/rng.ts` documenting why `>>> 0` must NOT be applied to `limit`.
- The regression test in `lib/cards/video-poker/rng.test.ts` (`"nextInt(power-of-2) terminates fast — regression against the >>> 0 truncation bug"`).

If a card route hangs, confirm the regression test still passes (`npm test -- rng`) and that the `>>> 0` truncation has not been re-introduced anywhere on `limit`. If both check out, the freeze is elsewhere — instrument `deal()` and the client island render path next.

The slot RNG (`lib/slots/.../rng.ts`) shares the same RNG shape; it only calls `nextInt(60)` so it dodges the bug, but the same `// CAREFUL` discipline applies if either RNG is ever extracted to a shared util.

---

## Routine maintenance

- **Quarterly:** rotate `SHARE_SIGNING_SECRET` (key-id v1 → v2). Update `lib/sign.ts` `KEY_ID = "v2"` and the verification table to accept both. Phase out v1 acceptance after 30 days.
- **Quarterly:** rotate `IP_HASH_SALT_BASE`. No app change needed; daily salts derive from this.
- **Annual or on-incident:** rotate `TURNSTILE_SECRET_KEY` per S10.
- **Monthly:** run `npm audit`. New criticals get a same-day patch.
- **Pre-launch and weekly thereafter:** review trivia bank for stale entries; retire any flagged via reports.
- **On every Next.js bump:** confirm OpenNext adapter compatibility via the Netlify e2e test report (we do not pin the adapter; updates are automatic). If a build regresses, pin temporarily per the README and open an issue at `opennextjs/opennextjs-netlify`.

---

## Content sources

The Snap Trivia bank in `lib/content/trivia.ts` is sourced from
[Open Trivia DB](https://opentdb.com), under their free-use license
(attribution required, no warranty). To regrow the bank:

1. Mint a session token: `curl https://opentdb.com/api_token.php?command=request`
2. Pull batches across the 7 source categories at easy + medium difficulty
3. Run the filter pass per `docs/superpowers/specs/2026-04-30-arcade-polish-design.md` Feature 1
4. Replace the array in `lib/content/trivia.ts` and re-run `npm test`

The Word Volley dictionary in `lib/content/word-valid-guesses.ts` is sourced
from the open-source [tabatkins/wordle-list](https://github.com/tabatkins/wordle-list)
(used as a 5-letter word dictionary, not redistributed).

---

## Who to ping

- **App down or data integrity:** Principal Engineer
- **Auth or session weirdness (Fast Follow):** Senior Full-stack
- **DB issues:** Senior Backend
- **Performance regressions:** Frontend Experience
- **Security advisories or suspected exploit:** AppSec — immediately, with the deployment URL and timestamps
- **Turnstile or bot-protection issues:** AppSec + Senior Backend

---

## Useful one-liners

```bash
# routine deploy
git push origin main

# pre-deploy gate (run locally before pushing)
npm run predeploy

# verify all eight production envs are present
netlify env:list

# tail logs across all functions
netlify logs:function

# tail logs for one route (filter on the route or action name)
netlify logs:function | grep "submitScore"

# list scheduled functions and their next-run timestamps
netlify functions:list

# manually invoke the daily warming scheduled function (for local netlify dev)
netlify functions:invoke daily-warm

# manually warm production seed via the route handler bearer
curl -H "Authorization: Bearer $CRON_SECRET" https://daily-arcade.netlify.app/api/cron/daily-warm

# inspect the published site + latest deploy
netlify api getSite | jq
netlify api listSiteDeploys --data '{"site_id": "6a9b822d-6fa1-47df-bfd8-aa5fab4dbe18"}' | jq '.[0]'

# rollback to the previous published deploy
netlify rollback

# emergency forced redeploy (no code changes)
git commit --allow-empty -m "force redeploy" && git push origin main

# header audit — what AppSec Pass 3 ran
for path in / /g/word-volley /g/drift-2049 /g/snap-trivia /leaderboard/word-volley /about /manifest.webmanifest /api/cron/daily-warm; do
  echo "===== $path =====";
  curl -sI "https://daily-arcade.netlify.app$path" | grep -iE "^(HTTP|content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy)";
done
```
