"use client";
import * as React from "react";
import { initialState, step, peakTile, shareGrid, type Move, type PlayState } from "@/lib/games/drift-2049";
import { Button } from "@/components/ui/button";
import { ShareResult } from "@/components/share-result";
import { HandleDialog, type HandleDialogHandle } from "@/components/handle-dialog";
import { useHandle } from "@/lib/hooks/use-handle";
import { useStreak, markCompleted } from "@/lib/hooks/use-streak";
import { useToast } from "@/components/ui/toast";
import { submitScore } from "@/lib/actions";
import { GAME_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  initialBoard: number[][];
  date: string;
  initialHandle?: string;
  turnstileSiteKey: string;
}

const KEY_TO_MOVE: Record<string, Move> = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down",
  A: "left", D: "right", W: "up", S: "down",
  h: "left", l: "right", k: "up", j: "down",
};

export function Drift2049({ initialBoard, date, initialHandle, turnstileSiteKey }: Props) {
  const { handle, setHandle } = useHandle();
  const { recordPlay } = useStreak();
  const { push } = useToast();

  const [state, setState] = React.useState<PlayState>(() => initialState(initialBoard));
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

  // Persist game state per day
  const STORE = `da:d2049:${date}`;
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw) as PlayState;
        setState(parsed);
      } else {
        setState(initialState(initialBoard));
      }
    } catch { /* */ }
  }, [STORE, initialBoard]);
  React.useEffect(() => {
    try { window.localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
    if (state.over) {
      markCompleted("drift-2049");
      recordPlay();
    }
  }, [STORE, state, recordPlay]);

  const move = React.useCallback((m: Move) => {
    setState(prev => step(prev, m));
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (submitOpen) return;
      const m = KEY_TO_MOVE[e.key];
      if (!m) return;
      e.preventDefault();
      move(m);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, submitOpen]);

  // Touch swipe support
  const touchRef = React.useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    if (!t || !touchRef.current) return;
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < 24) return;
    if (adx > ady) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
    touchRef.current = null;
  }

  const peak = peakTile(state.board);
  const isOver = state.over;

  function newGameClick() {
    if (window.confirm("Restart will lose your daily progress. Continue?")) {
      setState(initialState(initialBoard));
    }
  }

  async function doSubmit(claimedHandle: string, turnstileToken: string) {
    if (!isOver) return;
    setSubmitBusy(true);
    try {
      const res = await submitScore({
        gameId: "drift-2049",
        date,
        handle: claimedHandle,
        metadata: { moves: state.moves },
        turnstileToken,
      });
      if (!res.ok) {
        push(res.error ?? "Submit failed", "error");
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
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">{date}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{GAME_LABELS["drift-2049"]}</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">Slide the tiles. Merge equal tiles. One daily board.</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">score</div>
          <div className="font-display text-3xl tabular-nums font-bold text-[var(--color-accent)]">{state.score}</div>
          <div className="text-xs font-mono text-[var(--color-fg-muted)] mt-1">peak {peak}</div>
        </div>
      </header>

      <div
        role="grid"
        aria-label="Drift 2049 board"
        className="mx-auto rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] p-2 select-none touch-none"
        style={{ width: "min(420px, 100%)" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid grid-cols-4 gap-2">
          {state.board.flatMap((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r}-${c}`}
                role="gridcell"
                className={cn(
                  "aspect-square grid place-items-center font-display font-bold rounded-[var(--radius-sm)]",
                  "text-xl sm:text-2xl tabular-nums",
                  v === 0 && "bg-[var(--color-bg)] text-transparent",
                  v > 0 && `t-${Math.min(2048, v)}`,
                )}
                aria-label={v ? `Tile ${v}` : "Empty"}
              >
                {v || "·"}
              </div>
            )),
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 max-w-[260px] mx-auto sm:hidden" aria-label="On-screen controls">
        <div />
        <Button variant="secondary" size="sm" onClick={() => move("up")} aria-label="Up">↑</Button>
        <div />
        <Button variant="secondary" size="sm" onClick={() => move("left")} aria-label="Left">←</Button>
        <Button variant="secondary" size="sm" onClick={() => move("down")} aria-label="Down">↓</Button>
        <Button variant="secondary" size="sm" onClick={() => move("right")} aria-label="Right">→</Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-center text-xs font-mono text-[var(--color-fg-muted)]">
        <span>moves: {state.moves.length}</span>
        <span aria-hidden>·</span>
        <span className="hidden sm:inline">arrow keys / WASD / swipe</span>
      </div>

      {!isOver && state.moves.length > 0 && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setSubmitOpen(true)}>Stop & submit current score</Button>
        </div>
      )}

      {isOver && submitted && (
        <ShareResult
          gameId="drift-2049"
          date={date}
          shareGrid={`${shareGrid(state)}\n— peak ${peak} · score ${submitted.score}`}
          score={submitted.score}
          shareUrl={submitted.shareUrl}
          rank={submitted.rank}
          total={submitted.total}
          handle={submitted.handle}
          discriminator={submitted.discriminator}
        />
      )}

      {isOver && !submitted && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] p-5 sm:p-6 space-y-3">
          <p className="font-display text-2xl">{state.won ? "You hit 2048!" : "No moves left."}</p>
          <p className="text-sm text-[var(--color-fg-muted)]">Score {state.score}. Peak {peak}.</p>
          <pre className="font-mono whitespace-pre-wrap text-lg">{shareGrid(state)}</pre>
          <div className="flex gap-2">
            <Button onClick={() => setSubmitOpen(true)}>Submit & share</Button>
            <Button variant="ghost" onClick={newGameClick}>Restart (lose progress)</Button>
          </div>
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
