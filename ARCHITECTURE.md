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

---

## 14. Slots subsystem (added 2026-05-01)

> **Status:** design-time delta for the slots feature. Two games ship sequentially: **Tideforge Pearls** (1,024-ways collection mechanic) then **Thornwood Path** (board-walk metamorphic-meter mechanic). See `DECISIONS.md` ADRs S1–S6 dated 2026-05-01 for the integration rationale.

### 14.1 Why this is a separate section

Slots break the daily-arcade gameplay grammar by design. The existing three games share: daily seed, once-per-day completion, emoji-grid share, shared streak, server-validated leaderboard. Slots have **none** of those affordances — they are unlimited-spin, non-deterministic, non-shareable, off-streak entertainment. This section captures only the surfaces where slots differ from the rest of the app; everything not mentioned here is unchanged.

### 14.2 Subsystem ownership

| Subsystem | Owner | Notes |
|---|---|---|
| **Slots route group** (`/slots`, `/slots/<slug>`) | senior-fullstack | Index page + per-game pages, RSC shells, client islands for the spin UI |
| **Slot math: Tideforge Pearls** | senior-backend | `lib/slots/tideforge-pearls/*` — pure logic, reel strips, paytable, bonus engine, RNG; Vitest unit + Monte Carlo harness |
| **Slot math: Thornwood Path** | senior-backend | `lib/slots/thornwood-path/*` — same shape, different mechanic |
| **Slots UI primitives** | frontend-experience | Reel-strip animation, win-line flash, meter fills, board-walk animation; honors `prefers-reduced-motion` |
| **Slot credit storage** | senior-fullstack | `lib/slots/credits.ts` — localStorage wrapper, per-game keying, default + reset |
| **Slots a11y** | frontend-experience + qa | No autoplay, no auto-spin, reduced-motion paths, ARIA live announcements for wins, keyboard-operable spin button |

### 14.3 Routing additions

| Route | Render | Purpose |
|---|---|---|
| `/slots` | RSC (static) | Index page listing both slot games with brief copy |
| `/slots/tideforge-pearls` | RSC shell + client island | Game 1 |
| `/slots/thornwood-path` | RSC shell + client island | Game 2 (added in second ship cycle) |

A discreet "Arcade Lounge" link is added to the global nav (or footer — TBD by frontend during build). The home page (`/`) and its today's-three-puzzles grid are **not modified**.

### 14.4 What slots do NOT add

This list is load-bearing for AppSec Pass 4 and for the threat-model delta. Slots **do not** add:

- No new Server Actions
- No new Route Handlers (no `/api/slots/*`)
- No new database tables, columns, or indexes
- No new Postgres writes from any code path
- No new Turnstile invocations
- No new HMAC-signed URLs
- No new OG image routes
- No new cron jobs
- No new env vars
- No new outbound HTTPS to third parties
- No new CSP relaxations

The existing CSP, the existing two Server Actions (`submitScore`, `claimHandle`), the existing OG route, and the existing cron route all remain exactly as they are. The slots feature is a pure-client feature on top of the existing routing and design-system primitives.

### 14.5 Local-only state schema (browser, no DB schema needed)

Slots add the following keys to `localStorage`. None are read or written server-side.

```
localStorage["slots:tideforge-pearls:credits"]  = number   // default 1000
localStorage["slots:tideforge-pearls:stats"]    = {        // optional, lightweight personal stats
  spinsPlayed: number,
  totalWagered: number,
  totalWon: number,
  bonusesTriggered: number,
  bestSingleWin: number,
  lastResetAt: string  // ISO timestamp
}
localStorage["slots:thornwood-path:credits"]    = number   // default 1000
localStorage["slots:thornwood-path:stats"]      = {...}    // same shape

localStorage["slots:settings"] = {
  reducedMotion: 'auto' | 'on' | 'off',  // 'auto' respects prefers-reduced-motion
  soundEnabled: boolean                   // default false; sound deferred to Polish
}
```

