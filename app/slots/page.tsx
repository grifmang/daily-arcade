import type { Metadata } from "next";
import Link from "next/link";
import { ArcadeShell } from "@/components/arcade-shell";

export const metadata: Metadata = {
  title: "Arcade Lounge",
  description:
    "A small back-room of slot games for players who want a break from today's puzzles. Play money only — no leaderboard, no streak.",
};

export const dynamic = "force-static";

export default function SlotsIndexPage() {
  return (
    <ArcadeShell>
      <section className="space-y-6">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">
            arcade lounge
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            slot machines.
          </h1>
          <p className="text-base text-[var(--color-fg-muted)] max-w-md">
            Off-streak entertainment with play-money credits. No leaderboards. No share grids.
            Reset your balance any time. Today&apos;s puzzles are{" "}
            <Link href="/" className="underline hover:text-[var(--color-fg)]">over here</Link>.
          </p>
        </header>

        <ul className="grid gap-3 sm:gap-4">
          <li>
            <Link
              href="/slots/tideforge-pearls"
              className="group block rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-tide-deep p-5 sm:p-6 transition-all hover:border-[#a86bff]/60 focus-visible:border-[#a86bff]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#e8c8ff]/80 font-mono">
                    1,024 ways · maritime
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                    Tideforge <span className="text-[#a86bff]">Pearls</span>
                  </h2>
                  <p className="text-sm text-[var(--color-fg-muted)] max-w-md">
                    Storm-forged pearls collect in the trench. Free-spin bonus with a
                    progressive collection meter and ×2/×3 multiplier wilds. High volatility.
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="hidden sm:grid place-items-center w-14 h-14 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #ffffff 0%, #e8c8ff 30%, #a86bff 70%, #5b2eaa 100%)",
                    boxShadow: "0 0 20px rgba(180, 130, 255, 0.45)",
                  }}
                />
              </div>
              <p className="mt-4 text-xs font-mono text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition-colors">
                play →
              </p>
            </Link>
          </li>

          <li>
            <div
              className="block rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] p-5 sm:p-6 opacity-70"
              aria-disabled="true"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-fg-dim)] font-mono">
                board adventure · coming soon
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-2">
                Thornwood <span className="text-[var(--color-fg-muted)]">Path</span>
              </h2>
              <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-md">
                A token traverses an enchanted forest map. Three metamorphic meters reshape each
                bonus run. The Hollow holds and spins; the Old Oak crowns the wheel. Coming after
                Tideforge Pearls is well-tested.
              </p>
              <p className="mt-4 text-xs font-mono text-[var(--color-fg-dim)]">
                pending
              </p>
            </div>
          </li>
        </ul>

        <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] p-4 text-sm text-[var(--color-fg-muted)] font-mono">
          <strong className="text-[var(--color-fg)] not-italic">play money only.</strong>{" "}
          Credits live in this browser, reset whenever you want, and never sync, share, or rank.
        </div>
      </section>
    </ArcadeShell>
  );
}
