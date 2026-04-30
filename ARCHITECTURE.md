# ARCHITECTURE.md — daily-arcade

**Author:** Principal Engineer
**Date:** 2026-04-29 (initial); revised 2026-04-30 for Netlify pivot
**Status:** Design phase deliverable (post-pivot)

> **Pivot note (2026-04-30):** This document was originally written against Vercel primitives. The deploy target has been changed to Netlify; sections 1, 2, 4 (cron row), 6, 8, 9, 10, 13 have been rewritten to reflect that. The data model, routing, game-logic flow, and threat surfaces are unchanged. See `DECISIONS.md` ADRs 1–5 dated 2026-04-30.

---

## 1. System overview

Daily Arcade is a single Next.js 16 (App Router) app deployed to **Netlify** via the OpenNext Netlify adapter. There is one frontend (the PWA), one backend (Route Handlers + Server Actions), and one persistent store (Neon Postgres). Bot protection is handled by **Cloudflare Turnstile** (a hosted siteverify endpoint, not a platform feature of the host). OG image rendering, runtime caching, and cron are Netlify-native.

```
                        +--------------------------+
                        |  Browser / Installed PWA |
                        |  - React 19 (RSC + CSC)  |
                        |  - Serwist Service Worker|
                        |  - localStorage (streaks)|
                        +-----------+--------------+
                                    |
                                    | HTTPS (Netlify CDN)
                                    |
              +---------------------v---------------------+
              |          Netlify Edge / CDN                |
              |  - Static assets, RSC payloads             |
              |  - Turnstile widget script (3rd-party CDN) |
              |  - Routing Middleware = Edge Function      |
              |    (auto-compiled from proxy.ts by adapter)|
              +---------------------+---------------------+
                                    |
                                    |
              +---------------------v---------------------+
              |  Next.js 16 on Netlify Functions (Node)    |
              |  Provisioned by @netlify/plugin-nextjs     |
              |  +------------------+  +-----------------+ |
              |  | App Router pages |  | Route Handlers  | |
              |  | (RSC, OG images) |  | (api/*)         | |
              |  +------------------+  +-----------------+ |
              |  +------------------+  +-----------------+ |
              |  | Server Actions   |  | Cron Route      | |
              |  | submit / claim   |  | /api/cron/      | |
              |  | + Turnstile gate |  |   daily-warm    | |
              |  +------------------+  +-----------------+ |
              |  +-------------------------------------+   |
              |  | OpenNext fine-grained cache (60s)   |   |
              |  | for leaderboard reads               |   |
              |  +-------------------------------------+   |
              +-----+-------------------------------+-----+
                    |                               |
                    | Neon driver                   | scheduled invoke
                    |                               | (00:00 UTC daily)
                    v                               v
              +-------------+         +---------------------------+
              | Neon        |         | Netlify Scheduled Function|
              | Postgres    |         | netlify/functions/        |
              | (direct)    |         |   daily-warm.mts          |
              | - leaderbd  |         | (cron 0 0 * * *, fetches  |
              | - shares    |         |  /api/cron/daily-warm     |
              | - daily_seed|         |  with bearer)             |
              | - trivia    |         +---------------------------+
              | - words     |
              +-------------+

                    +-------------------------------+
                    | Cloudflare Turnstile           |
                    | challenges.cloudflare.com      |
                    | - widget script (browser)      |
                    | - /turnstile/v0/siteverify     |
                    |   (server-side verify)         |
                    +-------------------------------+
```

---

## 2. Subsystems & owners

