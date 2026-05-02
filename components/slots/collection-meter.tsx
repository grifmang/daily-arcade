import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pearl-collection meter. Shows progress toward the 4 / 8 / 13 thresholds.
 * Display caps at 16 (cosmetic — meter accumulates beyond 13 without further effect).
 */
export interface CollectionMeterProps {
  meter: number;
  className?: string;
}

const THRESHOLDS = [4, 8, 13] as const;
const DISPLAY_MAX = 16 as const;

export function CollectionMeter({ meter, className }: CollectionMeterProps) {
  const pct = Math.min(100, (meter / DISPLAY_MAX) * 100);
  const reachedAll = meter >= 13;
  return (
    <div
      className={cn("space-y-1.5", className)}
      role="status"
      aria-live="polite"
      aria-label={`Pearl collection meter: ${meter} pearls`}
    >
      <div className="flex items-baseline justify-between text-xs font-mono uppercase tracking-widest text-[var(--color-fg-dim)]">
        <span>collection meter</span>
        <span className="tabular-nums text-[var(--color-fg)]">
          {meter}
          <span className="text-[var(--color-fg-dim)]">/13</span>
        </span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden tide-meter-track">
        <div
          className="h-full tide-meter-fill"
          style={{ width: `${pct}%` }}
        />
        {THRESHOLDS.map((t) => {
          const left = (t / DISPLAY_MAX) * 100;
          const reached = meter >= t;
          return (
            <span
              key={t}
              aria-hidden="true"
              className={cn(
                "absolute top-0 bottom-0 w-px",
                reached ? "bg-[#e8c8ff]" : "bg-[var(--color-line-strong)]",
              )}
              style={{ left: `${left}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-[var(--color-fg-dim)]">
        <span className={cn(meter >= 4 && "text-[#e8c8ff]")}>4 · anglerfish</span>
        <span className={cn(meter >= 8 && "text-[#e8c8ff]")}>8 · squid</span>
        <span className={cn(meter >= 13 && "text-[#e8c8ff]")}>13 · coelacanth</span>
      </div>
      {reachedAll && (
        <p className="text-xs font-mono text-[#e8c8ff]">All lower tiers convert to pearl.</p>
      )}
    </div>
  );
}
