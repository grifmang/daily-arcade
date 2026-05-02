"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ReelGrid } from "@/components/slots/reel-grid";
import { CollectionMeter } from "@/components/slots/collection-meter";
import { PaytableModal } from "@/components/slots/paytable-modal";
import { cn } from "@/lib/utils";
import {
  BET,
  DEFAULT_CREDITS,
  EMPTY_STATS,
  Sym,
  createCryptoRng,
  loadCredits,
  loadStats,
  playSpin,
  recordSpinStat,
  resetCredits as resetCreditsStorage,
  saveCredits,
  saveStats,
  type Grid,
  type PlayResult,
  type SlotStats,
  type SymbolId,
} from "@/lib/slots/tideforge-pearls";

type Phase = "idle" | "spinning" | "result" | "bonus";

interface BonusFrame {
  /** Which bonus spin this frame represents (0-indexed, 0 = base reveal beat). */
  index: number;
  /** Cumulative meter at start of this frame. */
  meterAtStart: number;
  /** PEARLs landed on this spin (added after the frame). */
  pearlsThisSpin: number;
  /** Conversion map active during this frame's evaluator pass. */
  conversionMap: Partial<Record<SymbolId, SymbolId>> | null;
  /** Win on this spin in credits. */
  spinWin: number;
  /** Number of scatters this spin (for retrigger flash). */
  scatCount: number;
}

