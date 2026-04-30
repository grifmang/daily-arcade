import Link from "next/link";
import { notFound } from "next/navigation";
import { ArcadeShell } from "@/components/arcade-shell";
import { getLeaderboard } from "@/lib/actions";
import { ALL_GAMES, GAME_LABELS, GAME_GLYPHS, type GameId } from "@/lib/types";
import { utcDateString } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!ALL_GAMES.includes(game as GameId)) notFound();
  const gameId = game as GameId;
  const date = utcDateString();
  const { entries, total } = await getLeaderboard(gameId, date);

  return (
    <ArcadeShell>
      <section className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">{date} · top 100</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
            <span aria-hidden className="text-[var(--color-accent)]">{GAME_GLYPHS[gameId]}</span>
            {GAME_LABELS[gameId]}
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">{total} {total === 1 ? "entry" : "entries"} today.</p>
        </header>

        <nav aria-label="Other game leaderboards" className="flex gap-2 flex-wrap">
          {ALL_GAMES.filter(g => g !== gameId).map(g => (
            <Link
              key={g}
              href={`/leaderboard/${g}`}
              className="text-xs font-mono px-3 py-1.5 rounded-full border border-[var(--color-line)] hover:border-[var(--color-line-strong)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              {GAME_LABELS[g]} →
            </Link>
          ))}
          <Link
            href={`/g/${gameId}`}
            className="text-xs font-mono px-3 py-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
          >
            Play {GAME_LABELS[gameId]} →
          </Link>
        </nav>

        {entries.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] p-8 text-center font-mono text-sm text-[var(--color-fg-muted)]">
            <p className="mb-2">no entries yet today.</p>
            <p>be the first.</p>
          </div>
        ) : (
          <ol className="rounded-[var(--radius-lg)] border border-[var(--color-line)] overflow-hidden divide-y divide-[var(--color-line)]">
            {entries.map(e => (
              <li
                key={`${e.handle}-${e.discriminator}-${e.rank}`}
                className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 bg-[var(--color-bg-elevated)]"
              >
                <div className="flex items-baseline gap-3 min-w-0">
                  <span
                    className="font-mono text-xs text-[var(--color-fg-dim)] tabular-nums w-8 text-right"
                    aria-label={`Rank ${e.rank}`}
                  >
                    #{e.rank}
                  </span>
                  <span className="font-display text-base sm:text-lg truncate">
                    {e.handle}
                    {e.discriminator > 0 && (
                      <span className="text-[var(--color-fg-dim)]">#{String(e.discriminator).padStart(2, "0")}</span>
                    )}
                  </span>
                </div>
                <span className="font-display font-bold tabular-nums text-lg sm:text-xl text-[var(--color-accent)]">
                  {e.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </ArcadeShell>
  );
}
