import { ArcadeShell } from "@/components/arcade-shell";
import { seedForToday } from "@/lib/seed";
import { utcDateString } from "@/lib/utils";
import { env } from "@/lib/env";
import { publicTriviaQuestion } from "@/lib/content/trivia";
import { SnapTrivia } from "./snap-trivia-client";

export const metadata = { title: "Snap Trivia" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const seed = seedForToday();
  const date = utcDateString();
  const questions = seed.snapTrivia.questionIds.map(publicTriviaQuestion).filter((q): q is NonNullable<typeof q> => !!q);
  const sp = await searchParams;
  const from = sp.from && /^[A-Za-z0-9_]{3,12}$/.test(sp.from) ? sp.from : null;
  return (
    <ArcadeShell>
      <SnapTrivia
        questions={questions}
        date={date}
        initialHandle={from ?? undefined}
        turnstileSiteKey={env.turnstileSiteKey}
      />
    </ArcadeShell>
  );
}
