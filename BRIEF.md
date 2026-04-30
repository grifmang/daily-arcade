# BRIEF — daily-arcade

## One-liner
A daily-challenge arcade of bite-sized, addictive mini-games with shareable emoji-grid results, streaks, and a global leaderboard.

## Audience
Casual web users who love quick, shareable, low-commitment challenges. The Wordle / 2048 / GeoGuessr crowd — people who play 60–180 seconds at a time and screenshot/share their result.

## MVP shape
- **3–4 distinct mini-games** in one cohesive shell. Suggested seed set (Principal & Product Researcher to validate):
  1. **Word-chain / Wordle-adjacent** — daily target, 6 guesses, share grid
  2. **Number-merge / "2049"** — best-score-per-day on a daily seeded board
  3. **Reaction / aim-trainer** — fastest time on a daily seeded sequence
  4. **Trivia / pop-culture quiz** — 5 questions, shared with all players that day
- **Daily seed** — same puzzle for everyone every day (this is the Wordle viral mechanic)
- **Shareable results** — copy-to-clipboard emoji grid, OG image for social previews
- **Streaks & stats** — local stats with optional sync (no auth required to play)
- **Global leaderboard** — daily rankings per game, anonymous handles
- **Head-to-head challenge** — invite a friend via link to play the same daily seed
- **Mobile-first PWA** — installable, works offline for cached daily puzzles

## Constraints
- **Stack:** Next.js (App Router) on Vercel, AI SDK if any LLM use is justified
- **No auth wall** — guest play is the default; optional sign-in only for streaks-across-devices and leaderboards
- **Frictionless** — no installs, no signup, playable in <5 seconds from landing
- **Free tier viable** — must run on Vercel Hobby + a marketplace DB free tier for MVP

## Viral hooks (non-negotiable)
- Wordle-style emoji-grid share string
- Per-game OG images that embed score
- Daily reset at local-midnight w/ countdown to next puzzle
- Streak counter visible everywhere
- "Challenge a friend" link with seeded URL

## Out of scope for MVP
- Real-money rewards / gambling
- User-generated puzzles
- In-app purchases
- Native mobile apps (PWA only)
- Multiplayer real-time (head-to-head is async via shared seed)

## Success signals (for Principal to define metrics)
- D1 retention via streak completion
- Share-rate per finished game
- Cold-start time (Lighthouse)
- a11y ≥ 95
