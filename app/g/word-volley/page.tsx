import { ArcadeShell } from "@/components/arcade-shell";
import { seedForToday } from "@/lib/seed";
import { utcDateString } from "@/lib/utils";
import { env } from "@/lib/env";
import { WordVolley } from "./word-volley-client";

export const metadata = { title: "Word Volley" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  // Server only: get today's target and pass it to the client.
  // This is a deliberate disclosure: the daily target is the same for everyone,
  // and once revealed in the client the server still validates submissions.
  const seed = seedForToday();
  const date = utcDateString();
  // Read Turnstile site key server-side (env is server-only) and pass as a
  // prop. The site key is public; we keep this indirection to avoid
  // importing `lib/env` in any client component. ADR-1, 2026-04-30.
  const turnstileSiteKey = env.turnstileSiteKey;
  return (
    <ArcadeShell>
      <ChallengeAwait searchParams={searchParams}>
        {(from) => (
          <WordVolley
            target={seed.wordVolley.target}
            date={date}
            initialHandle={from ?? undefined}
            turnstileSiteKey={turnstileSiteKey}
          />
        )}
      </ChallengeAwait>
    </ArcadeShell>
  );
}

async function ChallengeAwait({
  searchParams,
  children,
}: {
  searchParams: Promise<{ from?: string }>;
  children: (from: string | null) => React.ReactNode;
}) {
  const sp = await searchParams;
  const fromRaw = sp.from ?? null;
  // sanitize 'from' against handle rules client-side; permissive on server
  const from = fromRaw && /^[A-Za-z0-9_]{3,12}$/.test(fromRaw) ? fromRaw : null;
  return <>{children(from)}</>;
}
