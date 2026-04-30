import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArcadeShell } from "@/components/arcade-shell";
import { Button } from "@/components/ui/button";
import { store } from "@/lib/store";
import { GAME_GLYPHS, GAME_LABELS, type GameId } from "@/lib/types";

interface Params { id: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const rec = await store().getShare(id);
  if (!rec) return { title: "Share — not found" };
  const ogUrl = `/og/${rec.gameId}?id=${encodeURIComponent(rec.id)}`;
  return {
    title: `${rec.handle} · ${GAME_LABELS[rec.gameId as GameId]} ${rec.date}`,
    description: `${rec.handle} scored ${rec.score} on ${GAME_LABELS[rec.gameId as GameId]} (${rec.date}). Play your own → daily-arcade.netlify.app`,
    openGraph: {
      title: `${rec.handle} on ${GAME_LABELS[rec.gameId as GameId]}`,
      description: `Score ${rec.score} · ${rec.date}`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogUrl],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const rec = await store().getShare(id);
  if (!rec) notFound();

  return (
    <ArcadeShell>
      <section className="space-y-6">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">a daily arcade share</p>
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] p-6 sm:p-8 space-y-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-sm text-[var(--color-fg-muted)] font-mono">{rec.date}</div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1">
                <span aria-hidden className="text-[var(--color-accent)] mr-2">{GAME_GLYPHS[rec.gameId as GameId]}</span>
                {GAME_LABELS[rec.gameId as GameId]}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">score</div>
              <div className="font-display text-3xl sm:text-4xl font-bold tabular-nums text-[var(--color-accent)]">{rec.score}</div>
            </div>
          </div>

          <div className="font-mono text-base text-[var(--color-fg-muted)]">
            <span className="text-[var(--color-fg)]">{rec.handle}</span>
            {rec.discriminator > 0 && (
              <span className="text-[var(--color-fg-dim)]">#{String(rec.discriminator).padStart(2, "0")}</span>
            )}{" "}
            played today.
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Link href={`/g/${rec.gameId}?from=${encodeURIComponent(rec.handle)}`} className="flex-1">
              <Button className="w-full">Play the same puzzle</Button>
            </Link>
            <Link href={`/leaderboard/${rec.gameId}`} className="flex-1">
              <Button variant="secondary" className="w-full">Today's leaderboard</Button>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-fg-dim)] font-mono">
          Same puzzle for everyone. Resets at 00:00 UTC.
        </p>
      </section>
    </ArcadeShell>
  );
}
