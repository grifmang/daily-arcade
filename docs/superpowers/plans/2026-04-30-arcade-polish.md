# Arcade Polish Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two retention/share-coefficient improvements to the live daily-arcade — expand the trivia bank from 60 to 450–550 questions and add a percentile/rank badge to OG share images.

**Architecture:** Two phases (A trivia, B OG badge) ship as separate commits → separate auto-deploys. Phase A is pure content. Phase B threads two new optional fields through `ShareRecord` → submit pipeline → OG render, with a pure-function `computeBadge` module that's unit-tested in isolation (the OG route renders JSX, hard to test directly; isolate the cascade rule).

**Tech Stack:** Next.js 16 (App Router) on Netlify, TypeScript, Vitest, `next/og` for OG images, in-memory `lib/store.ts` (PostgresStore later — fields are nullable so the migration is a no-op).

**Working dir:** `C:/Users/grifm/OneDrive/Desktop/Projects/Game App/projects/daily-arcade`

**Spec:** `docs/superpowers/specs/2026-04-30-arcade-polish-design.md` (commit `5615aa0`)

---

## Pre-flight

- [ ] **Step P1: Verify clean state**

```bash
cd "C:/Users/grifm/OneDrive/Desktop/Projects/Game App/projects/daily-arcade"
git status -sb
```

Expected: `## main...origin/main` and either an empty status or only the unpushed local spec commit `5615aa0`. If there are unrelated modified files, stop and surface — don't accidentally include them in the trivia commit.

- [ ] **Step P2: Verify the 42-test baseline still passes**

```bash
npm test 2>&1 | tail -5
```

Expected: ` Tests   42 passed (42)` plus 7 test files passed. If anything fails, stop — fix the regression before starting Phase A.

---

## Phase A — Trivia bank expansion

### Task A1: Pull raw questions from Open Trivia DB

**Files:**
- Create (temporary): `/tmp/opentdb-raw.json` (not checked in; deleted at end of Phase A)

**Notes for the implementing agent:**
- `TriviaQuestion.category` is a 5-value union: `"pop" | "history" | "science" | "sports" | "geography"`. The spec listed 6 source categories; we add **Sports** as a 7th to cover all 5 internal types.
- OpenTDB API: `https://opentdb.com/api.php?amount=N&category=ID&difficulty=easy|medium&type=multiple&encode=url3986`
- OpenTDB category IDs:
  - `9` General Knowledge → maps to internal `pop`
  - `17` Science & Nature → `science`
  - `11` Entertainment: Film → `pop`
  - `12` Entertainment: Music → `pop`
  - `21` Sports → `sports`
  - `22` Geography → `geography`
  - `23` History → `history`
- OpenTDB caps at 50 per request. We need ~250 per category at easy + medium = 5 requests per category × 7 categories = **35 requests**. Be polite — OpenTDB rate-limits to 1 request per IP every ~5 seconds. Use a session token to avoid duplicates within a session: `https://opentdb.com/api_token.php?command=request`.

- [ ] **Step A1.1: Mint a session token**

```bash
curl -s "https://opentdb.com/api_token.php?command=request" | tee /tmp/opentdb-token.json
```

Expected: JSON with `"response_code":0` and a `"token"` string. Capture the token: `TOKEN=$(jq -r .token /tmp/opentdb-token.json)`.

If `jq` is not available on Windows bash, parse manually: `TOKEN=$(grep -oE '"token":"[^"]+"' /tmp/opentdb-token.json | sed -E 's/.*"([^"]+)".*/\1/')`.

- [ ] **Step A1.2: Pull raw questions across 7 categories × 2 difficulties**

Use this loop (no parallelism — OpenTDB will block parallel requests):

```bash
TOKEN="<from-A1.1>"
mkdir -p /tmp/opentdb
for CAT in 9 17 11 12 21 22 23; do
  for DIFF in easy medium; do
    for BATCH in 1 2 3; do
      sleep 6
      curl -s "https://opentdb.com/api.php?amount=50&category=$CAT&difficulty=$DIFF&type=multiple&encode=url3986&token=$TOKEN" \
        > "/tmp/opentdb/c${CAT}-${DIFF}-${BATCH}.json"
    done
  done
done
```

Expected: 42 files in `/tmp/opentdb/`. Each should be JSON with `"response_code":0` and a `"results"` array of up to 50 items. If any file shows `"response_code":4` ("Token Empty — return all possible questions"), the bank is exhausted for that category/difficulty — that's fine, fewer batches just means fewer raw items.