| Subsystem | Owner | Notes |
|---|---|---|
| **Design system & layout primitives** | frontend-systems | shadcn/ui base, Tailwind tokens, `components/ui/*`, `app/(arcade)/layout.tsx` |
| **Arcade shell** (home, game routes, nav, daily countdown) | frontend-systems | Routing, page structure, RSC composition |
| **Game: Word Volley** | senior-fullstack + frontend-experience | Mechanic in client; submit + validate server-side; custom on-screen keyboard |
| **Game: Drift 2049** | senior-fullstack + frontend-experience | Mechanic + move-log capture in client; replay verification server-side |
| **Game: Snap Trivia** | senior-fullstack + frontend-experience | 5-question flow, timer, answer validation server-side |
| **Daily seed engine** | senior-backend | xoshiro256\*\* PRNG; pre-warmed via daily cron |
| **Share grid & clipboard** | senior-fullstack | Per-game emoji grid, copy-to-clipboard + native share |
| **OG image generation** | senior-backend | `app/og/[gameId]/route.tsx` using `ImageResponse`; HMAC-signed payload |
| **Challenge link** | senior-fullstack | Signed seed URLs; pre-fills handle on landing |
| **Streak storage** | senior-fullstack | localStorage primary + IndexedDB shadow; **no server sync at MVP** |
| **Leaderboard read** | senior-backend | RSC fetch via Drizzle + Runtime Cache |
| **Leaderboard submit** | senior-backend | Server Action with Turnstile verify, rate limit, server-validation |
| **Anti-cheat (Drift 2049 replay)** | senior-backend | Move-log replay against daily seed |
| **PWA (service worker)** | senior-fullstack | Serwist; offline cache for `/today` |
| **Routing Middleware (security headers)** | devops-engineer | CSP, HSTS, etc. via `proxy.ts` (auto-compiled to Netlify Edge Function by adapter) |
| **Bot protection** | senior-backend + appsec | `lib/turnstile.ts` server-side verify; `<TurnstileWidget>` on submit + claim forms |
| **CI/CD & infra config** | devops-engineer | `netlify.toml`, GitHub Actions, env management via Netlify CLI/UI |
| **Tests** | qa-engineer + every engineer | Vitest unit, Playwright E2E, axe-core a11y |

---

## 3. Data model

### `daily_seeds` (precomputed daily configurations)
```sql
CREATE TABLE daily_seeds (
  date            DATE PRIMARY KEY,
  word_volley     JSONB NOT NULL,  -- { target: 'CRANE', allowable: [...] }
  drift_2049      JSONB NOT NULL,  -- { initial_board: [[2,0,0,2],...], seed: 8123478923 }
  snap_trivia     JSONB NOT NULL,  -- { question_ids: [12, 45, 78, 91, 134] }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
Populated by daily cron at 00:00 UTC; pre-warmed for the next 7 days at all times.

### `leaderboard_entries`
```sql
CREATE TABLE leaderboard_entries (
  id              BIGSERIAL PRIMARY KEY,
  game_id         TEXT NOT NULL,                -- 'word_volley' | 'drift_2049' | 'snap_trivia'
  date            DATE NOT NULL,
  handle          TEXT NOT NULL,                -- 3-12 chars
  discriminator   SMALLINT NOT NULL,            -- 0-9999
  score           INTEGER NOT NULL,             -- game-specific scoring
  metadata        JSONB NOT NULL,               -- { guesses, moveLog, timing, etc. }
  client_token    TEXT NOT NULL,                -- nonce returned to share URL
  verified        BOOLEAN NOT NULL DEFAULT false,
  ip_hash         TEXT NOT NULL,                -- sha256(ip + daily_salt) for anti-spam
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (game_id, date, handle, discriminator)
);

CREATE INDEX idx_leaderboard_top ON leaderboard_entries (game_id, date, score DESC, created_at ASC);
CREATE INDEX idx_leaderboard_ip_dedupe ON leaderboard_entries (game_id, date, ip_hash);
```

### `shares` (signed share lookups)
```sql
CREATE TABLE shares (
  id              TEXT PRIMARY KEY,             -- nanoid(10)
  game_id         TEXT NOT NULL,
  date            DATE NOT NULL,
  handle          TEXT NOT NULL,
  score           INTEGER NOT NULL,
  signature       TEXT NOT NULL,                -- HMAC-SHA256
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL          -- date + 30 days
);

