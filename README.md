# Daily Arcade

A small daily-puzzle arcade. Three games — **Word Volley**, **Drift 2049**, **Snap Trivia** — share one streak, one share-grid grammar, and one daily reset at 00:00 UTC.

Same puzzle for everyone, every day. No account, no install required, no ads.

A side lounge sits alongside the daily three (separate routes, no streak impact, no leaderboard, no submit):

- **Card Parlor** (`/cards/`) — play-money video poker. 9/6 Jacks or Better and NSUD Deuces Wild.

---

## What this is

- Next.js 16 App Router on **Netlify** (OpenNext adapter), TypeScript strict, Tailwind 4
- Three deterministic-seed mini-games
- Per-game daily leaderboard (anonymous handles, Discord-style discriminator on collision)
- HMAC-signed share URLs and OG images
- Cloudflare Turnstile bot protection on submit + handle-claim
- Mobile-first PWA (installable; runtime SW deferred to Fast Follow)

Detailed design: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Threat model: [`THREAT_MODEL.md`](./THREAT_MODEL.md). Build plan: [`PLAN.md`](./PLAN.md). Decision log: [`DECISIONS.md`](./DECISIONS.md) — the 2026-04-30 ADRs explain the Vercel→Netlify pivot.

---

## Local setup

Requires **Node ≥ 22.14** and **npm**.

```bash
# from the project root
npm install
cp .env.example .env.local      # leave values unset to use dev defaults
npm run dev                     # → http://localhost:3000
```

The first run uses an in-memory store. Leaderboard data evaporates on restart — see Storage below.

In dev, Turnstile substitutes Cloudflare's published always-pass test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) so the widget renders and submissions verify locally without provisioning real keys.

### Local development with Netlify primitives (`netlify dev`)

To exercise Netlify Edge Functions, scheduled-function invocation, and CDN headers locally:

```bash
npm install -g netlify-cli      # one-time
netlify dev                     # → http://localhost:8888
netlify functions:invoke daily-warm   # manually fire the scheduled cron
```

`netlify dev` proxies `next dev` and adds the Netlify Edge runtime in front. Use plain `npm run dev` for fast iteration; switch to `netlify dev` to validate platform-shaped behavior before deploy.

---

