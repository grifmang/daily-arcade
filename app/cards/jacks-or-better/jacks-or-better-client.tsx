"use client";
import * as React from "react";
import Link from "next/link";
import {
  startRound, applyHolds, createCryptoRng,
  JOB_PAYTABLE, HandRank, HAND_RANK_NAME,
  loadCredits, saveCredits, loadStats, saveStats, recordHand, resetCredits, resetStats,
  DEFAULT_CREDITS, EMPTY_STATS,
  type Card, type Hand, type RoundStart, type SessionStats,
} from "@/lib/cards/video-poker";
import { CardRow } from "@/components/cards/card-row";
import { PaytablePanel } from "@/components/cards/paytable-panel";
import { BetSelector } from "@/components/cards/bet-selector";
import { HoldToggle } from "@/components/cards/hold-toggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const SLUG = "jacks-or-better";
const CABINET_CLASS = "cabinet-job";

type Phase = "idle" | "dealt" | "drawn";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

let renderCount = 0;
export function JacksOrBetterClient() {
  renderCount++;
  if (renderCount < 30 || renderCount % 50 === 0) {
    console.log("[render]", renderCount);
  }
  const { push } = useToast();
  const [credits, setCredits] = React.useState<number>(DEFAULT_CREDITS);
  const [stats, setStats] = React.useState<SessionStats>(() => ({ ...EMPTY_STATS, rankHits: {} }));
  const [bet, setBet] = React.useState<number>(5);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [round, setRound] = React.useState<RoundStart | null>(null);
  const [holds, setHolds] = React.useState<readonly boolean[]>([false, false, false, false, false]);
  const [finalHand, setFinalHand] = React.useState<Hand | null>(null);
  const [lastRank, setLastRank] = React.useState<HandRank | null>(null);
  const [lastWin, setLastWin] = React.useState<number>(0);
  const reduced = React.useMemo(() => prefersReducedMotion(), []);
  // `hydrated` flips true after the mount effect overwrites the SSR defaults
  // with whatever's in localStorage. The save effects below skip the pre-
  // hydration commits so we never overwrite a returning player's stored
  // balance with the SSR `DEFAULT_CREDITS = 1000` placeholder.
  const hydrated = React.useRef(false);

  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    setCredits(loadCredits(SLUG));
    setStats(loadStats(SLUG));
    hydrated.current = true;
  }, []);

  // Persist credits / stats — gated on hydration so the SSR placeholder render never writes back.
  React.useEffect(() => { if (hydrated.current) saveCredits(SLUG, credits); }, [credits]);
  React.useEffect(() => { if (hydrated.current) saveStats(SLUG, stats); }, [stats]);

  const canDeal = phase !== "dealt" && credits >= bet;
  const canDraw = phase === "dealt";

  function deal() {
    console.log("[deal] entry, canDeal=", canDeal, "credits=", credits, "bet=", bet, "phase=", phase);
    if (!canDeal) { console.log("[deal] canDeal=false, returning"); return; }
    console.log("[deal] step 1: setCredits");
    setCredits(c => c - bet);
    console.log("[deal] step 2: createCryptoRng");
    const rng = createCryptoRng();
    console.log("[deal] step 3: startRound");
    const r = startRound(rng);
    console.log("[deal] step 4: startRound returned, hand[0]=", r.hand[0], "remainingDeckLen=", r.remainingDeck.length);
    setRound(r);
    console.log("[deal] step 5: setHolds");
    setHolds([false, false, false, false, false]);
    setFinalHand(null);
    setLastRank(null);
    setLastWin(0);
    console.log("[deal] step 6: setPhase('dealt')");
    setPhase("dealt");
    console.log("[deal] DONE — function returning");
  }

  function toggleHold(i: number) {
    if (phase !== "dealt") return;
    setHolds(prev => prev.map((h, idx) => idx === i ? !h : h));
  }

  function draw() {
    if (!canDraw || !round) return;
    const result = applyHolds(round, holds, JOB_PAYTABLE, bet);
    setFinalHand(result.finalHand);
    setLastRank(result.handRank);
    setLastWin(result.payout);
    setCredits(c => c + result.payout);
    setStats(s => recordHand(s, bet, result.payout, result.handRank));
    setPhase("drawn");
  }

  function performReset() {
    if (!confirm("Reset balance to 1000? No real money here — credits are play-money entertainment only.")) return;
    resetCredits(SLUG);
    resetStats(SLUG);
    setCredits(DEFAULT_CREDITS);
    setStats({ ...EMPTY_STATS, rankHits: {} });
    setPhase("idle");
    setRound(null);
    setFinalHand(null);
    setLastRank(null);
    setLastWin(0);
    push("Balance reset to 1000.", "default");
  }

  // Display hand: dealt cards before draw; final hand after.
  const displayCards: ReadonlyArray<Card | null> =
    phase === "drawn" && finalHand
      ? finalHand
      : round
        ? round.hand
        : [null, null, null, null, null];

  const displayHighlights = displayCards.map((_, i): "hold" | "win" | null => {
    if (phase === "drawn" && lastRank != null && lastRank !== HandRank.NONE) return "win";
    if (phase === "dealt" && holds[i]) return "hold";
    return null;
  });

  const primaryButtonLabel = phase === "dealt" ? "Draw" : "Deal";
  const primaryButtonAction = phase === "dealt" ? draw : deal;
  const primaryButtonDisabled = phase === "dealt" ? false : !canDeal;

  // Reduced-motion is honored both via the CSS @media query (zeroing
  // animation/transition) and here at the JS layer: the `reduced` flag is
  // computed once on mount so future timer-driven beats can short-circuit.
  // No timer-driven beats exist in the JoB UI today, but the hook is in place
  // for future deal/flip animations.
  void reduced;

  return (
    <section className={cn("space-y-5 rounded-[var(--radius-lg)] p-4 sm:p-6", CABINET_CLASS)}>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">card parlor · video poker</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
          Jacks <span className="text-[#e6c200]">or Better</span>
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          9/6 paytable. Play money — no real currency, no leaderboard. Five cards, hold what you want, draw the rest.
        </p>
      </header>

      <PaytablePanel
        paytable={JOB_PAYTABLE}
        bet={bet}
        topTierRank={HandRank.ROYAL_FLUSH}
        highlightRank={lastRank ?? null}
      />

      <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm font-mono">
        <div className="rounded-sm border border-[var(--color-line)] p-2 sm:p-3">
          <span className="block text-[10px] uppercase tracking-widest text-[var(--color-fg-dim)]">balance</span>
          <span className="block text-lg sm:text-xl tabular-nums text-[var(--color-fg)]">{credits}</span>
        </div>
        <div className="rounded-sm border border-[var(--color-line)] p-2 sm:p-3">
          <span className="block text-[10px] uppercase tracking-widest text-[var(--color-fg-dim)]">bet</span>
          <span className="block text-lg sm:text-xl tabular-nums text-[var(--color-fg)]">{bet}</span>
        </div>
        <div className="rounded-sm border border-[var(--color-line)] p-2 sm:p-3">
          <span className="block text-[10px] uppercase tracking-widest text-[var(--color-fg-dim)]">last win</span>
          <span className="block text-lg sm:text-xl tabular-nums text-[var(--color-accent)]">
            {phase === "drawn" ? `+${lastWin}` : "—"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <CardRow cards={displayCards} highlights={displayHighlights} motif="classic" />
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {[0, 1, 2, 3, 4].map(i => (
            <HoldToggle
              key={i}
              held={holds[i] ?? false}
              onToggle={() => toggleHold(i)}
              disabled={phase !== "dealt"}
              position={i + 1}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <BetSelector bet={bet} onChange={setBet} disabled={phase === "dealt"} />
        <Button onClick={primaryButtonAction} disabled={primaryButtonDisabled}>
          {primaryButtonLabel}
        </Button>
        {credits < bet && phase !== "dealt" && (
          <span className="text-xs text-[var(--color-fg-muted)]">Out of credits — reset balance below.</span>
        )}
      </div>

      <details className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-elevated)] p-3 sm:p-4">
        <summary className="cursor-pointer text-sm font-mono text-[var(--color-fg-muted)]">session stats</summary>
        <dl className="grid grid-cols-2 gap-3 mt-3 text-xs sm:text-sm font-mono tabular-nums">
          <div><dt className="text-[var(--color-fg-dim)]">hands played</dt><dd>{stats.handsPlayed}</dd></div>
          <div><dt className="text-[var(--color-fg-dim)]">total wagered</dt><dd>{stats.totalWagered}</dd></div>
          <div><dt className="text-[var(--color-fg-dim)]">total won</dt><dd>{stats.totalWon}</dd></div>
          <div><dt className="text-[var(--color-fg-dim)]">net</dt><dd className={cn(stats.totalWon - stats.totalWagered >= 0 ? "text-[var(--color-accent)]" : "text-[var(--card-suit-red)]")}>{stats.totalWon - stats.totalWagered}</dd></div>
          <div className="col-span-2"><dt className="text-[var(--color-fg-dim)]">best single win</dt><dd>{stats.bestSingleWin}</dd></div>
        </dl>
        <div className="mt-3">
          <Button onClick={performReset} variant="outline">Reset balance</Button>
        </div>
      </details>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {phase === "drawn" && lastRank != null && (
          lastRank === HandRank.NONE
            ? "No win this hand."
            : `${HAND_RANK_NAME[lastRank]} — you win ${lastWin} credits.`
        )}
      </div>

      <p className="text-xs text-[var(--color-fg-dim)] font-mono pt-2">
        <Link className="underline" href="/cards">← card parlor</Link> · <Link className="underline" href="/">today&#39;s puzzles</Link>
      </p>
    </section>
  );
}
