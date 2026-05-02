import * as React from "react";
import { SymbolGlyph } from "./symbol-glyph";
import { Sym, type Grid, type SymbolId } from "@/lib/slots/tideforge-pearls";
import { cn } from "@/lib/utils";

/**
 * The 5x4 grid display. Stateless — receives a grid view (with conversions
 * already applied if any) and an optional set of "winning" cell indices to
 * highlight.
 *
 * Grid is rendered column-major (5 columns, each containing 4 cells, top-to-bottom).
 */
export interface ReelGridProps {
  grid: Grid;
  /** Set of "col,row" strings to flash as winning. */
  winningCells?: Set<string>;
  /** Set of "col,row" strings showing a conversion-from-tier-to-PEARL animation. */
  convertingCells?: Set<string>;
  /** Conversion map (only present in bonus). When a cell is a converted symbol, render PEARL. */
  conversionMap?: Partial<Record<SymbolId, SymbolId>> | null;
  className?: string;
}

export function ReelGrid({
  grid,
  winningCells,
  convertingCells,
  conversionMap,
  className,
}: ReelGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-5 gap-1.5 sm:gap-2 mx-auto w-full",
        "p-2 sm:p-3 rounded-[var(--radius-md)] border border-[var(--color-line-strong)]",
        "bg-[color-mix(in_oklab,#06121f_70%,transparent)]",
        className,
      )}
      style={{ maxWidth: "min(420px, 100%)" }}
      role="grid"
      aria-label="Reel grid, 5 columns by 4 rows"
    >
      {Array.from({ length: 4 }).map((_, row) => (
        <React.Fragment key={`r${row}`}>
          {Array.from({ length: 5 }).map((_, col) => {
            const original = grid[col]?.[row] ?? Sym.LOW;
            // Apply optional conversion view
            const displayed: SymbolId =
              conversionMap && original in conversionMap
                ? (conversionMap[original] as SymbolId)
                : original;
            const k = `${col},${row}`;
            return (
              <div
                key={k}
                role="gridcell"
                className="aspect-square w-full"
              >
                <SymbolGlyph
                  symbol={displayed}
                  winning={winningCells?.has(k)}
                  converting={convertingCells?.has(k)}
                />
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
