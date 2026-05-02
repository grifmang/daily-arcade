// /cards — index of card parlor games.
import * as React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Card Parlor — Daily Arcade",
  description: "Play-money video poker. Two variants: Jacks or Better and Deuces Wild.",
};

export const dynamic = "force-static";

export default function CardsIndex() {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">card parlor</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
          video poker.
        </h1>
        <p className="text-base sm:text-lg text-[var(--color-fg-muted)] max-w-md">
          Five cards, hold what you want, draw the rest. Play money only — credits live in this browser, reset whenever.
          For today&#39;s puzzles, head <Link className="underline" href="/">home</Link>.
        </p>
      </header>

      <ul className="grid gap-3 sm:gap-4">
        <li>
          <Link
            href="/cards/jacks-or-better"
            className="group relative flex items-center justify-between gap-4 p-5 sm:p-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-line-strong)] transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">9/6 paytable</p>
              <h2 className="font-display font-semibold text-xl sm:text-2xl mt-1">
                Jacks <span className="text-[#e6c200]">or Better</span>
              </h2>
              <p className="text-sm text-[var(--color-fg-muted)] mt-1">
                The classic: pair of jacks pays, royal flush at max bet pays 4000.
              </p>
            </div>
            <span className="font-mono text-sm text-[var(--color-fg-dim)] group-hover:text-[var(--color-accent)]">
              play →
            </span>
          </Link>
        </li>

        <li>
          <div
            aria-disabled="true"
            className="opacity-70 flex items-center justify-between gap-4 p-5 sm:p-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-bg-elevated)]"
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] font-mono">NSUD paytable · coming soon</p>
              <h2 className="font-display font-semibold text-xl sm:text-2xl mt-1">
                Deuces <span className="text-[var(--color-fg-dim)]">Wild</span>
              </h2>
              <p className="text-sm text-[var(--color-fg-muted)] mt-1">
                Four wild 2s, no pair pays, but five-of-a-kind and natural royals do.
              </p>
            </div>
            <span className="font-mono text-sm text-[var(--color-fg-dim)]">pending</span>
          </div>
        </li>
      </ul>

      <p className="text-xs text-[var(--color-fg-dim)] font-mono pt-4">
        play money only. credits live in this browser, reset whenever you want, and never sync, share, or rank.
      </p>
    </section>
  );
}
