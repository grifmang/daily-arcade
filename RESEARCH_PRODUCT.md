# RESEARCH_PRODUCT.md — daily-arcade

**Author:** Product Researcher
**Date:** 2026-04-29
**Status:** Discovery deliverable

---

## 1. Problem statement

Casual web users want a tiny daily ritual that feels social without being noisy. Wordle proved that one shared puzzle per day, with a screenshotable result, can become a habit and a friend-group meme. Every Wordle clone since has competed for the *same* daily slot. The opportunity is not "another Wordle" — it's a **multi-game arcade** where one habit (the daily ritual) covers 3–4 distinct mechanics, so people who got tired of one puzzle don't churn off the brand. The core pain: existing single-game daily puzzles burn out because the mechanic is the whole product. A small, polished arcade with rotating mechanics and a unified streak/share grammar lets users renew their interest day to day.

---

## 2. Target users

Three concrete personas. All overlap with the NYT Games subscriber base and the Wordle / Connections / Mini Crossword regulars.

### Persona A — "Morning-coffee Ali" (primary)
- 28–45, knowledge worker, plays daily Wordle/Connections at breakfast or on commute
- Plays 1–3 puzzles per morning, ~5 minutes total
- Posts results to a 3–8 person friend group chat (iMessage, WhatsApp, Discord)
- Owns iPhone or Android; plays on mobile web 80% of the time
- Will not download a native app for a free game; will install a PWA if prompted at the right moment
- **What they want:** the "I did it before you, here's my grid" moment, every day, low friction

### Persona B — "Lunch-break Lex" (secondary)
- 22–35, office worker or student, plays during 10-minute breaks
- Sucker for "best score today" leaderboards, will replay to climb
- Doesn't share to friend groups but does post to Twitter/Bluesky/Threads occasionally for clout
- **What they want:** competitive feedback (where am I vs. the world?) and replay value within the day

### Persona C — "Streak-keeper Sam" (retention persona)
- 35–60, has played Wordle since 2022, hasn't missed a day in 400+
- Streak is a personal identity object — losing it is genuinely upsetting
- Will install a PWA if offered, will sign in if it protects the streak across phones
- **What they want:** zero-risk continuity. Streaks must survive cleared cookies and new devices.

**Anti-persona:** hardcore gamers, esports audience, anyone who plays >30 min/session. They are not the customer; designing for them ruins the product.

---

## 3. Jobs to be done

1. **When** I sit down with my morning coffee, **I want to** complete a small fresh challenge, **so I can** have a moment of accomplishment before work and post a result to my friend group chat.
2. **When** my friend posts their daily grid, **I want to** play the same puzzle and beat (or match) them, **so I can** participate in the running joke without effort.
3. **When** I'm bored on a 10-minute break, **I want to** play one quick game with a daily ranking, **so I can** see how I stack up against the world without committing to a long session.
4. **When** I've played the same daily puzzle for 30 days, **I want to** mix it up with a different mechanic, **so I can** keep the streak alive without burning out.
5. **When** I switch phones or clear my browser, **I want to** keep my streak, **so I can** preserve a thing I've spent months building.

---

## 4. Competitive landscape

| Product | Strength | Wedge for us |
|---|---|---|
| **Wordle** (NYT) | The original; perfect viral grid | Single mechanic; tied to NYT login; no leaderboard |
| **Connections** (NYT) | Strong daily ritual, great share grid | Single mechanic; no streak across NYT puzzles |
| **GeoGuessr Daily** | Incredible mechanic, sharp daily | Heavy assets, slow on mobile; not free for daily |
| **Wordpeak / Quordle / Octordle** | Wordle-adjacent volume plays | All variations on one mechanic; share fatigue |
| **Pokerogue / balatroguelike** | Deep daily seed runs | Wrong audience (long sessions, dedicated gamers) |
| **Sudoku.com / NYT Mini** | Daily habit, great a11y | No social viral grid; share is screenshot-only |
| **Cool Math Games / Poki / 1v1.lol** | Volume of casual games | No daily ritual, no shared seed, no streak |

