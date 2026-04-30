/**
 * Server-only environment access. Never import from client components.
 * Falls back to development defaults so previews boot without provisioning.
 *
 * Turnstile note (DECISIONS.md ADR-1, 2026-04-30): in NODE_ENV !== "production",
 * the Turnstile site/secret keys default to Cloudflare's published always-pass
 * test keys so dev + Netlify deploy previews work without project-specific
 * keys. Production must set both via `netlify env:set`.
 *
 * The site key is *public* (it's embedded in the client HTML). To keep this
 * module server-only, server components must read `env.turnstileSiteKey` and
 * pass it as a prop to client components — do not import `env` into client
 * code.
 */
import "server-only";

const dev = process.env.NODE_ENV !== "production";

function devDefault(name: string, value: string): string {
  if (dev && !process.env[name]) {
    console.warn(`[env] ${name} unset; using insecure development default.`);
  }
  return process.env[name] ?? value;
}

// Cloudflare-published always-pass test keys for Turnstile.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export const env = {
  isDev: dev,
  databaseUrl: process.env.DATABASE_URL ?? "",
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? "",
  shareSigningSecret: devDefault(
    "SHARE_SIGNING_SECRET",
    "0".repeat(64) /* dev-only; production deploy verifies this is set */,
  ),
  cronSecret: devDefault("CRON_SECRET", "dev-cron-secret"),
  ipHashSaltBase: devDefault(
    "IP_HASH_SALT_BASE",
    "1".repeat(64) /* dev-only */,
  ),
  turnstileSiteKey: devDefault("TURNSTILE_SITE_KEY", TURNSTILE_TEST_SITE_KEY),
  turnstileSecretKey: devDefault("TURNSTILE_SECRET_KEY", TURNSTILE_TEST_SECRET_KEY),
};

export function assertProductionEnv(): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.SHARE_SIGNING_SECRET) missing.push("SHARE_SIGNING_SECRET");
  if (!process.env.CRON_SECRET) missing.push("CRON_SECRET");
  if (!process.env.IP_HASH_SALT_BASE) missing.push("IP_HASH_SALT_BASE");
  if (!process.env.TURNSTILE_SITE_KEY) missing.push("TURNSTILE_SITE_KEY");
  if (!process.env.TURNSTILE_SECRET_KEY) missing.push("TURNSTILE_SECRET_KEY");
  return missing.length ? { ok: false, missing } : { ok: true };
}
