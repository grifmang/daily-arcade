import Link from "next/link";
import { ArcadeShell } from "@/components/arcade-shell";

export default function NotFound() {
  return (
    <ArcadeShell>
      <section className="space-y-4 max-w-prose">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">share not found</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">This share link has expired or never existed.</h1>
        <p className="text-base text-[var(--color-fg-muted)]">
          Share links are tied to a specific day and may not survive serverless cold-starts on the free preview tier.
        </p>
        <Link href="/" className="inline-flex font-mono underline underline-offset-4 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          ← back to today's puzzles
        </Link>
      </section>
    </ArcadeShell>
  );
}
