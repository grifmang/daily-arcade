import { ArcadeShell } from "@/components/arcade-shell";
import { seedForToday } from "@/lib/seed";
import { utcDateString } from "@/lib/utils";
import { env } from "@/lib/env";
import { Drift2049 } from "./drift-2049-client";

export const metadata = { title: "Drift 2049" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const seed = seedForToday();
  const date = utcDateString();
  const sp = await searchParams;
  const from = sp.from && /^[A-Za-z0-9_]{3,12}$/.test(sp.from) ? sp.from : null;
  return (
    <ArcadeShell>
      <Drift2049
        initialBoard={seed.drift2049.initialBoard}
        date={date}
        initialHandle={from ?? undefined}
        turnstileSiteKey={env.turnstileSiteKey}
      />
    </ArcadeShell>
  );
}
