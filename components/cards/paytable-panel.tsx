"use client";
import * as React from "react";
import { type Paytable, HAND_RANK_NAME, HandRank } from "@/lib/cards/video-poker";
import { cn } from "@/lib/utils";

export interface PaytablePanelProps {
  paytable: Paytable;
  /** Currently-active bet (1-5). Highlights the matching column in red. */
  bet: number;
  /** Top-tier rank (Royal Flush in JoB) — shows 4000 at bet=5 column. */
  topTierRank: HandRank;
  /** When non-null, this row glows (the player's last winning rank). */
  highlightRank: HandRank | null;
}

// Short display names that fit the compact paytable grid.
const SHORT_NAMES: Partial<Record<HandRank, string>> = {
  [HandRank.ROYAL_FLUSH]:         "ROYAL FLUSH",
  [HandRank.NATURAL_ROYAL_FLUSH]: "ROYAL FLUSH",
  [HandRank.STRAIGHT_FLUSH]:      "STR FLUSH",
  [HandRank.FOUR_OF_A_KIND]:      "4 OF A KIND",
  [HandRank.FULL_HOUSE]:          "FULL HOUSE",
  [HandRank.FLUSH]:               "FLUSH",
  [HandRank.STRAIGHT]:            "STRAIGHT",
  [HandRank.THREE_OF_A_KIND]:     "3 OF A KIND",
  [HandRank.TWO_PAIR]:            "2 PAIR",
  [HandRank.JACKS_OR_BETTER]:     "JACKS OR BETTER",
  // Deuces Wild extras
  [HandRank.FIVE_OF_A_KIND]:      "5 OF A KIND",
  [HandRank.FOUR_DEUCES]:         "4 DEUCES",
  [HandRank.WILD_ROYAL_FLUSH]:    "WILD ROYAL",
};

// Ordered rows for JoB paytable (top to bottom, best to worst).
const JOB_ROW_ORDER: HandRank[] = [
  HandRank.ROYAL_FLUSH,
  HandRank.STRAIGHT_FLUSH,
  HandRank.FOUR_OF_A_KIND,
  HandRank.FULL_HOUSE,
  HandRank.FLUSH,
  HandRank.STRAIGHT,
  HandRank.THREE_OF_A_KIND,
  HandRank.TWO_PAIR,
  HandRank.JACKS_OR_BETTER,
];

// Full ordered list covering all hands (Deuces Wild variants included).
const ALL_ROW_ORDER: HandRank[] = [
  HandRank.NATURAL_ROYAL_FLUSH,
  HandRank.FOUR_DEUCES,
  HandRank.WILD_ROYAL_FLUSH,
  HandRank.FIVE_OF_A_KIND,
  ...JOB_ROW_ORDER,
];

export function PaytablePanel({ paytable, bet, topTierRank, highlightRank }: PaytablePanelProps) {
  const visibleRows = ALL_ROW_ORDER.filter(r => paytable[r] > 0);

  // For each rank, compute payout at each bet level 1-5.
  function payAtBet(rank: HandRank, b: number): number {
    if (b === 5 && rank === topTierRank) return 4000;
    return paytable[rank] * b;
  }

  return (
    <div
      className="paytable-vp-grid"
      role="table"
      aria-label="Paytable — payout per bet level"
    >
      {/* Header row */}
      <div role="row" className="contents">
        <div
          role="columnheader"
          className={cn(
            "paytable-vp-cell paytable-vp-name paytable-vp-cell-header",
            "bg-[var(--paytable-vp-header-bg)]",
          )}
        >
          HAND
        </div>
        {[1, 2, 3, 4, 5].map(b => (
          <div
            key={b}
            role="columnheader"
            className={cn(
              "paytable-vp-cell paytable-vp-cell-header",
              "bg-[var(--paytable-vp-header-bg)]",
              b === bet && "paytable-vp-active-col",
            )}
          >
            BET {b}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {visibleRows.map(rank => {
        const isWinRow = highlightRank === rank;
        const label = SHORT_NAMES[rank] ?? HAND_RANK_NAME[rank];
        return (
          <div
            key={rank}
            role="row"
            className={cn("contents", isWinRow && "paytable-vp-row-win")}
            aria-selected={isWinRow}
          >
            <div
              role="cell"
              className={cn(
                "paytable-vp-cell paytable-vp-name",
                isWinRow && "paytable-vp-row-win",
              )}
            >
              {label}
            </div>
            {[1, 2, 3, 4, 5].map(b => (
              <div
                key={b}
                role="cell"
                className={cn(
                  "paytable-vp-cell",
                  b === bet && "paytable-vp-active-col",
                  isWinRow && b !== bet && "paytable-vp-row-win",
                )}
              >
                {payAtBet(rank, b)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
