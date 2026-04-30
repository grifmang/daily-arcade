import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { buildDailySeed } from "@/lib/seed";
import { utcDateString } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily warming. Idempotent.
 *  - Pre-builds today's and the next 6 days' seeds (no DB write needed in the
 *    InMemoryStore world; the seeds are deterministic and computed on demand).
 *    When we move to PostgresStore, this will INSERT...ON CONFLICT DO NOTHING.
 *  - Auth: bearer `CRON_SECRET` only. The legitimate scheduled caller is
 *    netlify/functions/daily-warm.mts which supplies the bearer. See
 *    DECISIONS.md ADR-2 (2026-04-30) — the previous `x-vercel-cron` alt-auth
 *    branch was dropped during the Netlify pivot.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expectedBearer = `Bearer ${env.cronSecret}`;
  if (auth !== expectedBearer) {
    return new NextResponse(null, { status: 401 });
  }

  const start = Date.now();
  const today = utcDateString();
  const days: string[] = [];
  const ms24 = 24 * 60 * 60 * 1000;
  const baseTs = Date.parse(today + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseTs + i * ms24);
    const ds = utcDateString(d);
    buildDailySeed(ds); // pure compute; dropped (cached implicitly elsewhere)
    days.push(ds);
  }

  return NextResponse.json({
    ok: true,
    generatedSeeds: days,
    durationMs: Date.now() - start,
  });
}