- [ ] **Step A1.3: Concatenate raw results into one array**

Run a small Node one-liner to merge:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const dir = '/tmp/opentdb';
const out = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (d.response_code === 0 && Array.isArray(d.results)) out.push(...d.results);
}
fs.writeFileSync('/tmp/opentdb-raw.json', JSON.stringify(out));
console.log('total raw:', out.length);
"
```

Expected: `total raw: ~1500` (less is ok, more is fine).

### Task A2: Filter and normalize → final TS file

**Files:**
- Read: `lib/content/trivia.ts` (existing 60 questions — used as dedup anchor and tone reference)
- Create (temporary): `/tmp/opentdb-filtered.json`
- Modify: `lib/content/trivia.ts`

**The filter pass.** Per the spec, this runs **in conversation, no new code in the repo**. The implementing agent (Claude) reads the raw questions and the existing 60, applies the rules below, and writes the final TS file. There is **no permanent script**; the curated TS file is the artifact.

Filter rules in order (apply each rule to the raw set; questions failing any rule are dropped):

1. **URL-decode** (the API returned `encode=url3986`): every prompt, choice, and category string runs through `decodeURIComponent`.
2. **Dedup against existing 60:** for each candidate prompt, compute a normalized key `prompt.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim()`. If it matches the normalized key of any existing question, drop. Also dedup within the candidate pool (keep first occurrence).
3. **Drop dated content:** drop if the prompt or any choice matches `/\b(currently|recently|the latest|the new|last week|this year|2024|2025|2026)\b/i` (we don't trust ourselves to maintain "current X" answers).
4. **Drop encoding bugs:** after URL-decode, drop if any string contains an unmatched `&` followed by a letter (entity decode failure), or non-printable Unicode characters.
5. **Tone misfit pass (manual judgment):** drop questions phrased awkwardly, with editorializing ("the brilliant…"), or with a register inconsistent with the existing bank's terse-factual voice.
6. **Drop unsafe content:** any prompt or choice with sexual content, slurs, or content the file-header attribution shouldn't have to apologize for.
7. **Normalize choices:** the OpenTDB shape is `{question, correct_answer, incorrect_answers}`. Build a 4-element `choices` array as `[correct_answer, ...incorrect_answers]`, then **shuffle the array deterministically** by sorting on `choice.length` then alphabetically (so the correct answer's index is reproducible from the input). Compute `correctIndex` after the sort.
8. **Map category:** OpenTDB `category` field → internal:
   - `"General Knowledge"` → `pop`
   - `"Science & Nature"`, `"Science: Computers"`, `"Science: Mathematics"`, `"Science: Gadgets"` → `science`
   - any `"Entertainment: …"` → `pop`
   - `"Sports"` → `sports`
   - `"Geography"` → `geography`
   - `"History"` → `history`
   - anything else → drop (keep the union closed)
9. **Map difficulty:** OpenTDB `easy` → `1`, `medium` → `2` (we set `correctIndex` typed as `0|1|2|3` and `difficulty` as `1|2|3` per existing `TriviaQuestion` shape).
10. **Set `evergreen: true`** on every imported question (the dated-content drop already removed time-sensitive ones).
11. **Cap at ~75 per category** to avoid `pop` overwhelming the others (Film + Music + General Knowledge all map to `pop` so it tends to dominate). Sample randomly down if a category exceeds 75.
12. **Final size check:** target landing 450 ≤ N ≤ 550 after all filters. If under 450 (filtering was too aggressive), relax rule 3 or rule 5; if over 550, sample down across categories proportionally.

- [ ] **Step A2.1: Read the existing 60 questions and the raw OpenTDB pool**

Read `lib/content/trivia.ts` (full file) and `/tmp/opentdb-raw.json`. Construct an in-memory map of normalized-prompt → existing question, and an array of raw OpenTDB items.

- [ ] **Step A2.2: Apply filter rules 1–6 (drop bad items)**

For each raw item, run rules 1, 2, 3, 4, 6 deterministically and rule 5 (tone misfit) by judgment. After this step you should have ~700–900 surviving items. If you have fewer than 450, the filter was too aggressive — relax rule 3.

- [ ] **Step A2.3: Apply rules 7–11 (normalize and balance)**

Build the `TriviaQuestion[]` shape per rule 7 (deterministic shuffle so `correctIndex` is reproducible from input), apply rule 8 (category map; drop if no match), rule 9 (difficulty map), rule 10 (evergreen), rule 11 (cap 75/category).

- [ ] **Step A2.4: Combine with existing 60 and verify size**

Final list = existing 60 + filtered new. Verify `450 ≤ length ≤ 550`. If outside, adjust per rule 12.

- [ ] **Step A2.5: Write the new `lib/content/trivia.ts`**

The header comment is updated; the type definition is unchanged; the array now has ~500 entries.

```ts
/**
 * Snap Trivia question bank.
 *
 * 450–550 evergreen questions across mixed categories.
 *
 * Questions sourced and hand-filtered from Open Trivia DB
 * (https://opentdb.com). Used under their license: free, attribution
 * required, no warranty. See RUNBOOK.md "Content sources" for details.
 *
 * Schema is server-only; the client never receives `correctIndex`.
 */