CREATE INDEX idx_shares_expires ON shares (expires_at);
```

### `trivia_questions`
```sql
CREATE TABLE trivia_questions (
  id              SERIAL PRIMARY KEY,
  prompt          TEXT NOT NULL,
  choices         JSONB NOT NULL,               -- ['A','B','C','D']
  correct_index   SMALLINT NOT NULL,
  category        TEXT NOT NULL,                -- 'pop_culture' | 'history' | 'science' | 'sports' | 'geography'
  evergreen       BOOLEAN NOT NULL DEFAULT true,
  difficulty      SMALLINT NOT NULL DEFAULT 2,  -- 1=easy, 2=medium, 3=hard
  source          TEXT,                          -- attribution if from public dataset
  retired_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `words`
```sql
CREATE TABLE word_targets (
  word            CHAR(5) PRIMARY KEY,
  used_on         DATE                          -- null until consumed
);
CREATE INDEX idx_word_targets_unused ON word_targets (used_on) WHERE used_on IS NULL;

CREATE TABLE word_dictionary (
  word            CHAR(5) PRIMARY KEY            -- valid guesses (superset of targets)
);
```

### Local-only state (browser, no schema needed)

- `localStorage["streak"] = { current: number, lastPlayedUtc: 'YYYY-MM-DD', best: number }`
- `localStorage["handle"] = { handle: string, discriminator: number }`
- `localStorage["completed"] = { 'YYYY-MM-DD': { word_volley?: {...}, drift_2049?: {...}, snap_trivia?: {...} } }` (last 30 days)
- IndexedDB shadow of all the above (in case user clears localStorage selectively)

---

## 4. Routing

### Public app routes (RSC by default)
- `/` — arcade home: today's three games, streak, countdown to next puzzle
- `/g/word-volley` — Word Volley today
- `/g/drift-2049` — Drift 2049 today
- `/g/snap-trivia` — Snap Trivia today
- `/g/<game>?d=YYYY-MM-DD&from=<handle>` — challenge link entry point (renders today's game with friend handle pre-filled in handle picker)
- `/leaderboard/<game>` — today's leaderboard (top 100)
- `/share/<id>` — server-rendered share landing page; includes OG meta tags + auto-generated OG image; CTA to play yourself
- `/about` — short about page
- `/install` — PWA install hint page (deep-linked from "Add to Home Screen" prompts)

### Server Actions (used from client components)
- `submitScore({ gameId, date, score, handle, metadata })` — anti-cheat-aware; returns share id + URL
- `claimHandle({ handle })` — returns `{ handle, discriminator }`

### API Route Handlers (programmatic / SSR / cron)
- `GET /api/today/<game>` — returns today's seed config (called by SW for offline pre-cache)
- `GET /api/leaderboard/<game>?date=YYYY-MM-DD` — returns top 100 (OpenNext fine-grained cached, 60s)
- `GET /og/<gameId>` — `ImageResponse` route, validates HMAC, renders OG image (runs on a Netlify Function, Node runtime)
- `GET /api/cron/daily-warm` — warms tomorrow's seeds; **protected by `Authorization: Bearer ${CRON_SECRET}` only**; invoked daily by `netlify/functions/daily-warm.mts` (Netlify Scheduled Function), and manually invokeable for incident response

### Service worker
- `app/sw.ts` (compiled by Serwist) — precaches shell + today's seed; runtime caches static assets

---

## 5. Daily seed engine

```ts
// lib/seed.ts
import { xoshiro256ss } from './prng';

export function seedForDate(date: string /* YYYY-MM-DD */) {
  // Stable, deterministic, 256-bit state derived from date and a server-side salt.
  const dateInt = parseInt(date.replaceAll('-', ''), 10);
  const state = deriveState(dateInt, process.env.SEED_SALT!);
  return xoshiro256ss(state);
}
```

The cron precomputes 7 days ahead; if cron misses, `getDailySeed()` falls back to computing on demand and inserting into `daily_seeds`. Idempotent.

---

## 6. Submit flow (write path) — single canonical sequence

```
[Client] finished game
  -> compute score + metadata locally
  -> if first leaderboard submit ever, prompt for handle
  -> calls Server Action submitScore({ gameId, date, score, handle, metadata })

[Server Action]
  1. Turnstile token verify (POST to challenges.cloudflare.com/turnstile/v0/siteverify,
     10s timeout, fail-closed). On non-success → 403, log error-codes.
  2. Rate-limit by IP-hash for this game+date (max 5 submits/min, 20/day)
  3. Validate handle: 3-12 chars [a-zA-Z0-9_], not in profanity bank
  4. Validate score by game:
     - word_volley:    replay guesses against today's target; recompute score
     - snap_trivia:    replay timing+answers; recompute score (refuse if wall-clock < min_time)
     - drift_2049:     if entering top 100 by score, replay move log against today's seed
  5. Reject if computed score != claimed score
  6. Resolve handle collision:
     - SELECT existing discriminators for (game, date, handle)
     - assign next free discriminator (or first-time random 0-9999)
  7. INSERT INTO leaderboard_entries (verified=true)
  8. INSERT INTO shares (id=nanoid(10), signature=HMAC(gameId|date|score|handle))
  9. Return { shareId, shareUrl, discriminator, rank, totalToday }

[Client]
  -> renders share grid
  -> offers copy-to-clipboard + native share
  -> updates streak (any-game-completed-today)
  -> updates localStorage completed map
```

Failure modes:
- Turnstile failure → friendly "we couldn't verify this submission, try again" + reset widget + retry CTA. Specific Turnstile error codes (`timeout-or-duplicate`, `invalid-input-response`, etc.) are logged server-side but never surfaced to the user.
- Rate-limit hit → "too many submits, wait a bit" (P95 user never sees this)
- Server-side score mismatch → log + return generic "score couldn't be verified" (do not leak which check failed); refuse to write entry

The `claimHandle` Server Action follows the same gate-then-validate pattern: Turnstile verify → handle format check → profanity check → discriminator allocation.

---

## 7. Read paths

### Home (`/`)
- RSC: today's seed (cached), user's streak (client-only render), countdown (client-only)
- No DB hit on cold load other than seed lookup (cached for the day via OpenNext fine-grained cache, tag `seed:<date>`)

### Leaderboard (`/leaderboard/<game>`)
- RSC: cache tag `leaderboard:<game>:<date>`, TTL 60s (OpenNext fine-grained cache)
- On miss: `SELECT handle, discriminator, score FROM leaderboard_entries WHERE game_id=$1 AND date=$2 ORDER BY score DESC, created_at ASC LIMIT 100`
- Client polls every 60s while leaderboard is open (small payload, capped)
- Submit invalidates via `revalidateTag(\`leaderboard:${gameId}:${date}\`)`

### Share landing (`/share/<id>`)
- RSC: Drizzle lookup by primary key
- OG meta tags include `og:image` pointing to `/og/<gameId>?id=<shareId>`
- `ImageResponse` route validates the HMAC stored on the share record, renders the image; cached by Netlify CDN at the URL level (signature is in the share record, not the URL — URL is a stable identifier)

---

## 8. Trust boundaries

```
[Untrusted: browser/PWA]  <-- (a)  -->  [Netlify CDN/Edge]
                                              |
                                              | (b)
                                              v
                                        [Netlify Functions / Edge Functions]
                                              |
                              +---------------+--------------+
                              |                              |
                              | (c1) DB                      | (c2) external
                              v                              v
                        [Neon Postgres]            [Cloudflare Turnstile siteverify]
                                                   (challenges.cloudflare.com)
```

(a) Browser → CDN: All public assets. Sensitive: Turnstile widget script + iframe loaded from `challenges.cloudflare.com` (CSP-pinned), signed share URLs.
(b) CDN → Functions: trusted internal hop on Netlify; bearer token guards `/api/cron/*`. Routing Middleware (`proxy.ts`) is auto-compiled into a Netlify Edge Function by the OpenNext adapter and applies security headers to every response.
(c1) Functions → Postgres: Neon serverless driver with `DATABASE_URL` (env-only; never client-bundled).
(c2) Functions → Turnstile siteverify: outbound HTTPS with 10s timeout, fail-closed. Only the server-side `TURNSTILE_SECRET_KEY` and the user-submitted token are sent. No PII; the optional `remoteip` field is omitted (we already maintain privacy via daily-salted IP-hash for rate-limit, not identity).

(d) No other external integrations in MVP. (Clerk added in Fast Follow only.)

Highest-risk surfaces:
- Submit Server Action — write path, viral target. Turnstile-gated.
- Claim-handle Server Action — handle squatting target. Turnstile-gated.
- OG image route — public, signed; signature failure must never render
- `/api/cron/daily-warm` — publicly addressable, must reject without bearer; Netlify Scheduled Function is the only scheduled caller

---

## 9. Caching strategy

| Resource | Cache | TTL | Invalidation |
|---|---|---|---|
| Today's seed (RSC) | OpenNext fine-grained cache (Netlify) | until 24h00 UTC | tag `seed:<date>` |
| Leaderboard top-100 | OpenNext fine-grained cache (Netlify) | 60s | tag `leaderboard:<game>:<date>`, `revalidateTag` on submit |
| OG image render | Netlify CDN | 1 day | URL is `(gameId, shareId)`-keyed; share record is immutable so URL is stable |
| PWA shell (HTML, JS, CSS) | Service worker (Serwist) | until SW update | new build version |
| Today's seed (PWA) | Service worker | until next UTC midnight | force refetch on date change |
| Static word/trivia bundles | CDN immutable + SW | forever (versioned filename) | new bundle on dictionary update |

Skew protection: opt in by setting `NETLIFY_NEXT_SKEW_PROTECTION=true` in Netlify env. With the OpenNext adapter, this synchronizes client requests with the deployment that served the page, mitigating asset-404s during overlapping deploys. Recommended for production; not required for MVP correctness.

---

## 10. Observability

- **Netlify Functions logs** (default) — every Server Action and Route Handler runs as a Netlify Function; logs are searchable via the Netlify dashboard and exportable via log drains.
- **Netlify Scheduled Function logs** — `daily-warm.mts` invocation history visible on the Functions page with `Scheduled` badge and next-run timestamp.
- **Netlify built-in site analytics** — page views, top pages (server-side, no client script — privacy-respecting). Sufficient for MVP traffic visibility.
- **Structured `console.log`** — JSON shape `{ level, route, eventType, ...fields }` for log-drain ingestion later if needed.
- **No 3rd-party error tracker or RUM in MVP** (Sentry / PostHog / etc. are Fast-Follow adds). CWV per-route is monitored via Lighthouse CI on PR builds, not RUM.

Key metrics to log per route:
- Submit: `{ gameId, date, scoreClaimed, scoreComputed, accepted, durationMs }`
- Turnstile: `{ verdict, route, errorCodes }` (only on failures; do not log challenge-ts as it's tied to user session timing)
- Cron daily-warm: `{ date, generatedSeeds, durationMs }`

---

## 11. Performance budget

| Metric | Target |
|---|---|
| LCP (mobile, 4G) | ≤ 2.0s |
| INP | ≤ 200ms |
| CLS | < 0.1 |
| JS bundle (entry route) | ≤ 120KB gzipped |
| Submit Server Action p95 | ≤ 400ms |
| Leaderboard read p95 (cache hit) | ≤ 80ms |
| Leaderboard read p95 (cache miss) | ≤ 250ms |

---

## 12. Deferred / Fast Follow

- Auth (Clerk) for cross-device streak sync
- Echo Reflex (Game 4)
- Per-game streaks
- Friends list + private leaderboard
- Weekly archive (replay yesterday)
- Push notifications via PWA
- Sentry error tracking
- Localization

---

## 13. Open seams (call out for AppSec — Pass 3 design-time)

- **Submit Server Action** — primary write path, the leaderboard integrity surface. Now Turnstile-gated.
- **Claim-handle Server Action** — handle squatting surface. Now Turnstile-gated.
- **OG image route** — public, must validate HMAC; failure mode must not render anything sensitive
- **Cron route** — bearer-only (Vercel-cron-header alternative removed)
- **Turnstile siteverify outbound** — fail-closed on network error / non-200; 10s timeout; never log the token (single-use, but log discipline still matters)
- **CSP delta** — `proxy.ts` now allows `https://challenges.cloudflare.com` in `script-src`, `connect-src`, `frame-src`. Drops Vercel analytics origins. AppSec to verify the new CSP is no looser than the old one in any other dimension.
- **No PII** — handles are user-chosen pseudonyms, not emails. IP is hashed (with daily-rotating salt) for spam dedup only; not stored as PII. We do **not** send `remoteip` to Turnstile.
- **localStorage streaks** — non-authoritative; even if forged, it only affects the user's own client display
- **Share URL signature secret** — must be in env, scoped per environment, rotatable without invalidating active shares (use key-id versioning if rotating)
- **Turnstile secret key** — server-only; must never appear in client bundles or RSC output. Verify with bundle-inspect before deploy.
