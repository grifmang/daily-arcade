# RESEARCH_TECHNICAL.md — daily-arcade

**Author:** Technical Researcher
**Date:** 2026-04-29 (initial); revised 2026-04-30 for Netlify pivot
**Status:** Discovery deliverable (post-pivot)

> **Pivot note (2026-04-30):** Original research targeted Vercel. Deploy target was changed to Netlify; rows for Runtime, DB provisioning, Config, Bot protection, Analytics have been updated. Game-logic / data-model / scoring / anti-cheat rows are unchanged. See `DECISIONS.md` ADRs 1–5 dated 2026-04-30.

---

## 1. Stack recommendation

### Adopt the defaults (with Netlify-shaped runtime + Turnstile for bot protection).

| Layer | Pick | Reason |
|---|---|---|
| Framework | **Next.js 16 App Router** on Netlify | First-class daily-seed support via `unstable_cache` / Cache Components; OG image generation; PWA-friendly. Netlify supports the App Router fully via the OpenNext adapter. |
| Runtime | **Node.js 22+ on Netlify Functions** (auto-provisioned by `@netlify/plugin-nextjs`) | Adapter is auto-installed; do NOT pin. Provisions a Netlify Function for SSR / Route Handlers / Server Actions and a Netlify Edge Function for Middleware. |
| Language | **TypeScript strict** | Non-negotiable for game state correctness |
| Styling | **Tailwind CSS** + shadcn/ui | shadcn for primitives, restyled. Tailwind tokens drive the retro-arcade aesthetic. |
| DB | **Neon Postgres** (direct project, not Marketplace) | Free tier supports MVP volume; SQL is the right tool for daily-bounded leaderboard queries. Same `DATABASE_URL` env shape, just provisioned outside Netlify and wired via `netlify env:set`. |
| Cache / KV | **OpenNext fine-grained cache** (Netlify-managed) for Next.js Full Route Cache + Data Cache; **Upstash Redis** **only** if leaderboard latency becomes the bottleneck | Defer Redis. Postgres + fine-grained cache covers MVP. |
| ORM | **Drizzle ORM** | Lightweight, SQL-first, plays well with Neon serverless driver. No Prisma — heavier and slower cold-start. |
| Validation | **Zod** | Standard. Used for API input + share-link payload. |
| Config | **`netlify.toml`** | Build command, scheduled-function declaration, fallback security headers (CSP authoritative is `proxy.ts`). |
| Auth (Fast Follow only) | **Clerk** | Cross-device streak sync is Fast Follow; no auth in MVP. Clerk works on Netlify out of the box. |
| Bot protection | **Cloudflare Turnstile** | Required on leaderboard submission and handle-claim Server Actions. See `DECISIONS.md` ADR-1 for rationale (chosen over Arcjet and hCaptcha). |
| Cron | **Netlify Scheduled Functions** | `netlify/functions/daily-warm.mts` schedules at `0 0 * * *` UTC; calls existing `/api/cron/daily-warm` route handler with bearer auth. |
| AI | **None for MVP** | Trivia uses curated content bank (deterministic, audit-able). LLM-generated trivia is a v2 enhancement only after PMF. Document in DECISIONS as deviation point. |
| E2E | **Playwright** + `@axe-core/playwright` | Default |
| Unit | **Vitest** | Default |
| Forms | **React Hook Form + Zod resolver** | Used for handle entry on first leaderboard submit |
| Animation | **CSS transitions** + **framer-motion** for the share-grid reveal only | Heavy motion lib reserved for the moments that matter |
| Analytics | **Netlify built-in site analytics** | Server-side page-view tracking, no client script. RUM / CWV-per-route is Fast-Follow (vendor TBD). |
| OG images | **Next.js `ImageResponse`** (App Router built-in) | Renders on a Netlify Function (Node runtime); cached at the URL level by Netlify CDN. |
| PWA | **Serwist** (next-pwa is unmaintained) | See section 4 |
| Icons | **Lucide React** | Standard |

### Why **no** AI SDK / Vercel AI Gateway in MVP

The brief says "AI SDK if any LLM use is justified." None of the MVP features need it:
- Daily seed → deterministic PRNG (xoshiro256\*\*) keyed by `YYYY-MM-DD`
- Word target → curated word list
- Trivia questions → curated bank
- Leaderboard / share → no language generation needed

Adding an AI dependency adds latency, cost, prompt-injection surface, and zero user value at MVP. Save the LLM budget for a v1.1 "trivia question generation pipeline" run *offline*, not at request time, with editor review before publishing.

---

## 2. External dependencies

### Direct npm dependencies