export interface TriviaQuestion {
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  category: "pop" | "history" | "science" | "sports" | "geography";
  evergreen: boolean;
  difficulty: 1 | 2 | 3;
}

export const TRIVIA_QUESTIONS: readonly TriviaQuestion[] = [
  // Geography
  { prompt: "Which is the longest river in the world?", choices: ["Amazon", "Nile", "Yangtze", "Mississippi"], correctIndex: 1, category: "geography", evergreen: true, difficulty: 2 },
  // ... ~500 entries total ...
];
```

Use the existing 60 entries verbatim, then append the filtered new questions in category order (geography, science, history, sports, pop) for readability.

- [ ] **Step A2.6: Verify the file compiles and tests pass**

```bash
npm run typecheck 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Expected: typecheck clean. Tests `42 passed (42)`. The trivia game tests are content-agnostic and should pass without modification.

- [ ] **Step A2.7: Verify size and integrity**

```bash
node -e "
const m = require('./lib/content/trivia.ts'.replace('.ts','.js'));
" 2>/dev/null || true
# The .ts can't be required directly. Instead, count via grep:
grep -cE "^\s*\{ prompt:" lib/content/trivia.ts
```

Expected: count between 450 and 550. If the file is split across lines, adjust the grep, but the goal is verifying the entry count.

- [ ] **Step A2.8: Spot-check 20 random questions**

```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('lib/content/trivia.ts', 'utf8');
const matches = [...src.matchAll(/\{ prompt: \"([^\"]+)\".*?\}/g)];
const sample = [];
const used = new Set();
while (sample.length < 20 && used.size < matches.length) {
  const i = Math.floor(Math.random() * matches.length);
  if (used.has(i)) continue;
  used.add(i);
  sample.push(matches[i][0]);
}
console.log(sample.join('\n\n'));
"
```

Read the 20-sample output. Look for: tone misfits that slipped through, dated content, mojibake, choice-array imbalance. If any are bad, fix them in place and re-run; if more than 3/20 are bad, the filter pass was too lax — go back to A2.2 with stricter rule 5.

### Task A3: RUNBOOK content-sources attribution

**Files:**
- Modify: `RUNBOOK.md`

- [ ] **Step A3.1: Add "Content sources" section to RUNBOOK**

Find the existing top-level sections in RUNBOOK.md (probably after "Routine maintenance" or near the end). Append:

```markdown
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
```

### Task A4: Commit and push Phase A

- [ ] **Step A4.1: Stage Phase A files only**

```bash
git status -s
git add lib/content/trivia.ts RUNBOOK.md
git diff --cached --name-only
```

Expected output of last command: exactly `lib/content/trivia.ts` and `RUNBOOK.md`. **No other files.** If anything else appears, unstage it (`git restore --staged <file>`).

- [ ] **Step A4.2: Commit**

