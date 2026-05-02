import type { Metadata } from "next";
import { ArcadeShell } from "@/components/arcade-shell";
import { TideforgePearls } from "./tideforge-client";

export const metadata: Metadata = {
  title: "Tideforge Pearls",
  description:
    "A maritime-themed slot machine with a 1,024-ways bonus chase. Play money. No leaderboard, no streak — just a small entertainment escape from today's puzzles.",
};

// Static prerender: the slot has no per-day or per-user server state.
// The client island handles everything (RNG, credits, animations).
export const dynamic = "force-static";

export default function Page() {
  return (
    <ArcadeShell>
      <TideforgePearls />
    </ArcadeShell>
  );
}