**The wedge:** *Multiple distinct daily-seeded mechanics under one shareable grammar (emoji grid, streak, leaderboard).* No competitor has 3+ daily-seeded mechanics that all share one grid format and one streak counter. NYT comes closest but each puzzle is its own product silo — your Wordle streak doesn't help your Connections streak.

---

## 5. Game selection — **the pick**

Maximum viral coefficient × daily-return × distinct-mechanic. Three for MVP, one Fast Follow.

### MVP — ship these three

#### Game 1: **Word Volley** (word/logic)
- 6 guesses to find the daily 5-letter target word
- Wordle-style green/yellow/grey feedback grid
- Share string is the canonical Wordle emoji grid
- **Why pick:** the genre defines the share grammar and is the lowest-risk way to teach users "this is your daily share"
- **Differentiation from Wordle:** server-validated dictionary, allows uncommon-but-real words; we own the grid format

#### Game 2: **Drift 2049** (number/logic)
- 2048-style merge puzzle on a daily-seeded board
- Score-per-day: highest tile + total score
- Share string is a 4-emoji bar showing your peak tile (e.g., 🟦🟦🟪🟧 with 2048 highlighted)
- **Why pick:** completely different cognitive mode from Word Volley; replay value within the day (Persona B); deeply shareable when you hit a milestone tile

#### Game 3: **Snap Trivia** (knowledge/timing)
- 5 multiple-choice questions, 10 seconds each, daily set
- Score = correct answers × time bonus
- Share string is 5 emoji per question (⚡✅✅❌✅⚡ — bolt = fast, check/X = correct/wrong)
- **Why pick:** timing pressure is a third cognitive mode (not word, not spatial). Trivia is universally shareable ("how did you not know X?"). Five-question constraint means <60 second sessions.
- **Content source:** start with a curated bank (~500 questions) covering pop culture, history, science, sports, geography; rotated by daily seed. Optional later: LLM-generated supplement, see Technical research.

### Fast Follow (post-launch, when D1 retention validates)

#### Game 4: **Echo Reflex** (reaction/timing)
- 10-target reaction sequence on a daily-seeded layout
- Best total time wins
- Share string: ⏱️ + emoji bar of reaction-time buckets per target
- **Why hold for Fast Follow:** reaction games are device-sensitive (touch latency, screen size variance) and need anti-cheat infra that takes a beat to get right. Ship after the leaderboard hardening pass.

### Why **not** Word #2 (anagram, crossword, etc.)

Two word-games means anyone who doesn't like word-games churns off the whole arcade. The mechanic split (word / spatial / knowledge) maximizes the share-with-your-friend-group surface — at least one game lands for each archetype.

### Why **not** geography (GeoGuessr-style)

Image assets are heavy; PWA offline mode breaks; CDN cost grows fast on viral days. Could be a v2 game when there's revenue.

---

## 6. Feature priorities

### MVP (ship in v1.0)
1. Three daily-seeded games (Word Volley, Drift 2049, Snap Trivia)
2. Single shared streak counter across all three games (any-game-played counts; missed-day-of-any breaks)
3. Per-game emoji-grid share string (copy-to-clipboard, also rendered as OG image)
4. Per-game daily leaderboard (anonymous handles, top 100)
5. "Challenge a friend" link — shares the daily seed URL with optional pre-filled handle
6. PWA installable, offline support for the *currently cached* daily puzzle
7. No-auth play (default); optional sign-in only for streak sync across devices
8. Local-midnight reset with countdown to next puzzle

### Fast Follow (v1.1, weeks 2–4)
1. Game 4 (Echo Reflex)
2. Per-game streak (in addition to overall)
3. Friends list (private leaderboard among invited handles)
4. Weekly archive (replay yesterday's puzzles, doesn't count for leaderboard)

