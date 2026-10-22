import { ArcadeShell } from "@/components/arcade-shell";
import { GameCard } from "@/components/game-card";
import { Countdown } from "@/components/countdown";
import { ALL_GAMES } from "@/lib/types";
import { utcDateString } from "@/lib/utils";

export default function HomePage() {
  const today = utcDateString();
  return (
    <ArcadeShell>
      <section className="space-y-6">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">
            today · {today}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
            three games. <span className="text-[var(--color-accent)]">one streak.</span>
            <br />
            every day.
          </h1>
          <p className="text-base sm:text-lg text-[var(--color-fg-muted)] max-w-md">
            Same puzzle for everyone. Reset at 00:00 UTC. Play one, play three — your streak grows either way.
          </p>
          <div className="sm:hidden">
            <Countdown />
          </div>
        </header>

        <ul className="grid gap-3 sm:gap-4">
          {ALL_GAMES.map(g => (
            <li key={g}>
              <GameCard gameId={g} />
            </li>
          ))}
        </ul>

        <section aria-labelledby="free-play-heading" className="space-y-3">
          <h2 id="free-play-heading" className="text-xs uppercase tracking-[0.2em] font-mono text-[var(--color-fg-muted)]">Free play</h2>
          <a href="/marvel-vs-capcom-2" className="group flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-elevated)] p-5 sm:p-6 hover:border-[var(--color-line-strong)] hover:bg-[var(--color-bg-overlay)] transition-colors">
            <span className="space-y-1">
              <span className="block font-display font-semibold text-lg sm:text-xl">Marvel vs. Capcom 2 · Native preview</span>
              <span className="block text-sm text-[var(--color-fg-muted)]">Ryu versus Cyclops. A two-fighter reconstruction with original sprites, keyboard, touch, and controllers. Free play, outside your daily streak.</span>
            </span>
            <span aria-hidden="true" className="text-[var(--color-accent)]">→</span>
          </a>
          <a href="/punch-out" className="group flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-elevated)] p-5 sm:p-6 hover:border-[var(--color-line-strong)] hover:bg-[var(--color-bg-overlay)] transition-colors">
            <span className="space-y-1">
              <span className="block font-display font-semibold text-lg sm:text-xl">Punch-Out!! · ASCII</span>
              <span className="block text-sm text-[var(--color-fg-muted)]">Step into the ring. Keyboard, touch, or controller. Play anytime, outside your daily streak.</span>
            </span>
            <span aria-hidden="true" className="text-[var(--color-accent)]">→</span>
          </a>
        </section>

        <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] p-4 text-sm text-[var(--color-fg-muted)] font-mono">
          <strong className="text-[var(--color-fg)] not-italic">no signup. no install required.</strong>{" "}
          Streaks live on this device. Share results with the emoji grid you already know.
        </div>
      </section>
    </ArcadeShell>
  );
}