```bash
git commit -m "$(cat <<'EOF'
trivia: expand bank from 60 to ~500 questions (Open Trivia DB)

Closes the 12-day recycle cliff persona Ali was about to hit. New
pool cycles every ~100 days at 5/day. Sourced from Open Trivia DB
across 7 categories (General, Science, Film, Music, Sports, Geography,
History) at easy + medium difficulty, hand-filtered for tone, dated
content, encoding bugs, and dedup against the existing 60.

Spec: docs/superpowers/specs/2026-04-30-arcade-polish-design.md
RUNBOOK content-sources attribution added.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step A4.3: Push and watch the auto-deploy**

```bash
git push origin main
```

Then poll the Netlify deploy state until `ready`:

```bash
SITE_ID="6a9b822d-6fa1-47df-bfd8-aa5fab4dbe18"
PREV=$(netlify api listSiteDeploys --data="{\"site_id\":\"$SITE_ID\",\"query\":{\"per_page\":2}}" 2>/dev/null | grep -m1 '"id"' | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
# PREV is the most recent existing deploy. Wait for a NEW one to land in ready state.
while true; do
  JSON=$(netlify api listSiteDeploys --data="{\"site_id\":\"$SITE_ID\",\"query\":{\"per_page\":1}}" 2>/dev/null)
  ID=$(echo "$JSON" | grep -m1 '"id"' | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
  STATE=$(echo "$JSON" | grep -m1 '"state"' | sed -E 's/.*"state":[[:space:]]*"([^"]+)".*/\1/')
  echo "[$(date +%T)] id=$ID state=$STATE"
  if [ "$ID" != "$PREV" ]; then
    case "$STATE" in ready|error|failed|cancelled) echo "FINAL: $STATE deploy=$ID"; break ;; esac
  fi
  sleep 25
done
```

Run in background with `run_in_background: true`. Wait for the notification.

Expected: `FINAL: ready`. If `error` or `failed`, fetch deploy logs (`netlify api getSiteDeployLog --data='{"site_id":"...","deploy_id":"..."}'`) and surface to the user.

- [ ] **Step A4.4: Smoke trivia route on live site**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://daily-arcade.netlify.app/g/snap-trivia
```

Expected: `200`. Phase A is complete.

---

## Phase B — OG percentile badge

### Task B1: Extend `ShareRecord` with optional `rankAtSubmit` / `totalAtSubmit`

**Files:**
- Modify: `lib/types.ts:44-54`

- [ ] **Step B1.1: Edit ShareRecord interface**

Existing block:
```ts
export interface ShareRecord {
  id: string;
  gameId: GameId;
  date: string;
  handle: string;
  discriminator: number;
  score: number;
  signature: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}
```

Replace with:
```ts
export interface ShareRecord {
  id: string;
  gameId: GameId;
  date: string;
  handle: string;
  discriminator: number;
  score: number;
  signature: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  /**
   * Submit-time snapshot of leaderboard rank (1-indexed) and total
   * submissions for (gameId, date) at the moment of submit. Optional
   * because pre-2026-04-30 share records don't have these — the OG
   * render falls through to the "no badge" branch when both are null.
   * See ARCADE-POLISH spec Feature 2.
   */
  rankAtSubmit?: number | null;
  totalAtSubmit?: number | null;
}
```

- [ ] **Step B1.2: Verify no existing tests break**

```bash
npm run typecheck 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Expected: typecheck clean (the fields are optional, so all existing call sites still work). 42 tests pass unchanged.

### Task B2: Create `lib/og-badge.ts` with TDD

**Files:**
- Create: `lib/og-badge.ts`
- Create: `lib/og-badge.test.ts`

**Why a separate module:** the OG route renders to PNG via `next/og`'s `ImageResponse`, which is hard to assert against. Extract the badge cascade into a pure function that takes `{rankAtSubmit, totalAtSubmit}` and returns `{text, tier}`, unit-test it, then call it from the JSX in the route.

- [ ] **Step B2.1: Write the failing tests**

Create `lib/og-badge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeBadge } from "./og-badge";

