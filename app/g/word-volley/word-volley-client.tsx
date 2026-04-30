"use client";
import * as React from "react";
import { gradeGuess, scoreFromGuesses, shareGrid, type Tile } from "@/lib/games/word-volley";
import { VALID_GUESS_SET } from "@/lib/content/word-targets";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ShareResult } from "@/components/share-result";
import { HandleDialog, type HandleDialogHandle } from "@/components/handle-dialog";
import { useHandle } from "@/lib/hooks/use-handle";
import { useStreak, markCompleted } from "@/lib/hooks/use-streak";
import { submitScore } from "@/lib/actions";
import { GAME_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROWS = 6;
const COLS = 5;

type RowState = { letters: string[]; grades: Tile[] | null };

const KEYBOARD_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","BACK"],
] as const;

interface Props {
  target: string;
  date: string;
  initialHandle?: string;
  turnstileSiteKey: string;
}

export function WordVolley({ target, date, initialHandle, turnstileSiteKey }: Props) {
  const { push } = useToast();
  const { handle, setHandle } = useHandle();
  const { recordPlay } = useStreak();

  const [rows, setRows] = React.useState<RowState[]>(() =>
    Array.from({ length: ROWS }, () => ({ letters: [], grades: null })),
  );
  const [active, setActive] = React.useState(0);
  const [done, setDone] = React.useState<"won" | "lost" | null>(null);

  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [submitBusy, setSubmitBusy] = React.useState(false);
  const handleDialogRef = React.useRef<HandleDialogHandle | null>(null);
  const [submitted, setSubmitted] = React.useState<{
    shareUrl: string | null;
    rank: number;
    total: number;
    handle: string;
    discriminator: number;
    score: number;
  } | null>(null);

  // Persist guess state per-day so reload doesn't restart
  const STORE = `da:wv:${date}`;
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw) as { rows: RowState[]; done: "won" | "lost" | null };
        setRows(parsed.rows);
        setActive(parsed.rows.findIndex(r => r.grades === null));
        setDone(parsed.done);
      }
    } catch { /* ignore */ }
  }, [STORE]);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify({ rows, done }));
    } catch { /* */ }
  }, [STORE, rows, done]);

  function pushKey(k: string) {
    if (done) return;
    setRows(prev => {
      const next = prev.map(r => ({ ...r, letters: [...r.letters] }));
      const cur = next[active];
      if (!cur) return prev;
      if (k === "BACK") {
        cur.letters.pop();
        return next;
      }
      if (k === "ENTER") {
        if (cur.letters.length !== COLS) {
          push(`Word must be ${COLS} letters`, "error");
          return prev;
        }
        const guess = cur.letters.join("");
        if (!VALID_GUESS_SET.has(guess)) {
          push("Not in word list", "error");
          return prev;
        }
        const grades = gradeGuess(guess, target);
        cur.grades = grades;
        const isWin = grades.every(t => t === "green");
        if (isWin) {
          setDone("won");
          markCompleted("word-volley");
          recordPlay();
          // Auto-open submit dialog after a short beat
          setTimeout(() => setSubmitOpen(true), 600);
        } else if (active === ROWS - 1) {
          setDone("lost");
          markCompleted("word-volley"); // counts as "played"
          recordPlay();
        } else {
          setActive(a => a + 1);
        }
        return next;
      }
      // Letter
      if (/^[A-Z]$/.test(k) && cur.letters.length < COLS) {
        cur.letters.push(k);
      }
      return next;
    });
  }

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (submitOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") { e.preventDefault(); pushKey("ENTER"); return; }
      if (e.key === "Backspace") { e.preventDefault(); pushKey("BACK"); return; }
      const k = e.key.toUpperCase();
      if (/^[A-Z]$/.test(k)) { pushKey(k); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, done, submitOpen]);

  const grades = rows.map(r => r.grades).filter((g): g is Tile[] => !!g);
  const score = scoreFromGuesses(grades);

  // Compose accumulated keyboard letter states
  const keyState: Record<string, Tile> = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.grades) continue;
    for (let j = 0; j < COLS; j++) {
      const ch = row.letters[j]!;
      const t = row.grades[j]!;
      const cur: Tile | undefined = keyState[ch];
      if (cur === "green") continue;
      if (t === "green") {
        keyState[ch] = "green";
      } else if (t === "yellow") {
        // cur cannot be 'green' due to guard above
        if (cur !== "yellow") keyState[ch] = "yellow";
      } else if (!cur) {
        keyState[ch] = "grey";
      }
    }
  }

  async function doSubmit(claimedHandle: string, turnstileToken: string) {
    if (!done) return;
    setSubmitBusy(true);
    try {
      const guesses = rows.filter(r => r.grades !== null).map(r => r.letters.join(""));
      const res = await submitScore({
        gameId: "word-volley",
        date,
        handle: claimedHandle,
        metadata: { guesses },
        turnstileToken,
      });
      if (!res.ok) {
        push(res.error ?? "Submit failed", "error");
        // Reset Turnstile so the user can retry with a fresh token.
        handleDialogRef.current?.resetTurnstile();
        setSubmitBusy(false);
        return;
      }
      setHandle(claimedHandle);
      setSubmitted({
        shareUrl: res.shareUrl ?? null,
        rank: res.rank ?? 0,
        total: res.total ?? 0,
        handle: claimedHandle,
        discriminator: res.discriminator ?? 0,
        score: res.score ?? 0,
      });
      setSubmitOpen(false);
    } catch {
      push("Submit failed.", "error");
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">{date}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{GAME_LABELS["word-volley"]}</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">Guess the 5-letter word in six tries.</p>
        </div>
      </header>

      <div className="grid gap-2 mx-auto" style={{ width: "min(380px, 100%)" }}>
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-5 gap-2">
            {Array.from({ length: COLS }).map((_, ci) => {
              const ch = row.letters[ci] ?? "";
              const t = row.grades?.[ci];
              const isPending = !row.grades && ri === active && ch !== "";
              return (
                <div
                  key={ci}
                  className={cn(
                    "aspect-square grid place-items-center font-display text-2xl sm:text-3xl font-bold uppercase",
                    "border-2 rounded-[var(--radius-sm)]",
                    !row.grades && !isPending && "tile-empty",
                    isPending && "tile-pending",
                    t === "green" && "tile-green tile-revealed",
                    t === "yellow" && "tile-yellow tile-revealed",
                    t === "grey" && "tile-grey tile-revealed",
                  )}
                  style={t ? { animationDelay: `${ci * 80}ms` } : undefined}
                  aria-label={ch || "empty"}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {!done && (
        <div className="space-y-1.5 select-none" aria-label="On-screen keyboard" role="group">
          {KEYBOARD_ROWS.map((row, i) => (
            <div key={i} className="flex justify-center gap-1.5">
              {row.map(k => {
                const wide = k === "ENTER" || k === "BACK";
                const t = keyState[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pushKey(k)}
                    className={cn(
                      "h-12 sm:h-14 rounded-[var(--radius-sm)] font-display font-medium uppercase tracking-tight",
                      "bg-[var(--color-bg-elevated)] text-[var(--color-fg)]",
                      "active:scale-[0.97] transition-transform",
                      wide ? "px-3 text-xs" : "w-8 sm:w-10 text-sm sm:text-base",
                      t === "green" && "tile-green",
                      t === "yellow" && "tile-yellow",
                      t === "grey" && "tile-grey",
                    )}
                    aria-label={k === "BACK" ? "Backspace" : k === "ENTER" ? "Enter" : k}
                  >
                    {k === "BACK" ? "⌫" : k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {done && submitted && (
        <ShareResult
          gameId="word-volley"
          date={date}
          shareGrid={`${shareGrid(grades)}\n— ${score.won ? `${score.guessesUsed}/6` : "X/6"}`}
          score={submitted.score}
          shareUrl={submitted.shareUrl}
          rank={submitted.rank}
          total={submitted.total}
          handle={submitted.handle}
          discriminator={submitted.discriminator}
        />
      )}

      {done && !submitted && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] p-5 sm:p-6 space-y-4">
          {done === "won" ? (
            <>
              <p className="font-display text-2xl">Solved in <span className="text-[var(--color-accent)]">{score.guessesUsed}/6</span>.</p>
              <p className="text-sm text-[var(--color-fg-muted)]">Submit to today's leaderboard.</p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl">Out of guesses.</p>
              <p className="text-sm text-[var(--color-fg-muted)]">The word was <strong>{target}</strong>. Try again tomorrow.</p>
            </>
          )}
          <pre className="font-mono whitespace-pre-wrap text-base">{shareGrid(grades)}</pre>
          {done === "won" && (
            <div className="flex gap-2">
              <Button onClick={() => setSubmitOpen(true)}>Submit & share</Button>
            </div>
          )}
        </div>
      )}

      <HandleDialog
        ref={handleDialogRef}
        open={submitOpen}
        initial={initialHandle ?? handle ?? ""}
        turnstileSiteKey={turnstileSiteKey}
        onSubmit={doSubmit}
        onCancel={() => setSubmitOpen(false)}
        busy={submitBusy}
      />
    </section>
  );
}