`stats` is **personal-only**, never submitted, never shared. The "Reset Balance" button in each game's UI restores `credits` to 1000 and zeros the `stats` block, recording `lastResetAt`.

### 14.6 RNG model

Slots use a per-spin random source. The contract is:

```ts
// lib/slots/rng.ts
export interface SlotRng {
  next(): number;          // returns [0, 1)
  nextInt(maxExclusive: number): number;
}
```

Production implementation wraps `crypto.getRandomValues` for high-entropy spin outcomes. Test implementation accepts an injected seed and runs xoshiro256** deterministically — this is what the Monte Carlo simulation harness uses to drive millions of spins per RTP run reproducibly.

**Slots do NOT consume `seedForDate`.** The daily-seed engine remains exclusively for daily-puzzle determinism. See ADR-S5.

### 14.7 Math module shape (for both games)

Each slot game ships as a self-contained module under `lib/slots/<slug>/`:

```
lib/slots/tideforge-pearls/
  index.ts            // public API: createGame(rng) → { spin, getState, applyAction, ... }
  reels.ts            // reel strips per game state (base, bonus, post-conversion)
  paytable.ts         // symbol payouts in coins per matched-way length
  ways.ts             // 1024-ways evaluator (game 1) — pure function
  bonus.ts            // free-spins state machine + collection meter
  types.ts            // SymbolId, ReelStripId, BonusState, SpinResult, etc.
  rtp-sim.ts          // Monte Carlo harness — runs N spins, returns hit freq, RTP, vol stats
  index.test.ts       // golden-vector unit tests
  rtp-sim.test.ts     // sim-target validation: assert RTP in [target ± 0.3%] over 5M spins
```

```
lib/slots/thornwood-path/
  index.ts
  basegame.ts         // cash-collect base mechanic
  meters.ts           // four meters (3 metamorphic + 1 free-games)
  bonus.ts            // board-walk state machine (40 nodes, hold-and-spin sub-feature, jackpot wheel)
  paytable.ts
  types.ts
  rtp-sim.ts
  ...tests
```

The math module is **the load-bearing engineering work**. UI is downstream. No UI ticket starts until the math RTP simulation hits its target band.

### 14.8 UI client island shape

Each game's page is an RSC shell that mounts a single client island:

```tsx
// app/slots/tideforge-pearls/page.tsx
import { TideforgePearls } from '@/components/slots/tideforge-pearls/Game';
export default function Page() {
  return (
    <main>
      <h1>Tideforge Pearls</h1>
      <TideforgePearls />
    </main>
  );
}
```

The client island holds:
- The local state (credits, current spin result, bonus state, meter fills)
- The math module instance (constructed once, persists across spins)
- The reel-strip animation (CSS transforms, GPU-accelerated; reduced-motion path renders the result frame directly)
- The spin button, bet selector, balance readout, paytable modal, reset button

**Accessibility commitments (enforced in Polish phase):**
- No autoplay, no auto-spin (spin button must be user-clicked every time)
- `prefers-reduced-motion: reduce` swaps reel animations for instant snap-to-result
- ARIA live region announces `"Win: X credits"` on every winning spin (politeness `polite`)
- Spin button is keyboard-operable; focus ring is the existing global `:focus-visible` style
- Color is not the sole win indicator (a winning combination also flashes a high-contrast outline)

### 14.9 Caching / SW behavior

Slots are added to the Serwist precache list as part of the static shell. Reel-strip art and symbol assets (when introduced as SVG bundles) are CDN-immutable and SW-cached. There is no per-day or per-user dynamic content for slots, so no cache-tag invalidation is needed.

### 14.10 Trust boundary delta

```
[Untrusted: browser/PWA]
   |
   | (slots are entirely client-side)
   |
   +-- localStorage (credits, stats) — non-authoritative, DevTools-editable, accepted
   |
   +-- per-spin crypto.getRandomValues — local entropy, no server hop
   |
   +-- no Server Actions, no Route Handlers, no DB, no third-party hops
```

