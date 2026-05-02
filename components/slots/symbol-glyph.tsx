import * as React from "react";
import { cn } from "@/lib/utils";
import { Sym, type SymbolId } from "@/lib/slots/tideforge-pearls";

/**
 * Visual representation of a Tideforge Pearls symbol.
 * CSS-only / inline SVG / emoji — no external image assets.
 *
 * Theme is maritime supernatural:
 *  - PEARL: luminous violet-iridescent storm pearl (the hero / collection symbol)
 *  - ANGLER / SQUID / COELA / MANTA: deep-sea creatures, descending tier
 *  - LOW / HIGH: card-royal stand-ins, rendered as bronze/copper bell faces
 *  - WILD: vertical lightning bolt
 *  - SCAT: brass bell
 */
export interface SymbolGlyphProps {
  symbol: SymbolId;
  /** Highlight a winning cell. */
  winning?: boolean;
  /** Mark a cell that's about to convert to PEARL (between meter thresholds in the bonus). */
  converting?: boolean;
  className?: string;
}

const LABEL: Record<SymbolId, string> = {
  [Sym.PEARL]: "Storm Pearl",
  [Sym.ANGLER]: "Anglerfish",
  [Sym.SQUID]: "Giant Squid",
  [Sym.COELA]: "Coelacanth",
  [Sym.MANTA]: "Manta Ray",
  [Sym.LOW]: "Low Royal",
  [Sym.HIGH]: "High Royal",
  [Sym.WILD]: "Lightning Strike",
  [Sym.SCAT]: "Brass Bell",
};

// Compact text glyph for the inline grid. We deliberately avoid emoji that
// might render inconsistently across platforms; instead we use stylized
// letterforms and shapes from the Unicode geometric/symbol blocks plus a
// couple of inline SVGs for the more distinctive icons.
function GlyphContent({ symbol }: { symbol: SymbolId }) {
  switch (symbol) {
    case Sym.PEARL:
      return (
        <span aria-hidden="true" className="tide-pearl-orb">
          <span className="tide-pearl-core" />
        </span>
      );
    case Sym.ANGLER:
      return <span aria-hidden="true" className="tide-tier tide-angler">A</span>;
    case Sym.SQUID:
      return <span aria-hidden="true" className="tide-tier tide-squid">S</span>;
    case Sym.COELA:
      return <span aria-hidden="true" className="tide-tier tide-coela">C</span>;
    case Sym.MANTA:
      return <span aria-hidden="true" className="tide-tier tide-manta">M</span>;
    case Sym.LOW:
      return <span aria-hidden="true" className="tide-royal tide-royal-low">9</span>;
    case Sym.HIGH:
      return <span aria-hidden="true" className="tide-royal tide-royal-high">K</span>;
    case Sym.WILD:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="60%"
          height="60%"
          className="tide-wild-bolt"
        >
          <path
            d="M14 2 L4 14 L11 14 L9 22 L20 9 L13 9 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1"
          />
        </svg>
      );
    case Sym.SCAT:
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="62%" height="62%" className="tide-bell">
          <path
            d="M12 3 C9 3 7 5 7 9 V13 C7 14 6 15 5 15 V17 H19 V15 C18 15 17 14 17 13 V9 C17 5 15 3 12 3 Z"
            fill="currentColor"
            opacity="0.85"
          />
          <circle cx="12" cy="20" r="1.6" fill="currentColor" />
        </svg>
      );
  }
}

export function SymbolGlyph({ symbol, winning, converting, className }: SymbolGlyphProps) {
  return (
    <span
      role="img"
      aria-label={LABEL[symbol]}
      className={cn(
        "tide-cell",
        symbol === Sym.PEARL && "tide-cell-pearl",
        symbol === Sym.WILD && "tide-cell-wild",
        symbol === Sym.SCAT && "tide-cell-scat",
        symbol >= Sym.ANGLER && symbol <= Sym.MANTA && "tide-cell-tier",
        (symbol === Sym.LOW || symbol === Sym.HIGH) && "tide-cell-royal",
        winning && "tide-cell-winning",
        converting && "tide-cell-converting",
        className,
      )}
    >
      <GlyphContent symbol={symbol} />
    </span>
  );
}