| Package | Purpose | License | Last release | Weekly DLs | Status |
|---|---|---|---|---|---|
| `next` (16.x) | Framework | MIT | recent | huge | First-class |
| `react` / `react-dom` (19.x) | UI | MIT | recent | huge | First-class |
| `tailwindcss` (4.x) | Styling | MIT | recent | huge | First-class |
| `drizzle-orm` + `drizzle-kit` | ORM | Apache-2.0 | recent | high | Healthy |
| `@neondatabase/serverless` | Neon driver | Apache-2.0 | recent | high | First-class |
| `zod` (4.x) | Validation | MIT | recent | huge | First-class |
| `lucide-react` | Icons | ISC | recent | high | Healthy |
| `framer-motion` (or `motion`) | Animation | MIT | recent | huge | Healthy |
| `react-hook-form` | Forms | MIT | recent | huge | Healthy |
| `serwist` | PWA service worker | MIT | recent | medium | **Replaces deprecated `next-pwa`** |
| `nanoid` | Short share IDs | MIT | recent | huge | First-class |
| `clsx` + `tailwind-merge` | Class composition | MIT | recent | huge | First-class |
| `@netlify/functions` | Scheduled function types + Context object | MIT | recent | high | First-class |
| `@marsidev/react-turnstile` (or vanilla script include) | Turnstile widget on client | MIT | recent | medium | Healthy. Vanilla `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js">` is also viable and avoids a dep. |

### Dev dependencies

| Package | Purpose |
|---|---|
| `vitest`, `@vitest/coverage-v8` | Unit tests |
| `@playwright/test` | E2E |
| `@axe-core/playwright` | a11y in E2E |
| `@types/*` | TypeScript types |
| `eslint`, `eslint-config-next`, `@typescript-eslint/*` | Lint |
| `prettier`, `prettier-plugin-tailwindcss` | Format |

### External services (provisioned outside Netlify)

| Service | Purpose | Tier | Env vars (set manually via Netlify CLI/UI) |
|---|---|---|---|
| **Neon Postgres** (direct project) | Leaderboards, shares, streaks (signed-in users only) | Free | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| **Cloudflare Turnstile** | Bot protection on submit + handle-claim Server Actions | Free (unlimited) | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |

No paid services in MVP. Stop and ask before adding any.

### Netlify-native primitives (no external setup)

| Primitive | Purpose |
|---|---|
| **Netlify Functions** (provisioned by OpenNext adapter) | Hosts SSR / Route Handlers / Server Actions / OG image route |
| **Netlify Edge Functions** (provisioned by OpenNext adapter) | Hosts Next.js Middleware (`proxy.ts`) — auto-compiled, no manual port |
| **Netlify Scheduled Functions** | `netlify/functions/daily-warm.mts` runs at `0 0 * * *` UTC |
| **Netlify CDN** | Static assets, RSC payload caching, OG image edge cache |
| **Netlify Image CDN** | `next/image` automatic optimization |
| **Skew protection** | Opt-in via `NETLIFY_NEXT_SKEW_PROTECTION=true` |

---

## 3. Integration cost

| Item | Cost | Notes |
|---|---|---|
| Daily seed generator | **trivial** | Pure function: `xoshiro256(date_int)`. Test with golden vectors. |
| Word target list | **trivial** | Bundle 2,500-word answer list + 12,000-word guess dictionary as static JSON; gzipped <100KB |
| Trivia content bank | **a day** | Need to write/curate 500 questions; can use public-domain trivia datasets (Open Trivia DB CC-BY-SA 4.0) as a seed and edit. **Action item for build phase.** |
| Drift 2049 mechanic | **a day** | 2048 implementations are well-documented; daily seed = initial board layout |
| Share-grid copy-to-clipboard | **trivial** | `navigator.clipboard.writeText`; fallback to textarea select |
| OG image per game | **trivial** | Next.js `ImageResponse` route per game; embed score from URL params with HMAC signature to prevent forgery |
| Leaderboard with anti-cheat | **a week** | Word Volley + Trivia: server-validate every submission. Drift 2049: store move log, replay-verify top entries. Echo Reflex (Fast Follow): rate-limit + sanity-bounds. |
| PWA + offline | **a day** | Serwist with custom precache for `/today` route + assets; hard part is making the daily-cache invalidate at midnight |
| Streak storage with redundancy | **a day** | localStorage primary, IndexedDB shadow, optional server-sync (Fast Follow) |
| Challenge-link mechanic | **trivial** | Daily seed URL is just `/g/<game>?d=<YYYY-MM-DD>&from=<handle>`; no special infra |
| Mobile virtual keyboard for Word Volley | **a day** | Frontend Experience scope; do not trust mobile autocorrect |
| Cron for daily-reset edge cases | **trivial** | Netlify Scheduled Function at `0 0 * * *` UTC pre-warms tomorrow's seed and finalizes previous day's leaderboard |

**Scary stuff:** the **leaderboard anti-cheat** is the only "a week" item. Plan for it; do not let it become a 3-day item that ships broken.

---

## 4. Open questions for Build phase

### 4.1 Storage choice — **Postgres only, no Redis at MVP**

Considered Upstash Redis as primary leaderboard store using sorted sets (ZADD/ZRANGEBYSCORE). The latency win is real (~10ms vs ~30-50ms via Neon serverless). But:
- Free tier limits (500K commands/day on Upstash) are realistic for MVP traffic but not for a viral spike
- Redis-only loses the SQL ergonomics for analytics and admin queries
- Two stores doubles operational surface