## Common tasks

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # production build (Next.js)
npm start            # serve production build locally
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm test             # vitest run (42 tests)
npm run test:watch   # watch mode
npm run bundle:check # scan .next/static/** for forbidden literals (e.g. TURNSTILE_SECRET_KEY)
npm run predeploy    # full pre-deploy gate: typecheck + lint + test + build + bundle:check
```

---

## Environment variables

Copy `.env.example` to `.env.local`. All values are server-only with one exception (Turnstile site key, which is public and read by server components and passed as a prop).

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | preview-optional, **production required** | Neon pooled connection string. Without it, the app uses an in-memory store. |
| `DATABASE_URL_UNPOOLED` | preview-optional | For migrations |
| `SHARE_SIGNING_SECRET` | dev-warns, **prod required** | 64-byte hex; HMAC key for share/OG signing |
| `CRON_SECRET` | dev-warns, **prod required** | 32-byte hex; bearer for `/api/cron/daily-warm` |
| `IP_HASH_SALT_BASE` | dev-warns, **prod required** | 64-byte hex; HMAC base for daily IP-hash salt |
| `TURNSTILE_SITE_KEY` | dev-fallback, **prod required** | Cloudflare Turnstile site key; public (embedded in HTML) |
| `TURNSTILE_SECRET_KEY` | dev-fallback, **prod required** | Cloudflare Turnstile secret key; **server-only — never log, never client-bundle** |
| `NETLIFY_NEXT_SKEW_PROTECTION` | optional | Set `true` in production to enable Netlify skew protection |

`assertProductionEnv()` in `lib/env.ts` enforces the five production-required entries above (the three secrets plus both Turnstile keys).

In production, set values via Netlify CLI:

```bash
netlify env:set SHARE_SIGNING_SECRET "$(openssl rand -hex 64)"
netlify env:set CRON_SECRET "$(openssl rand -hex 32)"
netlify env:set IP_HASH_SALT_BASE "$(openssl rand -hex 64)"
netlify env:set DATABASE_URL "<from-neon>"
netlify env:set DATABASE_URL_UNPOOLED "<from-neon>"
netlify env:set TURNSTILE_SITE_KEY "<from-cloudflare>"
netlify env:set TURNSTILE_SECRET_KEY "<from-cloudflare>"   # mark as Contains secret values
netlify env:set NETLIFY_NEXT_SKEW_PROTECTION "true"
```

Real production keys are **never** written to any committed file.

---

## Storage

Two implementations behind the `Store` interface in `lib/store.ts`:

- **InMemoryStore (default).** Process-local. Resets on cold start. Good for previews and local dev.
- **PostgresStore (when `DATABASE_URL` is set).** Wires through Drizzle + Neon serverless driver. Provisioned out-of-band: create a Neon project directly and set `DATABASE_URL` + `DATABASE_URL_UNPOOLED` via `netlify env:set`. We do not use the Neon-on-Netlify Marketplace integration; direct provisioning gives clean rotation and clear ownership.

ADR: see [`DECISIONS.md`](./DECISIONS.md) → ADR-007 (initial) and ADR-4 (2026-04-30, env contract).

---

## Bot protection (Cloudflare Turnstile)

The `submitScore` and `claimHandle` Server Actions are gated by Cloudflare Turnstile. The widget renders inside the handle-picker dialog (`components/handle-dialog.tsx`) using `appearance: interaction-only`, meaning legitimate users see no challenge in the common case. The token is verified server-side by `lib/turnstile.ts` with a 10s timeout and fail-closed on every negative path.

In production, you must obtain a Turnstile site key + secret key from the Cloudflare dashboard (free, unlimited) and set both via `netlify env:set` before promoting to production. In local dev and Netlify deploy previews (where `NODE_ENV !== "production"`), the verifier substitutes Cloudflare's always-pass test keys automatically — you do not need to set them.

See `DECISIONS.md` ADR-1 (2026-04-30) for the rationale and `THREAT_MODEL.md` §P3 for the gate list.

---

## Deploy

Production deploy is a human-gated step. See [`RUNBOOK.md`](./RUNBOOK.md) for the deploy/rollback playbook and the eight named incident scenarios.

---

## Project layout

```
app/
  page.tsx                    # home (today's three games)
  about/page.tsx
  g/<game>/page.tsx + client  # three game implementations (read site key server-side)
  leaderboard/[game]/page.tsx
  share/[id]/page.tsx
  og/[game]/route.tsx         # signed OG image renderer (Node runtime)
  api/cron/daily-warm/route.ts # bearer-only; called by netlify/functions/daily-warm.mts
  manifest.webmanifest/route.ts
components/
  arcade-shell.tsx            # nav + footer + layout
  countdown.tsx, game-card.tsx, share-result.tsx, handle-dialog.tsx
  turnstile-widget.tsx        # Cloudflare Turnstile client component
  ui/*                        # base primitives (Button, Input, Dialog, Toast, Card)
lib/
  env.ts, utils.ts, types.ts
  prng.ts, seed.ts            # deterministic daily seeds (xoshiro256**)
  sign.ts, share-payload.ts   # HMAC-signed share URLs
  store.ts                    # storage abstraction
  rate-limit.ts
  actions.ts                  # all Server Actions (Turnstile-gated)
  turnstile.ts                # server-only siteverify wrapper
  hooks/use-streak.ts, use-handle.ts
  games/word-volley.ts, drift-2049.ts, snap-trivia.ts
  content/word-targets.ts, trivia.ts, profanity.ts
netlify/
  functions/daily-warm.mts    # Netlify Scheduled Function — calls /api/cron/daily-warm
proxy.ts                      # Routing Middleware (security headers; auto-compiled to Netlify Edge Function)
netlify.toml                  # Netlify build config + scheduled function declaration
scripts/
  bundle-check.mjs            # asserts no forbidden literals in client bundle
```

---

## Testing

42 unit + integration tests. Run with `npm test`. Highlights:

- xoshiro PRNG determinism golden vectors
- Word Volley grading (greens-take-letters-before-yellows)
- Drift 2049 mechanics + replay verification
- Snap Trivia impossibly-fast detection + question-ID validation
- Submit Server Action: Turnstile gate first, malformed input, past dates, unsolved games, unknown question IDs
- Handle collision: Discord-style discriminator assignment
- Turnstile verifier: 12 fail-closed paths (timeout, non-200, bad JSON, hostname mismatch in production, etc.)

E2E via Playwright is in [`TEST_STRATEGY.md`](./TEST_STRATEGY.md) and slated to land alongside the Postgres store.

---

## Where to ask questions

- Architecture / decisions: `DECISIONS.md`
- Bugs and known issues: `BUGS.md`
- On-call / incidents: `RUNBOOK.md`
