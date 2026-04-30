"use client";
import * as React from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { useStreak } from "@/lib/hooks/use-streak";
import { Countdown } from "./countdown";

export function ArcadeShell({ children }: { children: React.ReactNode }) {
  const { current } = useStreak();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_85%,transparent)] backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span aria-hidden className="grid place-items-center w-7 h-7 rounded-[6px] bg-[var(--color-accent)] text-[var(--color-accent-fg)] font-display font-bold">
              ▣
            </span>
            <span className="font-display font-semibold tracking-tight text-base sm:text-lg">
              DAILY <span className="text-[var(--color-accent)]">ARCADE</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--color-line-strong)] text-[var(--color-fg-muted)] font-mono"
              aria-label={`Current streak: ${current} day${current === 1 ? "" : "s"}`}
              title="Daily streak"
            >
              <Flame aria-hidden className="w-3.5 h-3.5 text-[var(--color-amber)]" />
              <span className="text-[var(--color-fg)] tabular-nums">{current}</span>
            </span>
            <Countdown className="hidden sm:inline-flex" />
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-[var(--color-line)] mt-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-[var(--color-fg-dim)]">
          <span>Daily Arcade · same puzzle for everyone · resets at 00:00 UTC</span>
          <Link href="/about" className="hover:text-[var(--color-fg)]">about</Link>
        </div>
      </footer>
    </div>
  );
}
