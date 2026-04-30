/**
 * Netlify Scheduled Function — daily seed warming.
 *
 * Runs at 00:00 UTC every day (schedule declared in netlify.toml). Calls the
 * existing /api/cron/daily-warm Route Handler with bearer auth. The route
 * handler is the unattended path's source of truth and remains
 * manually-invokeable for incident response (curl with bearer).
 *
 * See DECISIONS.md ADR-2 (2026-04-30) for the rationale of inverting this
 * pattern (scheduler-calls-route-handler) vs. moving warming logic into
 * the function directly.
 *
 * Note (Netlify Scheduled Functions limitation): scheduled functions only
 * run on published deploys, not on Deploy Previews or branch deploys.
 * They also don't accept payloads, so the Route Handler is GET, not POST.
 *
 * Environment:
 *  - URL: Netlify-provided canonical site URL (e.g. https://daily-arcade.netlify.app)
 *  - CRON_SECRET: bearer expected by /api/cron/daily-warm
 */
import type { Config } from "@netlify/functions";

const handler = async (req: Request) => {
  const next_run = await req.json().catch(() => ({})).then(
    (b: { next_run?: string }) => b.next_run ?? "(unknown)",
  );

  const baseUrl = process.env.URL ?? process.env.DEPLOY_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl) {
    console.error("[daily-warm] URL env not set; cannot reach route handler");
    return new Response("missing URL env", { status: 500 });
  }
  if (!cronSecret) {
    console.error("[daily-warm] CRON_SECRET not set; cannot authenticate");
    return new Response("missing CRON_SECRET env", { status: 500 });
  }

  const target = `${baseUrl.replace(/\/$/, "")}/api/cron/daily-warm`;
  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(target, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
  } catch (err) {
    console.error("[daily-warm] fetch failed", { target, err: String(err) });
    return new Response("fetch failed", { status: 502 });
  }

  const durationMs = Date.now() - start;
  if (!res.ok) {
    console.error("[daily-warm] route handler returned non-2xx", {
      status: res.status,
      durationMs,
      next_run,
    });
    return new Response(`route handler ${res.status}`, { status: 502 });
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* body parsing optional */
  }

  console.log("[daily-warm] ok", { durationMs, next_run, body });
  return new Response("ok", { status: 200 });
};

export default handler;

export const config: Config = {
  schedule: "0 0 * * *",
};