const FRAME_MS_DEFAULT = 700; // bonus spin reveal cadence in ms (full motion)
const SPIN_REVEAL_MS_DEFAULT = 380; // base spin "reveal" pause before showing the win

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TideforgePearls() {
  const { push } = useToast();
  const [credits, setCredits] = React.useState<number>(DEFAULT_CREDITS);
  const [stats, setStats] = React.useState<SlotStats>(EMPTY_STATS);

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [grid, setGrid] = React.useState<Grid | null>(null);
  const [lastWin, setLastWin] = React.useState<number>(0);
  const [lastResult, setLastResult] = React.useState<PlayResult | null>(null);

  // Bonus animation state
  const [bonusFrameIdx, setBonusFrameIdx] = React.useState<number>(-1);
  const [bonusGrid, setBonusGrid] = React.useState<Grid | null>(null);
  const [bonusMeter, setBonusMeter] = React.useState<number>(0);
  const [bonusRunningTotal, setBonusRunningTotal] = React.useState<number>(0);
  const [bonusFrame, setBonusFrame] = React.useState<BonusFrame | null>(null);

  // UI helpers
  const [resetOpen, setResetOpen] = React.useState(false);
  const [paytableOpen, setPaytableOpen] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);

  // Hydrate from localStorage on mount
  React.useEffect(() => {
    setCredits(loadCredits());
    setStats(loadStats());
    setReduced(prefersReducedMotion());
  }, []);

  // Persist credits / stats whenever they change
  React.useEffect(() => { saveCredits(credits); }, [credits]);
  React.useEffect(() => { saveStats(stats); }, [stats]);

  const canAfford = credits >= BET;
  const isAnimating = phase === "spinning" || phase === "bonus";

  /* --------------------------------------------------------------------- */
  /* Spin                                                                  */
  /* --------------------------------------------------------------------- */
  const startSpin = React.useCallback(() => {
    if (isAnimating) return;
    if (!canAfford) {
      push("Out of credits — reset to keep playing.", "error");
      return;
    }

    // Charge the bet up-front; win lands at the end of the reveal.
    const rng = createCryptoRng();
    const result = playSpin(rng);

    setLastResult(result);
    setLastWin(0);
    setGrid(result.baseGrid);
    setPhase("spinning");

    const revealMs = reduced ? 0 : SPIN_REVEAL_MS_DEFAULT;
    window.setTimeout(() => {
      // Apply the bet and base win
      setCredits((c) => Math.max(0, c - BET + result.baseWin));

      if (result.bonusTriggered) {
        // Enter bonus animation
        setBonusFrameIdx(-1);
        setBonusMeter(0);
        setBonusRunningTotal(0);
        setBonusGrid(null);
        setBonusFrame(null);
        setPhase("bonus");
      } else {
        setLastWin(result.baseWin);
        // Update stats now (no bonus to wait for).
        setStats((s) => recordSpinStat(s, { wager: BET, win: result.baseWin, bonusTriggered: false }));
        setPhase("result");
      }
    }, revealMs);
  }, [canAfford, isAnimating, push, reduced]);

  /* --------------------------------------------------------------------- */
  /* Bonus animation driver                                                */
  /* --------------------------------------------------------------------- */
  React.useEffect(() => {
    if (phase !== "bonus" || !lastResult || !lastResult.bonusTriggered) return;
    if (bonusFrameIdx >= lastResult.bonusTrace.length - 1) {
      // Animation complete — apply bonus winnings, finalize.
      const result = lastResult;
      setCredits((c) => c + result.bonusWin);
      setLastWin(result.baseWin + result.bonusWin);
      setStats((s) =>
        recordSpinStat(s, { wager: BET, win: result.totalWin, bonusTriggered: true }),
      );
      setPhase("result");
      return;
    }

    const frameMs = reduced ? 0 : FRAME_MS_DEFAULT;
    const t = window.setTimeout(() => {
      const nextIdx = bonusFrameIdx + 1;
      const trace = lastResult.bonusTrace[nextIdx];
      if (!trace) return;

      // We need the actual sampled grid for visual display, but the trace doesn't
      // store grids (math module deliberately keeps trace lightweight). We can
      // still show conversion + meter + spin win; the grid stays as the base
      // grid frozen in place during animation. This is acceptable — the bonus
      // beat is about meter + win count-up, not per-frame grid swap.
      //
      // For a richer animation we could re-run runBonus with grids captured;
      // deferring that to a Polish pass. For MVP, render the conversion map
      // applied to the base grid on each frame so the visual "pearls take over"
      // beat is preserved.
      setBonusGrid(lastResult.baseGrid);
      setBonusFrame({
        index: nextIdx,
        meterAtStart: trace.meterAtStart,
        pearlsThisSpin: trace.pearlsThisSpin,
        conversionMap: trace.conversionMap,
        spinWin: trace.spinWin,
        scatCount: trace.scatCount,
      });
      setBonusMeter(trace.meterAtStart + trace.pearlsThisSpin);
      setBonusRunningTotal((r) => r + trace.spinWin);
      setBonusFrameIdx(nextIdx);
    }, frameMs);
    return () => window.clearTimeout(t);
  }, [phase, lastResult, bonusFrameIdx, reduced]);

  /* --------------------------------------------------------------------- */
  /* Reset                                                                 */
  /* --------------------------------------------------------------------- */
  const performReset = React.useCallback(() => {
    const r = resetCreditsStorage();
    setCredits(r.credits);
    setStats(r.stats);
    setLastWin(0);
    setLastResult(null);
    setGrid(null);
    setBonusGrid(null);
    setBonusFrame(null);
    setBonusFrameIdx(-1);
    setBonusMeter(0);
    setBonusRunningTotal(0);
    setPhase("idle");
    setResetOpen(false);
    push("Balance reset to 1000.", "success");
  }, [push]);

  /* --------------------------------------------------------------------- */
  /* Derived display state                                                 */
  /* --------------------------------------------------------------------- */
  const displayedGrid: Grid | null = phase === "bonus" && bonusGrid ? bonusGrid : grid;
  const conversionMap =
    phase === "bonus" && bonusFrame ? bonusFrame.conversionMap : null;
  const meter = phase === "bonus" ? bonusMeter : lastResult?.bonusFinalMeter ?? 0;
  const showMeter = phase === "bonus" || (phase === "result" && lastResult?.bonusTriggered);

  // Compute "winning cells" set on the result phase grid for the win flash.
  // We do this lazily on the final state — during base "spinning" reveal we
  // skip the flash to keep the reveal beat clean.
  const winningCells = React.useMemo(() => {
    if (phase !== "result" || !lastResult || lastResult.totalWin === 0) return undefined;
    return computeWinningCells(lastResult.baseGrid);
  }, [phase, lastResult]);

  /* --------------------------------------------------------------------- */
  /* Render                                                                */
  /* --------------------------------------------------------------------- */
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">
          arcade lounge · slot
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
          Tideforge <span className="text-[#a86bff]">Pearls</span>
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)] max-w-md">
          Storm-forged pearls collect in the trench. 1,024 ways, free-spin bonus, ×2/×3 multiplier wilds.
          Play money — no real currency, no leaderboard.
        </p>
      </header>

      {/* Credits + bet readout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <Stat label="balance" value={credits.toLocaleString()} accent />
        <Stat label="bet / spin" value={String(BET)} />
        <Stat
          label={phase === "bonus" ? "bonus running" : "last win"}
          value={
            phase === "bonus"
              ? bonusRunningTotal.toLocaleString()
              : lastWin > 0
                ? `+${lastWin.toLocaleString()}`
                : "—"
          }
          highlight={phase === "result" && lastWin > 0}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Reel grid */}
      {displayedGrid ? (
        <ReelGrid
          grid={displayedGrid}
          conversionMap={conversionMap ?? null}
          winningCells={winningCells}
        />
      ) : (
        <EmptyGridPlaceholder />
      )}

      {/* Collection meter (visible during/after bonus) */}
      {showMeter && <CollectionMeter meter={meter} />}

      {/* Bonus running info */}
      {phase === "bonus" && bonusFrame && lastResult && (
        <BonusBanner
          frame={bonusFrame}
          totalSpins={lastResult.bonusSpinCount}
          runningTotal={bonusRunningTotal}
        />
      )}

      {/* Spin / reset row */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          size="lg"
          onClick={startSpin}
          disabled={isAnimating || !canAfford}
          aria-label={canAfford ? "Spin" : "Out of credits"}
          aria-busy={isAnimating}
          className={cn("flex-1", isAnimating && "tide-spin-glow")}
        >
          {phase === "spinning" ? "Spinning…" : phase === "bonus" ? "Bonus running…" : canAfford ? "Spin" : "Out of credits"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setPaytableOpen(true)}
          aria-label="Open paytable"
        >
          Paytable
        </Button>
      </div>

      {/* Stats summary */}
      <details className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg-elevated)_70%,transparent)] p-4">
        <summary className="cursor-pointer text-sm font-display font-medium select-none">
          Session stats
        </summary>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-3 text-sm font-mono tabular-nums">
          <Field label="spins played" value={stats.spinsPlayed.toLocaleString()} />
          <Field label="bonuses" value={stats.bonusesTriggered.toLocaleString()} />
          <Field label="best single win" value={stats.bestSingleWin.toLocaleString()} />
          <Field label="total wagered" value={stats.totalWagered.toLocaleString()} />
          <Field label="total won" value={stats.totalWon.toLocaleString()} />
          <Field
            label="net"
            value={(stats.totalWon - stats.totalWagered).toLocaleString()}
          />
        </dl>
        <div className="mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setResetOpen(true)}
            disabled={isAnimating}
          >
            Reset balance
          </Button>
        </div>
      </details>

      {/* Live region for screen-reader announcements (spin results) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {phase === "result" && lastResult
          ? lastResult.totalWin > 0
            ? `Win: ${lastResult.totalWin} credits.${lastResult.bonusTriggered ? " Bonus triggered." : ""}`
            : "No win this spin."
          : ""}
      </div>

      <p className="text-xs text-[var(--color-fg-dim)] font-mono">
        ← <Link href="/slots" className="hover:text-[var(--color-fg)]">arcade lounge</Link>{" · "}
        <Link href="/" className="hover:text-[var(--color-fg)]">today&apos;s puzzles</Link>
      </p>

      {/* Reset confirmation */}
      <Dialog
        open={resetOpen}
        onOpenChange={(o) => { if (!o) setResetOpen(false); }}
        title="Reset balance?"
      >
        <p className="text-sm text-[var(--color-fg-muted)] mb-4">
          This restores your balance to 1000 credits and clears your session stats. There&apos;s no real money
          here — credits are play-money entertainment only.
        </p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button type="button" onClick={performReset}>Reset to 1000</Button>
        </div>
      </Dialog>

      <PaytableModal open={paytableOpen} onClose={() => setPaytableOpen(false)} />
    </section>
  );
}

