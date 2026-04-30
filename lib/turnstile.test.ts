/**
 * Tests for the Turnstile server-side verifier.
 *
 * Covers the gate list in THREAT_MODEL.md §P3.6:
 *  - success → ok: true
 *  - invalid token (success: false from siteverify)
 *  - timeout (10s AbortController) → fail-closed
 *  - non-200 → fail-closed
 *  - timeout-or-duplicate (Cloudflare error code) → fail-closed
 *  - hostname mismatch in production → fail-closed
 *
 * Plus internal sanity:
 *  - empty token rejected without network call
 *  - bad JSON body → fail-closed
 *  - network error → fail-closed
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Stub server-only so we can import the module under test.
vi.mock("server-only", () => ({}));

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface MockResponseInit {
  ok?: boolean;
  status?: number;
  body?: unknown;
}

function mockFetchOnce(response: MockResponseInit): void {
  const fakeRes = {
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  } as unknown as Response;
  globalThis.fetch = vi.fn(async () => fakeRes) as unknown as typeof fetch;
}

beforeEach(() => {
  // Default to dev so hostname check is skipped unless a test overrides.
  // (NODE_ENV is read-only in some TS configs; mutate via Object assign.)
  Object.assign(process.env, { NODE_ENV: "test" });
  delete process.env.URL;
  delete process.env.DEPLOY_PRIME_URL;
  // env.ts caches values on import; tests dynamic-import below to refresh.
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyTurnstile — happy path", () => {
  it("returns ok:true on successful siteverify response", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      body: { success: true, hostname: "daily-arcade.netlify.app" },
    });
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("good-token");
    expect(res).toEqual({ ok: true });
  });
});

describe("verifyTurnstile — input validation", () => {
  it("rejects empty token without making a network call", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("");
    expect(res).toEqual({ ok: false, codes: ["internal-empty-token"] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects oversized token without making a network call", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("x".repeat(2049));
    expect(res).toEqual({ ok: false, codes: ["internal-token-too-long"] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("verifyTurnstile — fail-closed paths", () => {
  it("fails closed on success:false (invalid token)", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      body: { success: false, "error-codes": ["invalid-input-response"] },
    });
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("bad-token");
    expect(res).toEqual({ ok: false, codes: ["invalid-input-response"] });
  });

  it("fails closed on timeout-or-duplicate (single-use enforcement)", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      body: { success: false, "error-codes": ["timeout-or-duplicate"] },
    });
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("reused-token");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.codes).toContain("timeout-or-duplicate");
  });

  it("fails closed on non-200 response", async () => {
    mockFetchOnce({ ok: false, status: 500, body: {} });
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("token");
    expect(res).toEqual({ ok: false, codes: ["internal-non-200"] });
  });

  it("fails closed when fetch throws (network error)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("token");
    expect(res).toEqual({ ok: false, codes: ["internal-network-error"] });
  });

  it("fails closed when fetch is aborted (timeout)", async () => {
    globalThis.fetch = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("token");
    expect(res).toEqual({ ok: false, codes: ["internal-timeout"] });
  });

  it("fails closed when response body is not JSON", async () => {
    const fakeRes = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response;
    globalThis.fetch = vi.fn(async () => fakeRes) as unknown as typeof fetch;
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("token");
    expect(res).toEqual({ ok: false, codes: ["internal-bad-json"] });
  });

  it("fails closed on hostname mismatch in production", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.URL = "https://daily-arcade.netlify.app";
    // Provide required prod env so env.ts doesn't bail.
    process.env.SHARE_SIGNING_SECRET = "0".repeat(64);
    process.env.IP_HASH_SALT_BASE = "1".repeat(64);
    process.env.CRON_SECRET = "x";
    process.env.TURNSTILE_SITE_KEY = "k";
    process.env.TURNSTILE_SECRET_KEY = "s";

    mockFetchOnce({
      ok: true,
      status: 200,
      body: { success: true, hostname: "evil.example.com" },
    });
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("token-from-evil");
    expect(res).toEqual({ ok: false, codes: ["internal-hostname-mismatch"] });
  });

  it("does not enforce hostname check in non-production", async () => {
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.URL = "https://something-else.example.com";
    mockFetchOnce({
      ok: true,
      status: 200,
      body: { success: true, hostname: "anywhere.example.com" },
    });
    const { verifyTurnstile } = await import("./turnstile");
    const res = await verifyTurnstile("token");
    expect(res).toEqual({ ok: true });
  });
});

describe("verifyTurnstile — outbound request shape", () => {
  it("posts secret + token, omits remoteip, targets the correct URL", async () => {
    const recorded: Array<[string, RequestInit]> = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      recorded.push([String(url), init ?? {}]);
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const { verifyTurnstile } = await import("./turnstile");
    await verifyTurnstile("the-token");
    expect(recorded).toHaveLength(1);
    const [url, init] = recorded[0]!;
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toHaveProperty("secret");
    expect(body).toHaveProperty("response", "the-token");
    expect(body).not.toHaveProperty("remoteip"); // privacy posture
  });
});
