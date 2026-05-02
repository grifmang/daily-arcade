"use client";
import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { SymbolGlyph } from "./symbol-glyph";
import { Sym, PAYTABLE, type SymbolId } from "@/lib/slots/tideforge-pearls";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ROWS: Array<{ symbol: SymbolId; label: string; description?: string }> = [
  { symbol: Sym.PEARL, label: "Storm Pearl", description: "Hero. Also the collection symbol." },
  { symbol: Sym.ANGLER, label: "Anglerfish" },
  { symbol: Sym.SQUID, label: "Giant Squid" },
  { symbol: Sym.COELA, label: "Coelacanth" },
  { symbol: Sym.MANTA, label: "Manta Ray" },
  { symbol: Sym.HIGH, label: "High Royal (Q / K / A)" },
  { symbol: Sym.LOW, label: "Low Royal (9 / 10 / J)" },
];

export function PaytableModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="Paytable">
      <div className="space-y-4 text-sm">
        <p className="text-[var(--color-fg-muted)]">
          1,024 ways. Pays from left to right on consecutive reels. Pay = ways × pay-per-way × wild multiplier.
        </p>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs uppercase tracking-widest font-mono text-[var(--color-fg-dim)]">
              <tr>
                <th scope="col" className="py-1 pl-1">Symbol</th>
                <th scope="col" className="py-1 text-right">3</th>
                <th scope="col" className="py-1 text-right">4</th>
                <th scope="col" className="py-1 text-right pr-1">5</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {ROWS.map((row) => {
                const pays = PAYTABLE[row.symbol];
                return (
                  <tr key={row.symbol} className="border-t border-[var(--color-line)]">
                    <td className="py-2 pl-1">
                      <span className="flex items-center gap-2.5">
                        <span className="block w-9 h-9">
                          <SymbolGlyph symbol={row.symbol} />
                        </span>
                        <span>
                          <span className="block text-sm font-display">{row.label}</span>
                          {row.description && (
                            <span className="block text-xs text-[var(--color-fg-dim)]">{row.description}</span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 text-right">{pays[3]}</td>
                    <td className="py-2 text-right">{pays[4]}</td>
                    <td className="py-2 text-right pr-1">{pays[5]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] p-3 space-y-2">
          <h3 className="font-display text-base">Lightning Strike (wild)</h3>
          <p className="text-[var(--color-fg-muted)]">
            Lands on reels 2, 3, and 4. Substitutes for every paying symbol. In free spins, every column with at least one
            wild rolls a ×2 or ×3 multiplier. Multipliers across columns compound (max ×27).
          </p>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] p-3 space-y-2">
          <h3 className="font-display text-base">Brass Bell (scatter)</h3>
          <p className="text-[var(--color-fg-muted)]">
            3 / 4 / 5 brass bells anywhere trigger 8 / 15 / 20 free spins. 5 bells also pay {PAYTABLE[Sym.SCAT][5]} credits flat.
            During free spins, 2 bells award +5 spins; 3+ re-add the trigger amount.
          </p>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] p-3 space-y-2">
          <h3 className="font-display text-base">Storm-pearl collection</h3>
          <p className="text-[var(--color-fg-muted)]">
            During free spins, each storm pearl that lands fills the collection meter. Reach 4 to convert anglerfish to
            pearl, 8 to convert squid, 13 to convert coelacanth. Manta ray never converts — that&apos;s the spec.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