**Decision:** Postgres-only. Use the OpenNext fine-grained cache layer (Netlify-managed) in front of leaderboard reads (60-second TTL is fine for top-100). Revisit Redis if leaderboard p95 read latency exceeds 200ms after launch.

### 4.2 Daily seed: per-user-timezone vs UTC

Wordle uses local-midnight per user, NYT uses Eastern. Local-midnight is friendlier but breaks "I played the same puzzle as my friend" if friend is in another timezone.

**Decision:** **One daily puzzle per UTC day, but display countdowns in user-local time.** When a user opens the app at 11pm local on UTC Tuesday, they see Tuesday's puzzle plus a countdown to Wednesday's. This keeps the share-with-friend mechanic intact (everyone-on-Earth is on the same puzzle) and is what most copycats settled on after the initial Wordle TZ chaos. Document in DECISIONS.

### 4.3 OG image forgery

Per-game OG images embed a score. If we render `?score=999999` we get cheating screenshots. Sign the share payload server-side with HMAC; OG route validates the signature before rendering.

**Decision:** every share URL gets a signed token (`s` query param = HMAC of `gameId|date|score|handle`). OG image route refuses to render if the signature doesn't validate. Keeps the share viral-friendly (it's still just a URL) without shipping a forgery vector.

### 4.4 Anonymous handle conflicts

Two players want "GAMER1" on the same day's leaderboard. Options:
- Server enforces unique handle per (game, date) — friction
- Allow duplicates, append a discriminator (`GAMER1#42`) — Discord pattern
- Force first-time handle pick to be globally unique — keeps the brand cleaner

**Recommendation:** **Discord-style discriminator on collision.** No friction, leaderboard shows "GAMER1#42 — 9182". Simple to implement, easy to live with.

### 4.5 PWA service worker — Serwist over `next-pwa`

`next-pwa` has been dormant since 2023 and doesn't fully support App Router. **Serwist** is the maintained successor (built on Workbox, App Router-aware). Adopt it. **Do not** ship a custom service worker hand-rolled.

### 4.6 Trivia content currency

Pop-culture trivia rots. "Most-streamed song of 2024" is wrong by 2026.

**Decision:** tag every trivia question with `evergreen: true|false`. MVP bank is 80% evergreen + 20% timely. Build a simple admin path (env-protected) to retire/edit questions later. **Do not** auto-generate via LLM at request time — too risky for content-quality issues.

### 4.7 Anti-cheat for Drift 2049

Score depends on player skill on a deterministic board. Possible cheats: bots playing the board, replay scripts.
- Server-side replay verification of top-N submissions (replay the move log; if final state matches, accept)
- Combined with Cloudflare Turnstile on submit (per ADR-1, post-pivot)
- Acceptable degradation: bottom 90% of leaderboard is unverified; top 10 is replay-verified

**Decision:** capture the move log in the client, send with score. Server replays for top 100. Document tradeoff in THREAT_MODEL.

---

## 5. Reference implementations (read, not just linked)

- **NYT Wordle** (live) — share grammar, daily reset, streak — primary reference for tone and brevity
- **`cwackerfuss/react-wordle`** — open-source Wordle clone in React, useful for the Word Volley mechanic skeleton (MIT)
- **`cleitonleonel/play-2048-react`** — 2048 mechanic in React, decent baseline for Drift 2049
- **Open Trivia DB** (`opentdb.com`) — CC-BY-SA 4.0 trivia dataset for Snap Trivia content seed (require attribution if used directly; better to manually curate)
- **Netlify Next.js platform starter** (`netlify-templates/next-platform-starter`) — canonical OpenNext-adapter setup
- **OpenNext Netlify adapter** docs (`opennext.js.org/netlify`) — supported features, edge cases, forms integration notes
- **Serwist Next.js example** in their repo — the canonical PWA setup for App Router
- **NYT Games team blog** — for product-side framing of streak preservation strategies

---

## 6. Tradeoffs summary

- **Postgres over Redis** — sacrificing some leaderboard latency for operational simplicity
- **Curated trivia over LLM-generated** — sacrificing content velocity for quality control
- **No auth in MVP** — sacrificing cross-device streak guarantees for frictionless onboarding
- **Single-region Postgres** — fine for free tier; if/when we need EU region, Neon Marketplace supports it; revisit at scale
- **PWA over native** — sacrificing platform-store discoverability for build velocity (already in brief)

---

## 7. Recommendation to Principal

Adopt the defaults verbatim. The two judgment calls worth flagging in DECISIONS:

1. **No AI SDK in MVP** (deviation from "use AI SDK if justified" — it isn't justified yet).
2. **Postgres-only, Redis deferred** (deviation from a maximum-perf approach in favor of simpler ops; revisit on data).

Everything else is uncontroversial. Build phase risk is concentrated in **leaderboard anti-cheat** — schedule the Drift 2049 replay verification as a single 5-day ticket owned by senior-backend, not split across multiple engineers.
