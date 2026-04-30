"use client";
import { useEffect } from "react";
import { ArcadeShell } from "@/components/arcade-shell";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <ArcadeShell>
      <section className="space-y-4 max-w-prose">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-bad)] font-mono">something broke</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">A puzzle piece slipped.</h1>
        <p className="text-base text-[var(--color-fg-muted)]">
          We logged what happened. Try again.
        </p>
        <div className="pt-2 flex gap-2">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </section>
    </ArcadeShell>
  );
}
