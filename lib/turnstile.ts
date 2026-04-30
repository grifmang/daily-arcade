/**
 * Cloudflare Turnstile server-side token verifier.
 *
 * See DECISIONS.md ADR-1 (2026-04-30) and THREAT_MODEL.md §P3.6 for the
 * design contract. Critical invariants enforced here:
 *  - Module is `import "server-only"`. The secret key MUST NOT reach the
 *    browser bundle.
 *  - Fail-closed on any non-success outcome (network error, timeout >10s,
 *    non-200, JSON parse failure, hostname mismatch). There is no "graceful
 *    degradation" path that returns ok=true on error — see R11 in the
 *    threat model.
 *  - The token is single-use; we do not maintain a local nonce store
 *    because Cloudflare returns `timeout-or-duplicate` on reuse and we
 *    surface that as a fail-closed reject.
 *  - We deliberately do not send `remoteip` to siteverify — our privacy
 *    posture says we don't share raw IPs with third parties (we only keep
 *    daily-salted IP hashes for rate-limit dedup).
 *  - The token itself is never logged. Only verdict + error codes.
 */
import "server-only";
import { env } from "./env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 10_000;

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; codes: string[] };

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

/**
 * Resolve the expected hostname for response validation.
 *
 * On Netlify, `process.env.URL` holds the canonical site URL for the
 * current deploy context (production, deploy-preview, branch-deploy).
 * In local dev, it's typically unset; we skip hostname validation in
 * non-production to keep `netlify dev` and `npm run dev` workable.
 */
function expectedHostname(): string | null {
  if (env.isDev) return null;
  const raw = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/**
 * Verify a Turnstile token server-side.
 *
 * Returns `{ ok: true }` only when:
 *  - HTTP request to siteverify completed within {@link TIMEOUT_MS}
 *  - Response is HTTP 200 with parseable JSON
 *  - `success` is `true`
 *  - When in production with a known hostname: response `hostname` matches
 *
 * Any other outcome returns `{ ok: false, codes }`. `codes` carries
 * Cloudflare's `error-codes` array when present, plus internal codes:
 *  - `internal-empty-token` — caller passed empty string
 *  - `internal-timeout` — request did not complete within TIMEOUT_MS
 *  - `internal-network-error` — fetch threw / non-AbortError
 *  - `internal-non-200` — siteverify returned non-200
 *  - `internal-bad-json` — response body was not valid JSON
 *  - `internal-hostname-mismatch` — response.hostname did not match deploy
 */
export async function verifyTurnstile(token: string): Promise<TurnstileVerifyResult> {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, codes: ["internal-empty-token"] };
  }
  if (token.length > 2048) {
    return { ok: false, codes: ["internal-token-too-long"] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.turnstileSecretKey,
        response: token,
        // remoteip deliberately omitted — see file header.
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, codes: ["internal-timeout"] };
    }
    return { ok: false, codes: ["internal-network-error"] };
  }
  clearTimeout(timer);

  if (!response.ok) {
    return { ok: false, codes: ["internal-non-200"] };
  }

  let body: SiteverifyResponse;
  try {
    body = (await response.json()) as SiteverifyResponse;
  } catch {
    return { ok: false, codes: ["internal-bad-json"] };
  }

  if (!body.success) {
    return { ok: false, codes: body["error-codes"] ?? ["unknown"] };
  }

  const expected = expectedHostname();
  if (expected && body.hostname && body.hostname !== expected) {
    return { ok: false, codes: ["internal-hostname-mismatch"] };
  }

  return { ok: true };
}
