/**
 * HMAC-SHA256 signing for share / OG URLs.
 * Constant-time comparison via Web Crypto SubtleCrypto.
 * Key-id versioning: payload includes "v1." prefix so secret rotation is forward-compatible.
 *
 * Server-only because of the secret dependency. `sharePayload` lives in `share-payload.ts`
 * for test reuse without server-only constraints.
 */
import "server-only";
import { env } from "./env";
export { sharePayload } from "./share-payload";

const KEY_ID = "v1";

async function getKey(secretHex: string): Promise<CryptoKey> {
  const bytes = hexToBytes(secretHex);
  // Copy into a fresh ArrayBuffer to satisfy strict BufferSource types.
  const buf = bytes.slice().buffer;
  return crypto.subtle.importKey(
    "raw",
    buf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function sign(payload: string): Promise<string> {
  const key = await getKey(env.shareSigningSecret);
  const data = new TextEncoder().encode(payload);
  const sigBuf = await crypto.subtle.sign("HMAC", key, data);
  return `${KEY_ID}.${bytesToHex(new Uint8Array(sigBuf))}`;
}

export async function verify(payload: string, signature: string | null | undefined): Promise<boolean> {
  if (!signature || typeof signature !== "string") return false;
  const dot = signature.indexOf(".");
  if (dot === -1) return false;
  const keyId = signature.slice(0, dot);
  const sigHex = signature.slice(dot + 1);
  if (keyId !== KEY_ID) return false;
  if (!/^[0-9a-f]+$/i.test(sigHex)) return false;
  const key = await getKey(env.shareSigningSecret);
  const sig = hexToBytes(sigHex).slice().buffer;
  const data = new TextEncoder().encode(payload);
  return crypto.subtle.verify("HMAC", key, sig, data);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex length not even");
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, "0");
  }
  return s;
}
