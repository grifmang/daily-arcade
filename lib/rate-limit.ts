import "server-only";
import { store } from "./store";
import { env } from "./env";

/** Daily rolling salt: HMAC(IP_HASH_SALT_BASE, dateString). */
async function dailySalt(date: string): Promise<string> {
  const enc = new TextEncoder();
  const baseBytes = enc.encode(env.ipHashSaltBase);
  const key = await crypto.subtle.importKey("raw", baseBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(date));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hashIp(ip: string, date: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = await dailySalt(date);
  const data = enc.encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export async function rateLimit(opts: {
  bucket: string;
  ipHash: string;
  windowMs: number;
  max: number;
}): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const key = `${opts.bucket}:${opts.ipHash}`;
  const { count, resetAt } = await store().bumpRate(key, opts.windowMs);
  return { ok: count <= opts.max, remaining: Math.max(0, opts.max - count), resetAt };
}
