import { ArcadeShell } from "@/components/arcade-shell";

export default function Loading() {
  return (
    <ArcadeShell>
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-3 w-32 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-12 w-3/4 bg-[var(--color-bg-elevated)] rounded" />
        <div className="grid gap-3">
          <div className="h-20 bg-[var(--color-bg-elevated)] rounded-[var(--radius-lg)]" />
          <div className="h-20 bg-[var(--color-bg-elevated)] rounded-[var(--radius-lg)]" />
          <div className="h-20 bg-[var(--color-bg-elevated)] rounded-[var(--radius-lg)]" />
        </div>
      </div>
    </ArcadeShell>
  );
}
