import Link from "next/link";
import { ArcadeShell } from "@/components/arcade-shell";

export default function NotFound() {
  return (
    <ArcadeShell>
      <section className="space-y-4 max-w-prose">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">404</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">No puzzle here.</h1>
        <p className="text-base text-[var(--color-fg-muted)]">
          This page doesn't exist. Today's three puzzles do, though.
        </p>
        <div className="pt-2">
          <Link href="/" className="inline-flex font-mono underline underline-offset-4 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            ← back to the arcade
          </Link>
        </div>
      </section>
    </ArcadeShell>
  );
}
