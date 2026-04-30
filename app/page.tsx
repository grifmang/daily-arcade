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

        <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] p-4 text-sm text-[var(--color-fg-muted)] font-mono">
          <strong className="text-[var(--color-fg)] not-italic">no signup. no install required.</strong>{" "}
          Streaks live on this device. Share results with the emoji grid you already know.
        </div>
      </section>
    </ArcadeShell>
  );
}
