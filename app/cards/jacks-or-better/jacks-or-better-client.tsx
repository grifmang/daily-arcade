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
import { cn } from "@/lib/utils";

const SLUG = "jacks-or-better";

type Phase = "idle" | "dealt" | "drawn";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

// Human-readable phase labels shown in the cabinet footer / phase banner.
const PHASE_LABEL: Record<Phase, string> = {
  idle:  "INSERT COIN",
  dealt: "HOLDING",
  drawn: "GAME OVER",
};

export function JacksOrBetterClient() {
  const [credits, setCredits] = React.useState<number>(DEFAULT_CREDITS);
  const [stats, setStats]     = React.useState<SessionStats>(() => ({ ...EMPTY_STATS, rankHits: {} }));
  const [bet, setBet]         = React.useState<number>(5);
  const [phase, setPhase]     = React.useState<Phase>("idle");
  const [round, setRound]     = React.useState<RoundStart | null>(null);
  const [holds, setHolds]     = React.useState<readonly boolean[]>([false, false, false, false, false]);
  const [finalHand, setFinalHand] = React.useState<Hand | null>(null);
  const [lastRank, setLastRank]   = React.useState<HandRank | null>(null);
  const [lastWin, setLastWin]     = React.useState<number>(0);
  const [menuOpen, setMenuOpen]   = React.useState<boolean>(false);
  const reduced = React.useMemo(() => prefersReducedMotion(), []);
  void reduced;

  // Hydration ref: prevents SSR default from overwriting stored credits on mount.
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    setCredits(loadCredits(SLUG));
    setStats(loadStats(SLUG));
    hydrated.current = true;
  }, []);

  React.useEffect(() => { if (hydrated.current) saveCredits(SLUG, credits); }, [credits]);
  React.useEffect(() => { if (hydrated.current) saveStats(SLUG, stats); }, [stats]);

  const canDeal = phase !== "dealt" && credits >= bet;
  const canDraw = phase === "dealt";

  function deal() {
    if (!canDeal) return;
    setCredits(c => c - bet);
    const r = startRound(createCryptoRng());
    setRound(r);
    setHolds([false, false, false, false, false]);
    setFinalHand(null);
    setLastRank(null);
    setLastWin(0);
    setPhase("dealt");
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
    resetCredits(SLUG);
    resetStats(SLUG);
    setCredits(DEFAULT_CREDITS);
    setStats({ ...EMPTY_STATS, rankHits: {} });
    setPhase("idle");
    setRound(null);
    setFinalHand(null);
    setLastRank(null);
    setLastWin(0);
    setMenuOpen(false);
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

  const primaryLabel  = phase === "dealt" ? "DRAW" : "DEAL";
  const primaryAction = phase === "dealt" ? draw : deal;
  const primaryDisabled = phase === "dealt" ? false : !canDeal;

  const phaseLabel = phase === "idle"
    ? "DEAL TO START"
    : phase === "dealt"
      ? "SELECT HOLDS — THEN DRAW"
      : lastRank != null && lastRank !== HandRank.NONE
        ? `${HAND_RANK_NAME[lastRank].toUpperCase()} — WIN ${lastWin}`
        : "NO WIN";

  return (
    <>
      {/* ── Outer wrapper centers the cabinet in the viewport with breathing-room ── */}
      <div className="cabinet-vp-wrap">
        {/* ── VP Cabinet shell — sized via .cabinet-vp-shell (clamp-driven) ── */}
        <div className="cabinet-vp cabinet-vp-shell">
          {/* ── PAYTABLE ── */}
          <div className="flex-none border-b border-[var(--cabinet-vp-border)]">
            <PaytablePanel
              paytable={JOB_PAYTABLE}
              bet={bet}
              topTierRank={HandRank.ROYAL_FLUSH}
              highlightRank={lastRank ?? null}
            />
          </div>

          {/* ── PHASE BANNER ── */}
          <div
            className="flex-none flex items-center justify-center border-b border-[var(--cabinet-vp-border)]"
            style={{
              padding: "clamp(4px, 0.6vw, 10px) clamp(8px, 1vw, 16px)",
              minHeight: "clamp(24px, 3vw, 36px)",
            }}
          >
            <span className="phase-banner-vp">{phaseLabel}</span>
          </div>

          {/* ── CARD AREA ── grows to fill remaining vertical space */}
          <div
            className="flex-1 flex flex-col justify-center"
            style={{ padding: "clamp(4px, 0.8vw, 16px) clamp(12px, 2vw, 32px) clamp(6px, 1vw, 18px)" }}
          >
            <CardRow
              cards={displayCards}
              highlights={displayHighlights}
              holds={holds}
              onToggleHold={toggleHold}
              holdDisabled={phase !== "dealt"}
            />
          </div>

          {/* ── READOUT STRIP ── */}
          <div
            className="flex-none flex items-center justify-between border-t border-[var(--cabinet-vp-border)]"
            style={{
              padding: "clamp(4px, 0.6vw, 10px) clamp(10px, 1.2vw, 18px)",
              gap: "clamp(6px, 0.8vw, 14px)",
              background: "var(--cabinet-vp-inner)",
            }}
          >
            {/* WIN */}
            <div className={cn("readout-vp", "readout-vp-win")} style={{ flex: 1 }}>
              <span className="readout-vp-label">WIN</span>
              <span className="readout-vp-value">
                {phase === "drawn" && lastWin > 0 ? lastWin : "—"}
              </span>
            </div>

            {/* BET */}
            <div className="readout-vp" style={{ flex: 1 }}>
              <span className="readout-vp-label">BET</span>
              <span className="readout-vp-value">{bet}</span>
            </div>

            {/* CREDITS */}
            <div className="readout-vp" style={{ flex: 1.4 }}>
              <span className="readout-vp-label">CREDITS</span>
              <span className="readout-vp-value">
                {credits}
              </span>
            </div>
          </div>

          {/* ── CONTROL BUTTON STRIP ── */}
          <div
            className="flex-none flex items-center justify-between border-t border-[var(--cabinet-vp-border)]"
            style={{
              padding: "clamp(5px, 0.7vw, 12px) clamp(8px, 1.2vw, 18px)",
              gap: "clamp(6px, 1vw, 16px)",
              background: "var(--cabinet-vp-inner)",
            }}
          >
            {/* MENU button */}
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-expanded={menuOpen}
              aria-controls="vp-menu-panel"
              className="btn-vp"
            >
              MENU
            </button>

            {/* Bet controls */}
            <div className="flex items-center" style={{ gap: "clamp(6px, 0.8vw, 12px)" }}>
              <BetSelector bet={bet} onChange={setBet} disabled={phase === "dealt"} vpMode />
            </div>

            {/* Primary action */}
            <button
              type="button"
              onClick={primaryAction}
              disabled={primaryDisabled}
              className={cn("btn-vp btn-vp-primary", primaryDisabled && "opacity-45")}
              aria-label={phase === "dealt" ? "Draw replacement cards" : "Deal new hand"}
            >
              {primaryLabel}
            </button>
          </div>

          {/* ── FOOTER ── */}
          <div className="footer-vp flex-none">
            <span>JACKS OR BETTER</span>
            <span>{PHASE_LABEL[phase]}</span>
          </div>
        </div>
      </div>

      {/* ── MENU PANEL (modal-style, overlays cabinet) ── */}
      {menuOpen && (
        <div
          id="vp-menu-panel"
          role="dialog"
          aria-label="Game menu"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget) setMenuOpen(false); }}
        >
          <div
            className="cabinet-vp rounded-lg"
            style={{
              width: "min(360px, 90vw)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <h2
              className="phase-banner-vp text-center"
              style={{ fontSize: "0.85rem", letterSpacing: "0.2em", marginBottom: "4px" }}
            >
              MENU
            </h2>

            {/* Session stats */}
            <dl
              className="grid grid-cols-2 gap-y-1 gap-x-4"
              style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)" }}
            >
              <dt style={{ color: "var(--paytable-vp-dim)" }}>Hands played</dt>
              <dd style={{ color: "var(--paytable-vp-text)", textAlign: "right" }}>{stats.handsPlayed}</dd>
              <dt style={{ color: "var(--paytable-vp-dim)" }}>Total wagered</dt>
              <dd style={{ color: "var(--paytable-vp-text)", textAlign: "right" }}>{stats.totalWagered}</dd>
              <dt style={{ color: "var(--paytable-vp-dim)" }}>Total won</dt>
              <dd style={{ color: "var(--paytable-vp-text)", textAlign: "right" }}>{stats.totalWon}</dd>
              <dt style={{ color: "var(--paytable-vp-dim)" }}>Net</dt>
              <dd
                style={{
                  textAlign: "right",
                  color: stats.totalWon - stats.totalWagered >= 0
                    ? "var(--paytable-vp-text)"
                    : "#ff6b6b",
                }}
              >
                {stats.totalWon - stats.totalWagered >= 0 ? "+" : ""}
                {stats.totalWon - stats.totalWagered}
              </dd>
              <dt style={{ color: "var(--paytable-vp-dim)" }}>Best win</dt>
              <dd style={{ color: "var(--paytable-vp-text)", textAlign: "right" }}>{stats.bestSingleWin}</dd>
            </dl>

            {/* Disclaimer */}
            <p
              style={{
                fontSize: "0.55rem",
                color: "var(--paytable-vp-dim)",
                fontFamily: "var(--font-mono)",
                lineHeight: 1.5,
                borderTop: "1px solid var(--cabinet-vp-border)",
                paddingTop: "8px",
              }}
            >
              Play money only. No real currency. No leaderboard. Credits reset to{" "}
              {DEFAULT_CREDITS} for entertainment purposes.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={performReset}
                className="btn-vp"
                aria-label="Reset balance to 1000 and clear session stats"
                style={{ flex: 1 }}
              >
                RESET BALANCE
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="btn-vp btn-vp-primary"
                aria-label="Close menu"
                style={{ flex: 1 }}
              >
                CLOSE
              </button>
            </div>

            {/* Nav links */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.55rem",
                fontFamily: "var(--font-mono)",
                color: "var(--paytable-vp-dim)",
                borderTop: "1px solid var(--cabinet-vp-border)",
                paddingTop: "6px",
              }}
            >
              <Link href="/cards" className="underline hover:text-[var(--paytable-vp-text)]">
                Card Parlor
              </Link>
              <Link href="/" className="underline hover:text-[var(--paytable-vp-text)]">
                Today&rsquo;s Puzzles
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── ARIA live region for screen-reader win announcements ── */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {phase === "drawn" && lastRank != null && (
          lastRank === HandRank.NONE
            ? "No win this hand."
            : `${HAND_RANK_NAME[lastRank]} — you win ${lastWin} credits.`
        )}
      </div>
    </>
  );
}
