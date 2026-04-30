# RUNBOOK.md — daily-arcade

**Audience:** future-you at 2 AM, or whoever is on-call.
**Maintained by:** DevOps + Principal Engineer.
**Last revised:** 2026-04-30 for Netlify deploy target. The 2026-04-29 v1 of this runbook targeted Vercel; that history is preserved in git.

---

## At a glance

- **Stack:** Next.js 16 / Node 22+ on **Netlify** (OpenNext adapter, auto-installed)
- **DB (production):** Neon Postgres (direct project) — gated until provisioned; in-memory fallback otherwise
- **Bot protection:** Cloudflare Turnstile on `submitScore` and `claimHandle` Server Actions
- **Daily reset:** 00:00 UTC. `netlify/functions/daily-warm.mts` (Netlify Scheduled Function) fires the bearer-authenticated `/api/cron/daily-warm` route handler.
- **No third-party error tracker yet.** Netlify Function logs are the source of truth.

---

## Pre-flight checklist (before first deploy)

These four items are user-side and not scriptable. Confirm each before starting the deploy flow:

1. **Netlify CLI authorized** — `netlify login` (interactive). Verify with `netlify status`.
2. **Netlify site exists** — site name `daily-arcade`, intended production hostname `daily-arcade.netlify.app` (custom domain optional, post-launch).
3. **Cloudflare Turnstile site provisioned** — both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` available. Free at unlimited scale; create at the Cloudflare dashboard.
4. **Neon project provisioned** — `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (pooled and unpooled connection strings) available. Direct project, not Marketplace-installed.

---

## First-time deploy (preview)

The **Netlify CLI** is required. Verify with `netlify --version` (we have used CLI 17.x).

```bash
# from projects/daily-arcade
netlify link                 # interactive — pick scope, name "daily-arcade"
netlify env:list             # confirm the env scope is correct
netlify deploy --build       # creates a preview URL
```

If `netlify link` errors with no team/scope: the user account has no team scope. Open the Netlify dashboard once, create or accept a team, then re-run.

For Auto-mode runs without configured CLI auth, the orchestrator surfaces this and stops before deploy.

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

## First-time deploy (production)

**Pre-flight gate (AppSec, Pass 3 runtime):**

1. `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set in Production env. Without them the app falls back to InMemoryStore — **not safe for production.**
2. `SHARE_SIGNING_SECRET`, `CRON_SECRET`, `IP_HASH_SALT_BASE` set in Production env (each unique per environment).
3. `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` set in Production env (the secret marked as a secret).
4. `npm run predeploy` green (typecheck + lint + test + build + bundle:check). The bundle-check step asserts that `TURNSTILE_SECRET_KEY` does not appear in any client bundle.
5. Cron schedule confirmed: `netlify functions:list` shows `daily-warm` with `Scheduled` badge and `0 0 * * *`. (Note: scheduled functions only run on **published** deploys, never on Deploy Previews.)
6. Custom domain (optional) attached + DNS verified.

**Promote:**
```bash
netlify deploy --build --prod
```

**Watch (first 30 minutes):**
```bash
netlify logs:function       # tail Netlify Function logs
netlify functions:list      # confirm daily-warm scheduled
```

Verify on the production URL:
- `GET /` returns 200
- `GET /` response headers include CSP (with `https://challenges.cloudflare.com` in `script-src`/`connect-src`/`frame-src` and **no** `va.vercel-scripts.com` or `vitals.vercel-insights.com`), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- `GET /api/cron/daily-warm` returns 401 without bearer
- Submit a test entry on each of the three games — confirm the Turnstile widget appears in the dialog (or is invisible and auto-passes for the legitimate user) and the leaderboard accepts the entry

---

## Rollback

Netlify keeps every deployment immutable.

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
1. Force a deploy redeploy (Netlify rebuilds connection pools on cold start; `netlify deploy --build`)
2. If sustained: bump Neon plan or add Redis cache layer in front of leaderboard reads
3. As emergency: switch traffic 100% to fine-grained cache reads (already a 60s TTL; bump to 5 min in `actions.ts` `getLeaderboard`)

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

## Routine maintenance

- **Quarterly:** rotate `SHARE_SIGNING_SECRET` (key-id v1 → v2). Update `lib/sign.ts` `KEY_ID = "v2"` and the verification table to accept both. Phase out v1 acceptance after 30 days.
- **Quarterly:** rotate `IP_HASH_SALT_BASE`. No app change needed; daily salts derive from this.
- **Annual or on-incident:** rotate `TURNSTILE_SECRET_KEY` per S10.
- **Monthly:** run `npm audit`. New criticals get a same-day patch.
- **Pre-launch and weekly thereafter:** review trivia bank for stale entries; retire any flagged via reports.
- **On every Next.js bump:** confirm OpenNext adapter compatibility via the Netlify e2e test report (we do not pin the adapter; updates are automatic). If a build regresses, pin temporarily per the README and open an issue at `opennextjs/opennextjs-netlify`.

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

# inspect the published deploy
netlify api getSite | jq

# pre-deploy gate (run locally before promoting)
npm run predeploy
```
