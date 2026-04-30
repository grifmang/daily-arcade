"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ShareResult } from "@/components/share-result";
import { HandleDialog, type HandleDialogHandle } from "@/components/handle-dialog";
import { useHandle } from "@/lib/hooks/use-handle";
import { useStreak, markCompleted } from "@/lib/hooks/use-streak";
import { useToast } from "@/components/ui/toast";
import { submitScore } from "@/lib/actions";
import { GAME_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { PublicTriviaQuestion } from "@/lib/content/trivia";
import { SECONDS_PER_QUESTION } from "@/lib/games/snap-trivia";

interface Props {
  questions: PublicTriviaQuestion[];
  date: string;
  initialHandle?: string;
  turnstileSiteKey: string;
}

interface AnswerEntry {
  questionId: number;
  choice: number;
  msTaken: number;
}

export function SnapTrivia({ questions, date, initialHandle, turnstileSiteKey }: Props) {
  const { handle, setHandle } = useHandle();
  const { recordPlay } = useStreak();
  const { push } = useToast();
  const handleDialogRef = React.useRef<HandleDialogHandle | null>(null);

  const [started, setStarted] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<AnswerEntry[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  const [questionStart, setQuestionStart] = React.useState<number>(() => Date.now());
  const [now, setNow] = React.useState<number>(() => Date.now());
  const [submitted, setSubmitted] = React.useState<{
    shareUrl: string | null;
    rank: number;
    total: number;
    handle: string;
    discriminator: number;
    score: number;
    perQuestion: Array<{ correct: boolean; msTaken: number; bonus: number }>;
  } | null>(null);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [submitBusy, setSubmitBusy] = React.useState(false);

  const STORE = `da:st:${date}`;
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw) as { answers: AnswerEntry[]; idx: number; started: boolean; showResults: boolean };
        setAnswers(parsed.answers ?? []);
        setIdx(parsed.idx ?? 0);
        setStarted(parsed.started ?? false);
        setShowResults(parsed.showResults ?? false);
      }
    } catch { /* */ }
  }, [STORE]);

  React.useEffect(() => {
    try { window.localStorage.setItem(STORE, JSON.stringify({ answers, idx, started, showResults })); } catch {}
  }, [STORE, answers, idx, started, showResults]);

  // Tick for timer
  React.useEffect(() => {
    if (!started || showResults) return;
    setQuestionStart(Date.now());
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [started, idx, showResults]);

  React.useEffect(() => {
    if (!started || showResults) return;
    const elapsed = now - questionStart;
    if (elapsed >= SECONDS_PER_QUESTION * 1000) {
      // Time out the question with no choice
      const cur = questions[idx];
      if (!cur) return;
      finishQuestion(-1, SECONDS_PER_QUESTION * 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  function finishQuestion(choice: number, override?: number) {
    const cur = questions[idx];
    if (!cur) return;
    const taken = override ?? Math.min(SECONDS_PER_QUESTION * 1000, Date.now() - questionStart);
    const next: AnswerEntry = { questionId: cur.id, choice: choice < 0 ? 99 : choice, msTaken: taken };
    setAnswers(a => {
      const list = [...a, next];
      return list;
    });
    if (idx + 1 >= questions.length) {
      setShowResults(true);
      markCompleted("snap-trivia");
      recordPlay();
      setTimeout(() => setSubmitOpen(true), 500);
    } else {
      setIdx(i => i + 1);
    }
  }

  function onChoice(c: number) {
    if (showResults) return;
    finishQuestion(c);
  }

  async function doSubmit(claimedHandle: string, turnstileToken: string) {
    setSubmitBusy(true);
    try {
      const safeAnswers = answers.map(a => ({
        questionId: a.questionId,
        choice: a.choice >= 0 && a.choice <= 3 ? a.choice : 0, // server will reject correctness, but choice must be 0..3
        msTaken: a.msTaken,
      }));
      // Pad if user reloaded mid-game and had < 5 answers (defensive)
      while (safeAnswers.length < 5 && safeAnswers.length < questions.length) {
        const q = questions[safeAnswers.length];
        if (!q) break;
        safeAnswers.push({ questionId: q.id, choice: 0, msTaken: SECONDS_PER_QUESTION * 1000 });
      }
      const res = await submitScore({
        gameId: "snap-trivia",
        date,
        handle: claimedHandle,
        metadata: { answers: safeAnswers },
        turnstileToken,
      });
      if (!res.ok) {
        push(res.error ?? "Submit failed", "error");
        handleDialogRef.current?.resetTurnstile();
        setSubmitBusy(false);
        return;
      }
      setHandle(claimedHandle);
      // Server didn't return per-question detail for the share grid; we reconstruct
      // a best-effort grid from local timing only. Correctness is server-authoritative.
      void res;
      // Build per-question display from local answers (correctness not validated client-side; server is authoritative)
      // We don't have correct indices client-side; show our best-effort grid based on whether server score implies correctness.
      setSubmitted({
        shareUrl: res.shareUrl ?? null,
        rank: res.rank ?? 0,
        total: res.total ?? 0,
        handle: claimedHandle,
        discriminator: res.discriminator ?? 0,
        score: res.score ?? 0,
        perQuestion: answers.map(a => ({ correct: false, msTaken: a.msTaken, bonus: 0 })), // placeholder; share grid below uses just speed pattern
      });
      setSubmitOpen(false);
    } finally {
      setSubmitBusy(false);
    }
  }

  if (!started && answers.length === 0) {
    return (
      <section className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">{date}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{GAME_LABELS["snap-trivia"]}</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">5 questions. 10 seconds each. Faster correct = more points.</p>
        </header>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] p-6 space-y-4">
          <p className="text-base">Ready when you are.</p>
          <Button onClick={() => { setStarted(true); setQuestionStart(Date.now()); setNow(Date.now()); }}>Start</Button>
        </div>
      </section>
    );
  }

  if (showResults && submitted) {
    // Build a rough share grid from local timings (cannot reveal correctness without server round-trip; we use the score-implied pattern)
    const grid = answers.map(a => {
      const fast = a.msTaken < 3000 ? "⚡" : "·";
      // We'll show a green block if the user picked something within time, red if timeout
      const sign = a.choice >= 0 && a.choice <= 3 ? "▣" : "✕";
      return `${fast}${sign}`;
    }).join(" ");
    return (
      <section className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">{date}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{GAME_LABELS["snap-trivia"]}</h1>
        </header>
        <ShareResult
          gameId="snap-trivia"
          date={date}
          shareGrid={`${grid}\n— score ${submitted.score}`}
          score={submitted.score}
          shareUrl={submitted.shareUrl}
          rank={submitted.rank}
          total={submitted.total}
          handle={submitted.handle}
          discriminator={submitted.discriminator}
        />
      </section>
    );
  }

  if (showResults && !submitted) {
    return (
      <section className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">{date}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{GAME_LABELS["snap-trivia"]}</h1>
        </header>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] p-6 space-y-3">
          <p className="font-display text-2xl">All five questions answered.</p>
          <p className="text-sm text-[var(--color-fg-muted)]">Submit to lock in your daily score.</p>
          <Button onClick={() => setSubmitOpen(true)}>Submit & share</Button>
        </div>
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

  const cur = questions[idx];
  const elapsed = Math.min(SECONDS_PER_QUESTION * 1000, now - questionStart);
  const remaining = Math.max(0, SECONDS_PER_QUESTION * 1000 - elapsed);
  const progress = (remaining / (SECONDS_PER_QUESTION * 1000)) * 100;

  if (!cur) return null;

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">{date}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{GAME_LABELS["snap-trivia"]}</h1>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">question</div>
          <div className="font-display text-2xl tabular-nums">{idx + 1}/{questions.length}</div>
        </div>
      </header>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] overflow-hidden">
        <div className="h-1.5 bg-[var(--color-bg)]">
          <div
            className="h-full bg-[var(--color-accent)] transition-[width] duration-100 linear"
            style={{ width: `${progress}%` }}
            aria-label={`${Math.ceil(remaining / 1000)} seconds left`}
            role="progressbar"
            aria-valuenow={Math.ceil(remaining / 1000)}
            aria-valuemin={0}
            aria-valuemax={SECONDS_PER_QUESTION}
          />
        </div>
        <div className="p-5 sm:p-7 space-y-5">
          <p className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">{cur.category}</p>
          <p className="font-display text-2xl sm:text-3xl font-semibold leading-snug">{cur.prompt}</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {cur.choices.map((c, i) => (
              <button
                key={i}
                onClick={() => onChoice(i)}
                className={cn(
                  "text-left p-4 rounded-[var(--radius-md)] border border-[var(--color-line-strong)]",
                  "bg-[var(--color-bg)] hover:bg-[var(--color-bg-overlay)] hover:border-[var(--color-accent)]",
                  "transition-colors duration-[var(--motion-fast)]",
                  "font-mono",
                )}
              >
                <span className="text-[var(--color-fg-dim)] mr-2">{String.fromCharCode(65 + i)}</span>
                <span className="text-[var(--color-fg)]">{c}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