The trust boundary diagram in §8 is **unchanged** for slots. No new arrows.

### 14.11 Performance budget for slots

| Metric | Target |
|---|---|
| First spin latency (after page load) | ≤ 50ms |
| Spin-to-spin frame budget | 16ms (60fps) for the win-flash; reel anim runs at GPU-compositor cost only |
| Slot page LCP (mobile, 4G) | ≤ 2.0s (same as rest of app) |
| Slot client-island JS (gzipped) | ≤ 60KB per game |

The math module is intentionally small and tree-shakeable. No external animation library — CSS transforms only.

### 14.12 Open questions for Phase 3 (math design spec)

The architecture is locked; the math is what the design spec resolves. Open questions to be answered in `docs/superpowers/specs/slots-tideforge-pearls.md`:

- Exact reel-strip composition per game state (base, bonus pre-threshold-4, bonus post-4, post-7, post-13, post-15)
- Exact paytable per symbol per way length (3-of-a-kind, 4-of-a-kind, 5-of-a-kind)
- Exact wild-multiplier distribution within bonus
- Exact scatter density for the 8/15/20-spin trigger frequencies
- Monte Carlo target: 5M spins, RTP within [94.0%, 94.5%], hit frequency within [22%, 28%], bonus trigger rate within [1/120, 1/180]
- Volatility class verification (high — feast-or-famine bonus profile)

Thornwood Path's design spec is deferred until Tideforge Pearls is live. Its open questions will mirror the above, plus the metamorphic-meter calibration (how often each meter fills, base-game cash-symbol density, board-traversal expected length, hold-and-spin sub-feature payout distribution, jackpot wheel tier weights and values).

---

## 15 — Card Parlor subsystem

The card parlor is a sibling lounge to the slots subsystem (Section 14). It hosts video-poker variants; gameplay loop is unlimited-play with play-money credits, no leaderboard, no streak impact, no server writes.

### 15.1 Routing
- `/cards/` — index page (server-prerendered static)
- `/cards/jacks-or-better` — JoB game route (server wrapper + client island)
- `/cards/deuces-wild` — Deuces Wild game route (server wrapper + client island)

The home page (`/`) and the slot lounge (`/slots/...`) are unchanged. Footer in `components/arcade-shell.tsx` carries TWO secondary links: "arcade lounge" → `/slots`, "card parlor" → `/cards`.

### 15.2 Subsystem ownership
| Concern | Owner |
|---|---|
| Card / hand types | `lib/cards/video-poker/types.ts` |
| RNG | `lib/cards/video-poker/rng.ts` (port of the slot SlotRng pattern) |
| Deck operations | `lib/cards/video-poker/deck.ts` |
| Hand evaluation | `lib/cards/video-poker/evaluate.ts` |
| Paytables | `lib/cards/video-poker/paytable.ts` |
| Round state machine | `lib/cards/video-poker/round.ts` |
| Credit / stats persistence | `lib/cards/video-poker/credits.ts` |
| Public API | `lib/cards/video-poker/index.ts` (barrel) |
| Variant client UIs | `app/cards/<slug>/<slug>-client.tsx` |
| Shared display components | `components/cards/*.tsx` |

### 15.3 What card games do NOT add
This is the load-bearing list AppSec mini-pass will check against.

- No new Server Actions
- No new Route Handlers (no `/api/cards/` paths)
- No `lib/store.ts` modifications, no DB tables
- No Turnstile invocations
- No OG image routes for cards
- No new cron jobs
- No new env vars (`lib/env.ts`, `.env.example` unchanged)
- No outbound HTTPS at runtime (the engine is fully client-side)
- No CSP relaxations (`proxy.ts` unchanged)

### 15.4 localStorage state schema
- `cards:jacks-or-better:credits` — number (default 1000)
- `cards:jacks-or-better:stats` — `SessionStats` JSON shape
- `cards:deuces-wild:credits` — number (default 1000)
- `cards:deuces-wild:stats` — `SessionStats` JSON shape