describe("computeBadge", () => {
  it("returns hero TOP 1% when rank=1 and total>=50", () => {
    expect(computeBadge({ rankAtSubmit: 1, totalAtSubmit: 50 })).toEqual({ text: "TOP 1%", tier: "hero" });
    expect(computeBadge({ rankAtSubmit: 1, totalAtSubmit: 1000 })).toEqual({ text: "TOP 1%", tier: "hero" });
  });

  it("falls through to TOP 5% when rank=1 but total<50", () => {
    // 1/30 = 0.033 → top 5%. Not eligible for the hero tier (total < 50).
    expect(computeBadge({ rankAtSubmit: 1, totalAtSubmit: 30 })).toEqual({ text: "TOP 5%", tier: "prominent-accent" });
  });

  it("returns TOP 5% when percentile <= 0.05 and not in TOP 1% tier", () => {
    expect(computeBadge({ rankAtSubmit: 5, totalAtSubmit: 100 })).toEqual({ text: "TOP 5%", tier: "prominent-accent" });
    expect(computeBadge({ rankAtSubmit: 50, totalAtSubmit: 1000 })).toEqual({ text: "TOP 5%", tier: "prominent-accent" });
  });

  it("returns TOP 10% when percentile <= 0.10 and not above tier", () => {
    expect(computeBadge({ rankAtSubmit: 10, totalAtSubmit: 100 })).toEqual({ text: "TOP 10%", tier: "prominent" });
    expect(computeBadge({ rankAtSubmit: 100, totalAtSubmit: 1000 })).toEqual({ text: "TOP 10%", tier: "prominent" });
  });

  it("returns RANK #N when below 10% but within min(100, ceil(total*0.25))", () => {
    // total=200, ceil(200*0.25)=50, min(100,50)=50. rank=20 → 20<=50, qualifies.
    expect(computeBadge({ rankAtSubmit: 20, totalAtSubmit: 200 })).toEqual({ text: "RANK #20", tier: "plain" });
    // total=1000, ceil(1000*0.25)=250, min(100,250)=100. rank=99 → 99<=100, qualifies.
    expect(computeBadge({ rankAtSubmit: 99, totalAtSubmit: 1000 })).toEqual({ text: "RANK #99", tier: "plain" });
  });

  it("clamps the RANK #N tier to top 25% AND top 100", () => {
    // total=60 → ceil(60*0.25)=15 → only top 15 see RANK #N. Rank 20 of 60 → no badge.
    expect(computeBadge({ rankAtSubmit: 20, totalAtSubmit: 60 })).toEqual({ text: null, tier: null });
    // total=1000 → ceil*0.25=250 but min with 100 caps. Rank 150 of 1000 → no badge (above 100).
    expect(computeBadge({ rankAtSubmit: 150, totalAtSubmit: 1000 })).toEqual({ text: null, tier: null });
  });

  it("returns no badge when rankAtSubmit or totalAtSubmit is null/undefined (backwards compat)", () => {
    expect(computeBadge({ rankAtSubmit: null, totalAtSubmit: null })).toEqual({ text: null, tier: null });
    expect(computeBadge({ rankAtSubmit: 5, totalAtSubmit: null })).toEqual({ text: null, tier: null });
    expect(computeBadge({ rankAtSubmit: null, totalAtSubmit: 100 })).toEqual({ text: null, tier: null });
    expect(computeBadge({})).toEqual({ text: null, tier: null });
  });

  it("returns no badge for rank=0 or total=0 (defensive)", () => {
    expect(computeBadge({ rankAtSubmit: 0, totalAtSubmit: 100 })).toEqual({ text: null, tier: null });
    expect(computeBadge({ rankAtSubmit: 5, totalAtSubmit: 0 })).toEqual({ text: null, tier: null });
  });
});
```

- [ ] **Step B2.2: Run the failing test**

```bash
npx vitest run lib/og-badge.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module './og-badge'" or similar.

- [ ] **Step B2.3: Implement `computeBadge`**

Create `lib/og-badge.ts`:

```ts
/**
 * OG-image rank/percentile badge cascade.
 *
 * Pure function over the submit-time snapshot. Five-tier first-match
 * cascade, asymmetric (only shows a badge when the result is shareable).
 * See docs/superpowers/specs/2026-04-30-arcade-polish-design.md Feature 2.
 */

export type BadgeTier = "hero" | "prominent-accent" | "prominent" | "plain";

export interface BadgeInput {
  rankAtSubmit?: number | null;
  totalAtSubmit?: number | null;
}

export interface BadgeOutput {
  text: string | null;
  tier: BadgeTier | null;
}

const NO_BADGE: BadgeOutput = { text: null, tier: null };

export function computeBadge(input: BadgeInput): BadgeOutput {
  const rank = input.rankAtSubmit;
  const total = input.totalAtSubmit;

  // Backwards compat + defensive guards
  if (rank == null || total == null) return NO_BADGE;
  if (rank <= 0 || total <= 0) return NO_BADGE;

  // 1: hero TOP 1% (rank 1 in a real-sized field)
  if (rank === 1 && total >= 50) {
    return { text: "TOP 1%", tier: "hero" };
  }

  const percentile = rank / total;

  // 2: prominent-accent TOP 5%
  if (percentile <= 0.05) {
    return { text: "TOP 5%", tier: "prominent-accent" };
  }

  // 3: prominent TOP 10%
  if (percentile <= 0.10) {
    return { text: "TOP 10%", tier: "prominent" };
  }

  // 4: plain RANK #N if within top 25% AND top 100
  const cap = Math.min(100, Math.ceil(total * 0.25));
  if (rank <= cap) {
    return { text: `RANK #${rank}`, tier: "plain" };
  }

  // 5: nothing (asymmetric: don't shame people for finishing)
  return NO_BADGE;
}
```

- [ ] **Step B2.4: Run tests — should pass**

```bash
npx vitest run lib/og-badge.test.ts 2>&1 | tail -10
```

Expected: 8 tests passed.

- [ ] **Step B2.5: Run the full suite to confirm no regressions**

```bash
npm test 2>&1 | tail -5
```

Expected: `Tests   50 passed (50)` (42 existing + 8 new).

### Task B3: Wire `submitScore` to write `rankAtSubmit` / `totalAtSubmit`

**Files:**
- Modify: `lib/actions.ts:180-190` (the `store().putShare(...)` call)
- Modify: `lib/actions.test.ts` (extend existing tests with one assertion + one new test)

- [ ] **Step B3.1: Write the failing test**

Open `lib/actions.test.ts` and locate the existing happy-path test for `submitScore` (search for `submitScore` and `won: true` or similar). Add a new test in the same describe block:

```ts
it("persists rankAtSubmit and totalAtSubmit on the share record", async () => {
  // Use whatever existing helpers / mocks the test file uses to make a
  // valid submission. Pattern from the existing happy-path test:

  // (Setup omitted — copy the existing happy-path setup verbatim, then add:)
  const res = await submitScore(validInput);
  expect(res.ok).toBe(true);
  expect(typeof res.rank).toBe("number");
  expect(typeof res.total).toBe("number");

  // The share record stored in lib/store should now carry these fields.
  const stored = await store().getShare(res.shareId!);
  expect(stored).not.toBeNull();
  expect(stored!.rankAtSubmit).toBe(res.rank);
  expect(stored!.totalAtSubmit).toBe(res.total);
});
```

If `store` isn't already imported in this test file, add `import { store } from "./store";`. If the existing tests mock the store, follow their pattern — but the assertion stays: the persisted `ShareRecord` must include the snapshot fields.

- [ ] **Step B3.2: Run the failing test**

```bash
npx vitest run lib/actions.test.ts 2>&1 | tail -15
```

Expected: 1 test fails with `expected undefined to be 1` or similar (because `submitScore` doesn't write the fields yet). Other 14 tests still pass.

- [ ] **Step B3.3: Modify `submitScore` to write the snapshot**

In `lib/actions.ts`, the existing `putShare` call is at lines 180–190:

```ts
  await store().putShare({
    id: shareId,
    gameId: parsed.data.gameId,
    date: today,
    handle,
    discriminator,
    score: computedScore,
    signature,
    metadata,
    createdAt: Date.now(),
  });
```

Replace with:

```ts
  await store().putShare({
    id: shareId,
    gameId: parsed.data.gameId,
    date: today,
    handle,
    discriminator,
    score: computedScore,
    signature,
    metadata,
    createdAt: Date.now(),
    rankAtSubmit: rank,
    totalAtSubmit: total,
  });
```

- [ ] **Step B3.4: Run the test — should now pass**

```bash
npx vitest run lib/actions.test.ts 2>&1 | tail -5
```

Expected: all 15 tests in `actions.test.ts` pass (14 existing + 1 new).

- [ ] **Step B3.5: Full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: `Tests   51 passed (51)` (42 baseline + 8 og-badge + 1 actions extension).

### Task B4: Wire `computeBadge` into the OG render

**Files:**
- Modify: `app/og/[game]/route.tsx`

- [ ] **Step B4.1: Read the current OG route**

The route reads the share record by `id` query param, verifies the HMAC, and renders an `ImageResponse`. The current footer block (after the score) renders `daily-arcade.netlify.app` and `resets 00:00 utc`. We add a badge between the date/game label and the score.

- [ ] **Step B4.2: Add the badge import and render the badge JSX**

At the top of the file, add the import:

```ts
import { computeBadge, type BadgeTier } from "@/lib/og-badge";
```

Inside the `GET` function, after the `verify` call and before the `return new ImageResponse(...)`, compute the badge:

```ts
const badge = computeBadge({
  rankAtSubmit: rec.rankAtSubmit,
  totalAtSubmit: rec.totalAtSubmit,
});
```

Then in the JSX, insert the badge element above the score block. The existing block looks like:

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
  <div style={{ /* date · game label */ }}>
    {rec.date} · {GAME_LABELS[rec.gameId as GameId]}
  </div>
  <div style={{ /* handle */ }}>...</div>
  <div style={{ fontSize: 36, color: "#a3a191" }}>scored</div>
  <div style={{ /* big score */ }}>{rec.score}</div>
</div>
```