/* ----- helpers ------------------------------------------------------------ */

function computeWinningCells(grid: Grid): Set<string> | undefined {
  // Lightweight visual-only highlighter: any cell that is NOT a royal and NOT
  // empty contributes to the flash. This is intentionally generous — we don't
  // re-run the full ways evaluator just to mark cells. The dramatic beat is
  // the win-amount counter; the grid flash is a supporting cue.
  const out = new Set<string>();
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 4; r++) {
      const sym = grid[c]?.[r];
      if (sym === undefined) continue;
      if (sym !== Sym.LOW && sym !== Sym.HIGH) {
        out.add(`${c},${r}`);
      }
    }
  }
  return out;
}

function Stat({
  label,
  value,
  accent,
  highlight,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border bg-[var(--color-bg-elevated)] px-3 py-2",
        accent ? "border-[#a86bff]/40" : "border-[var(--color-line)]",
        className,
      )}
    >
      <p className="text-[10px] uppercase tracking-widest font-mono text-[var(--color-fg-dim)]">
        {label}
      </p>
      <p
        className={cn(
          "font-display text-xl sm:text-2xl tabular-nums",
          accent && "text-[#e8c8ff]",
          highlight && "text-[var(--color-accent)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-[var(--color-fg-dim)]">{label}</dt>
      <dd className="text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}

function BonusBanner({
  frame,
  totalSpins,
  runningTotal,
}: {
  frame: BonusFrame;
  totalSpins: number;
  runningTotal: number;
}) {
  const conversionsActive = frame.conversionMap
    ? Object.keys(frame.conversionMap).length
    : 0;
  return (
    <div
      className="rounded-[var(--radius-md)] border border-[#a86bff]/40 bg-[color-mix(in_oklab,#1a0e2c_75%,transparent)] p-3 flex items-center justify-between gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="text-xs font-mono text-[#e8c8ff]">
        free spin {frame.index + 1} / {totalSpins}
        {conversionsActive > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-[#a86bff]/20 text-[#e8c8ff]">
            {conversionsActive} conversion{conversionsActive === 1 ? "" : "s"} active
          </span>
        )}
      </div>
      <div className="font-display text-lg tabular-nums text-[var(--color-accent)]">
        +{runningTotal.toLocaleString()}
      </div>
    </div>
  );
}

function EmptyGridPlaceholder() {
  return (
    <div
      className="grid grid-cols-5 gap-1.5 sm:gap-2 mx-auto p-2 sm:p-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] bg-[color-mix(in_oklab,#06121f_70%,transparent)]"
      style={{ maxWidth: "min(420px, 100%)" }}
      aria-hidden="true"
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square w-full rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.04)]"
        />
      ))}
    </div>
  );
}
