"use client";
import * as React from "react";
import { type Paytable, HAND_RANK_NAME, HandRank } from "@/lib/cards/video-poker";
import { cn } from "@/lib/utils";

export interface PaytablePanelProps {
  paytable: Paytable;
  /** Currently-active bet (1-5). All paytable rows scale to this bet for display. */
  bet: number;
  /** Top-tier rank (Royal Flush in JoB, Natural Royal Flush in Deuces) — gets the 5-coin bonus highlight. */
  topTierRank: HandRank;
  /** When non-null, this row glows (the player's last winning rank). */
  highlightRank: HandRank | null;
}

export function PaytablePanel({ paytable, bet, topTierRank, highlightRank }: PaytablePanelProps) {
  // Ordered list of paying ranks for this paytable, top-down (best to worst).
  const ROWS: HandRank[] = [
    HandRank.NATURAL_ROYAL_FLUSH,
    HandRank.WILD_ROYAL_FLUSH,
    HandRank.ROYAL_FLUSH,
    HandRank.FOUR_DEUCES,
    HandRank.FIVE_OF_A_KIND,
    HandRank.STRAIGHT_FLUSH,
    HandRank.FOUR_OF_A_KIND,
    HandRank.FULL_HOUSE,
    HandRank.FLUSH,
    HandRank.STRAIGHT,
    HandRank.THREE_OF_A_KIND,
    HandRank.TWO_PAIR,
    HandRank.JACKS_OR_BETTER,
  ];
  const visibleRows = ROWS.filter(r => paytable[r] > 0);

  return (
    <div className="paytable-panel rounded-md border border-[var(--paytable-border)] bg-[var(--paytable-bg)] p-3 sm:p-4">
      <table className="w-full text-xs sm:text-sm font-mono">
        <thead>
          <tr className="text-[var(--paytable-header-fg)]">
            <th className="text-left">hand</th>
            <th className="text-right">pay</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(rank => {
            const isTopAtMaxBet = rank === topTierRank && bet === 5;
            const payout = isTopAtMaxBet ? 4000 : paytable[rank] * bet;
            return (
              <tr
                key={rank}
                className={cn(
                  "paytable-row",
                  highlightRank === rank && "paytable-row-active",
                  isTopAtMaxBet && "paytable-row-bonus",
                )}
              >
                <td className="text-left py-0.5">{HAND_RANK_NAME[rank]}</td>
                <td className="text-right tabular-nums py-0.5">{payout}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