### Later
1. Native push notifications via PWA (gentle daily reminder)
2. Account migration / cross-device sync via Sign-in-with-Apple/Google
3. Themes / dark mode polish
4. User profile pages
5. Localization

### **Out of MVP — defendable cuts**
- Auth wall — every JTBD works without it (streak survives via localStorage; cross-device is Fast Follow)
- Real-time multiplayer — async via shared seed is the same viral mechanic without WebSocket cost
- User-generated puzzles — moderation cost > MVP value
- In-app purchases / ads — free-tier viability is the constraint; revenue is post-PMF problem

---

## 7. Risks & unknowns

| Risk | Severity | Mitigation |
|---|---|---|
| **Wordle clone fatigue** — users may dismiss as "just another" | High | Lean hard on the *arcade* framing in marketing copy and OG image. Three distinct games is the differentiator; show all three above the fold. |
| **Streak loss on cleared browser** is the #1 churn driver | High | Heavy localStorage redundancy + IndexedDB fallback; offer optional cross-device sync as a one-tap upsell after first 7-day streak |
| **Trivia content quality** can sink the game | Medium | Curated bank; manual review for pop-culture currency; obvious "report this question" affordance |
| **Leaderboard cheating** is inevitable; need to look credible without paranoid UX | Medium | Server-validated where feasible (Word Volley ✓, Trivia ✓); for Drift 2049 use replay verification on top-100 entries; document tradeoff in THREAT_MODEL.md |
| **Mobile keyboard friction** for word entry | Medium | Custom on-screen keyboard for Word Volley (don't trust mobile autocorrect); Frontend Experience owns this |
| **Day-1 traffic surge** could blow Hobby tier | Low at launch | Vercel Hobby + Neon free tier handles first ~10k DAU; document scaling steps in RUNBOOK |

### Things to validate post-launch with real users
- Is shared streak the right primitive, or do users want per-game streaks first? (Hypothesis: shared is right because it pulls cross-game discovery.)
- Does the "challenge a friend" link convert, or is the iMessage screenshot still dominant? (Hypothesis: link is incremental, not a replacement.)
- Trivia question selection — does the bank skew the wrong way for the audience?

---

## 8. Success metrics

- **D1 retention:** 35%+ at week 4 (Wordle benchmark territory)
- **D7 retention:** 18%+ (multi-game arcade hypothesis: better than single-game because of variety)
- **Share rate per finished game:** ≥15% click-to-share
- **Median completion rate (started → finished):** ≥70% per game
- **Cold-start LCP:** ≤2.0s on 4G mobile
- **Lighthouse a11y:** ≥95
- **Streak preservation:** <2% of users with 7+ day streaks lose them per week (proxy for storage robustness)

---

## 9. Brand & tone (input for Frontend Design)

- **Name candidate:** "Daily Arcade" (working). Open to alternatives.
- **Voice:** dry, friendly, terse. Wordle's three-line copy is the model. No "exciting!" or exclamation points by default.
- **Visual direction:** retro-arcade meets modern editorial. Think NYT Games meets a tasteful 80s arcade cabinet — bold typography, restrained palette, *not* Pixar/Duolingo. The Frontend Design skill should aim for "small indie game studio with taste," not "AI app template."
- **Mascot:** none. Mascots are an investment we don't need for v1.
- **Sound:** off by default; subtle tactile clicks only when on. Never auto-play music.

---

## 10. Recommendation to Principal

**Build the three MVP games as outlined.** Defer Echo Reflex to Fast Follow, defer auth to Fast Follow. The uncomfortable cut is *not* shipping more games — three is enough variety to defend against single-mechanic boredom, and shipping four out of the gate makes the arcade feel padded rather than curated.

The single most important product decision: **one shared streak across all three games.** Fragmented streaks fragment the habit. One streak makes the arcade *the* daily ritual, not three separate rituals.
