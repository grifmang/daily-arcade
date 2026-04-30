"use client";
import * as React from "react";
import { msUntilNextUtcMidnight } from "@/lib/utils";
import { cn } from "@/lib/utils";

function format(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map(n => n.toString().padStart(2, "0")).join(":");
}

export function Countdown({ className, label = "next:" }: { className?: string; label?: string }) {
  const [ms, setMs] = React.useState<number | null>(null);
  React.useEffect(() => {
    let raf: number;
    const tick = () => {
      setMs(msUntilNextUtcMidnight());
      raf = window.setTimeout(tick, 1000) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(raf);
  }, []);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--color-line-strong)]",
        "font-mono tabular-nums text-[var(--color-fg-muted)]",
        className,
      )}
      aria-label="Time until next puzzle"
    >
      <span className="text-[10px] uppercase tracking-widest text-[var(--color-fg-dim)]">{label}</span>
      <span className="text-[var(--color-fg)]">{ms === null ? "--:--:--" : format(ms)}</span>
    </span>
  );
}