`SessionStats` shape (same shape used by the slot subsystem, re-implemented here for module independence):

```ts
interface SessionStats {
  handsPlayed: number;
  totalWagered: number;
  totalWon: number;
  bestSingleWin: number;
  // Per-rank hit counters for visible "rare hand" stats
  rankHits: Partial<Record<HandRank, number>>;
}
```

### 15.5 RNG model contract
- **Runtime:** `createCryptoRng()` wrapping `crypto.getRandomValues`, pulled fresh for each hand. No daily seed.
- **Tests:** `createSeededRng(seed: bigint)` using xoshiro256** for deterministic test fixtures. Same `SlotRng` interface as runtime (drop-in replaceable).

The RNG implementation is intentionally a port of the slot RNG — identical interface, identical implementation. If a third consumer appears, both modules can be migrated to a shared `lib/util/rng.ts` in a single refactor; until then, two-copy-one-shape is the YAGNI call.

### 15.6 Round state machine (the load-bearing logic)
```
dealing    — RNG draws 5 cards from a freshly shuffled 52-card deck
holding    — player toggles HOLD on 0..5 cards; primary action: DRAW
drawing    — held cards stay; un-held cards replaced from same deck (next 5−heldCount)
evaluating — final hand classified by `evaluateHand`; paytable applied; credits updated
done       — UI displays result; primary action: DEAL (transitions back to dealing)
```

The deck is shuffled per round (not per phase). The draw step pulls from positions 5..(5 + 5 − heldCount − 1) of the same shuffled deck. This is the standard physical-cabinet behavior.

### 15.7 Hand evaluator
Two evaluation modes, gated by `options.wildRank`:
- **Standard** (`wildRank: null`) — JoB uses this. 9-rank hierarchy topping at Royal Flush, with Jacks-or-better as the minimum paying hand.
- **Wild** (`wildRank: Rank.TWO`) — Deuces uses this. 10-rank hierarchy with Wild Royal Flush, Five of a Kind, and Four Deuces as additional ranks. Minimum paying hand is Three of a Kind (no pair pays).

The evaluator returns the highest-paying classification only; it never double-classifies a hand. Tie-breaking is unnecessary for paytable application but the evaluator is deterministic anyway.

### 15.8 UI client island shape
Per game, one client island (`app/cards/<slug>/<slug>-client.tsx`) following the Tideforge client pattern:
- React state for round phase, current deck, current hand, hold flags, current bet, current win, animating state
- Effects for card-flip animation timing (gated by reduced-motion)
- ARIA-live region for win announcements ("You win 25 credits.")
- Real `<button>` elements with focus-visible rings
- `aria-busy` during animation; `aria-disabled` when out of credits
- localStorage round-trip on every credit / stats update

### 15.9 A11y commitments
- No autoplay (every hand requires a button click)
- No auto-hold (the player picks holds explicitly)
- `prefers-reduced-motion: reduce` collapses card-flip and win animations to instant reveal, both via CSS keyframe override and via JS timer zero-out
- Tab order: bet selector → 5 hold buttons → DEAL/DRAW → reset/paytable
- Color contrast: card faces high-contrast against cabinet background; WCAG AA minimum

### 15.10 Performance budget
- Client island ≤60KB gzipped per game
- First-deal latency ≤50ms after DEAL is pressed
- No new dependencies — shipping React 19 + Tailwind 4 + the existing `cn()` utility

### 15.11 Trust boundary delta
None. The card parlor adds no new arrows on the trust boundary diagram in Section 4 — it touches only the client device.

### 15.12 Cross-references
- ADRs C1–C6 (`DECISIONS.md`, 2026-05-01) — integration boundaries
- Spec `docs/superpowers/specs/2026-05-01-card-parlor-design.md` — design rationale
- Math spec `docs/superpowers/specs/cards-video-poker-engine.md` — locked paytable values + golden vectors

