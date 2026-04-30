/**
 * Routing Middleware (Next.js 16 calls this `proxy.ts`).
 * Sets security headers per THREAT_MODEL.md §P3.4 (Pass 3, post-Netlify pivot).
 *
 * On Netlify, this file is auto-compiled into a Netlify Edge Function by the
 * OpenNext adapter (@netlify/plugin-nextjs). No code changes are required for
 * the platform swap; only the CSP origins are updated:
 *  - dropped: va.vercel-scripts.com, vitals.vercel-insights.com (Vercel-only)
 *  - added: https://challenges.cloudflare.com (Turnstile widget script + iframe)
 * See DECISIONS.md ADR-1 and ADR-5 (2026-04-30).
 */
import { NextResponse, type NextRequest } from "next/server";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function proxy(req: NextRequest) {
  void req;
  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export const config = {
  matcher: [
    // Skip static, og, _next; cover everything else.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js).*)",
  ],
};

// Backwards-compatible export name expected by older Next.js versions.
export { proxy as middleware };