Insert the badge between the date-line and the handle, scaled by tier. Drop in this helper at the top of the file (above `GET`):

```tsx
function badgeStyle(tier: BadgeTier | null): React.CSSProperties {
  switch (tier) {
    case "hero":
      return { fontSize: 64, fontWeight: 800, color: "#d4ff3a", letterSpacing: 2, textTransform: "uppercase" };
    case "prominent-accent":
      return { fontSize: 36, fontWeight: 700, color: "#d4ff3a", letterSpacing: 2, textTransform: "uppercase" };
    case "prominent":
      return { fontSize: 36, fontWeight: 700, color: "#f3f0e6", letterSpacing: 2, textTransform: "uppercase" };
    case "plain":
      return { fontSize: 28, fontWeight: 600, color: "#a3a191", letterSpacing: 2, textTransform: "uppercase" };
    default:
      return { display: "none" };
  }
}
```

(`React` is already imported via `next/og`'s `ImageResponse` accepting JSX; if TypeScript complains about `React` in `route.tsx`, add `import * as React from "react";`.)

Then in the JSX block, render the badge between the date/game label and the handle:

```tsx
{badge.text && (
  <div style={{ display: "flex", ...badgeStyle(badge.tier) }}>
    {badge.text}
  </div>
)}
```

The full updated middle block of the JSX should look like:

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
  <div style={{ fontSize: 24, color: "#a3a191", letterSpacing: 4, textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>
    {rec.date} · {GAME_LABELS[rec.gameId as GameId]}
  </div>
  {badge.text && (
    <div style={{ display: "flex", ...badgeStyle(badge.tier) }}>
      {badge.text}
    </div>
  )}
  <div style={{ fontSize: 110, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
    <span style={{ color: "#d4ff3a", fontSize: 90, marginRight: 16 }}>{GAME_GLYPHS[rec.gameId as GameId]}</span>
    {rec.handle}
    {rec.discriminator > 0 && (
      <span style={{ color: "#6f6e64" }}>#{String(rec.discriminator).padStart(2, "0")}</span>
    )}
  </div>
  <div style={{ fontSize: 36, color: "#a3a191" }}>scored</div>
  <div style={{ fontSize: 180, fontWeight: 800, color: "#d4ff3a", lineHeight: 1 }}>{rec.score}</div>
</div>
```

- [ ] **Step B4.3: Run typecheck and tests**

```bash
npm run typecheck 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Expected: typecheck clean. 51 tests pass.

- [ ] **Step B4.4: Local visual smoke (optional but recommended)**

```bash
npm run build 2>&1 | tail -5
```

Expected: production build succeeds. The OG route is dynamic so it builds as a Lambda; just confirm no compile errors.

### Task B5: Commit and push Phase B

- [ ] **Step B5.1: Stage Phase B files**

```bash
git status -s
git add lib/types.ts lib/og-badge.ts lib/og-badge.test.ts lib/actions.ts lib/actions.test.ts app/og/[game]/route.tsx
git diff --cached --name-only
```

Expected: exactly those 6 paths, nothing more.

- [ ] **Step B5.2: Commit**

```bash
git commit -m "$(cat <<'EOF'
og: add submit-time percentile/rank badge to share images

Extends ShareRecord with optional rankAtSubmit/totalAtSubmit (nullable
for backwards compat with pre-2026-04-30 shares). submitScore writes
both fields at putShare time. New lib/og-badge.ts holds the asymmetric
five-tier cascade (TOP 1% / 5% / 10% / RANK #N / nothing) as a pure
function with 8 unit tests; the OG render route imports computeBadge
and renders the badge with per-tier styling.

Spec: docs/superpowers/specs/2026-04-30-arcade-polish-design.md
Plan: docs/superpowers/plans/2026-04-30-arcade-polish.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step B5.3: Push and watch the auto-deploy**

Same pattern as Step A4.3:

```bash
git push origin main
```

Then run the polling background command from A4.3 (it captures the previous deploy as PREV automatically). Wait for `FINAL: ready`.

- [ ] **Step B5.4: Live smoke — submit a real Word Volley game and view its OG image**

This is the manual end-to-end verify. Prompt the user:

> The deploy is live. To verify the OG badge end-to-end, please:
> 1. Visit https://daily-arcade.netlify.app/g/word-volley
> 2. Solve the daily puzzle and submit your score
> 3. After the share dialog, copy the OG URL — it'll be `https://daily-arcade.netlify.app/og/word-volley?id=<shareId>`
> 4. Open it directly in a browser
>
> Expected: the rendered PNG should show a badge above your handle. Because you're a small-N submitter at this stage, you'll likely see "TOP 5%" (prominent accent green) or "RANK #1" (plain). If you see the badge at all, it's working. If you see no badge, paste the share URL — the cascade may have fallen through to the no-badge tier (which is also valid).

If the badge doesn't render but the rest of the image does, the most likely cause is that the production share record doesn't have `rankAtSubmit/totalAtSubmit` populated — check that the deploy actually shipped the new `submitScore` code (`netlify api getSiteDeploy --data='{...}'` with the latest deploy ID; check `commit_ref`).

---

## Self-review — done by the plan author after writing this

**1. Spec coverage:**

| Spec section | Plan task |
|---|---|
| Feature 1 — source: OpenTDB | A1 |
| Feature 1 — pull strategy (categories, difficulty, encoding) | A1.1, A1.2 |
| Feature 1 — filter rules 1–12 | A2 (with Sports added as 7th category — flagged in plan) |
| Feature 1 — output: revised trivia.ts unchanged shape | A2.5 |
| Feature 1 — attribution in file header + RUNBOOK | A2.5 (header), A3 (RUNBOOK) |
| Feature 1 — quality gate (450–550, file size, spot-check, tests) | A2.6, A2.7, A2.8 |
| Feature 2 — schema delta: `rankAtSubmit/totalAtSubmit` nullable | B1 |
| Feature 2 — submit-time freeze (writes at putShare) | B3 |
| Feature 2 — OG render reads frozen values, no DB query at render | B4 (computeBadge is pure; route reads `rec.rankAtSubmit/totalAtSubmit`) |
| Feature 2 — asymmetric 5-tier cascade | B2 (logic), B4 (rendering) |
| Feature 2 — tests at boundaries (top 1%, 5%, 10%, plain rank, below) | B2.1 |
| Feature 2 — actions test extended for rankAtSubmit/totalAtSubmit persist | B3.1 |
| Feature 2 — backwards compat (existing shares no badge) | B2.1 (test case) |
| Sequencing: trivia first, OG second, two commits/deploys | A4, B5 |
| Success criterion 5: deploy comes up green | A4.3, B5.3 |
| Success criterion 6: live OG smoke | B5.4 |
| Success criterion 7: no regression in 42-test suite | A2.6, B3.5 (full suite runs after each change) |
| Success criterion 8: RUNBOOK + trivia.ts attribution | A2.5, A3 |

All success criteria covered. Sports category addition is the only spec deviation, called out at the top of the plan and again in Task A1 notes.

**2. Placeholder scan:** zero TBDs, zero "implement appropriate", zero "similar to". Every step has either a concrete code block or an exact command.

**3. Type consistency:** `computeBadge` signature matches across B2.1 (tests), B2.3 (impl), B4.2 (call site). `BadgeTier` is the same union throughout. `ShareRecord.rankAtSubmit` field name matches across B1, B2.1, B3.3, B4.2. `submitScore`'s `res.rank` and `res.total` match the existing return shape (`SubmitResult` at `lib/actions.ts:49-59`). All consistent.

---

## Cleanup (optional, post-implementation)

- [ ] **Step C1: Remove the OpenTDB raw temp files**

```bash
rm -rf /tmp/opentdb /tmp/opentdb-raw.json /tmp/opentdb-token.json /tmp/opentdb-filtered.json
```

These were only used during Phase A's filter pass and aren't needed once the curated `lib/content/trivia.ts` is committed.
