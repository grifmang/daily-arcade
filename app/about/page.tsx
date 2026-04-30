import { ArcadeShell } from "@/components/arcade-shell";
import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <ArcadeShell>
      <article className="prose-arcade space-y-5 max-w-prose">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">About Daily Arcade</h1>
        <p className="text-base text-[var(--color-fg-muted)]">
          A small daily ritual. Three games — Word Volley, Drift 2049, and Snap Trivia —
          all share one thing: the same puzzle for everyone, every day, reset at 00:00 UTC.
        </p>
        <p className="text-base text-[var(--color-fg-muted)]">
          Play one or play all three. Your streak grows when you play <em>any</em> of them on a day.
          No account. No download. No ads. Streaks are stored on your device.
        </p>
        <p className="text-base text-[var(--color-fg-muted)]">
          Submit your score to today's leaderboard with a handle of your choice. If someone else
          claimed that handle today, you'll get a small <code>#number</code> after it — just enough
          to keep things distinct.
        </p>
        <p className="text-base text-[var(--color-fg-muted)]">
          Made with care, no LLMs, deterministic seeds. Open issues welcome.
        </p>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-sm underline underline-offset-4 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← back to today's puzzles
          </Link>
        </div>
      </article>
    </ArcadeShell>
  );
}
