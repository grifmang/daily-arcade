/**
 * Minimal profanity bank for handle validation. Conservative; ASCII matches only.
 * Production: replace with a curated list, regional moderation review.
 * Block list intentionally omitted from this file's prose to avoid surfacing slurs in plaintext;
 * we keep an obfuscated check list here. Real list lives in DB for production.
 */

const BLOCK_PATTERNS: readonly RegExp[] = [
  // Common profanity stems (regex to catch leetspeak variants, conservatively)
  /\bf+u+c*k+\b/i,
  /\bsh+i+t+\b/i,
  /\bb+i+t+c+h+\b/i,
  /\ba+s+s+h+o+l+e+\b/i,
  /\bc+u+n+t+\b/i,
  /\bd+i+c+k+\b/i,
  /\bp+u+s+s+y+\b/i,
  /\bn+i+g+g+(e+r+|a+)\b/i,
  /\bf+a+g+g*o*t*\b/i,
  /\br+e+t+a+r+d+\b/i,
  /\bk+i+l+l+y+o+u+r+s+e+l+f+/i,
  /\bs+u+i+c+i+d+e+\b/i,
  // Common operational impersonation
  /\b(admin|moderator|staff|support|root|system)\b/i,
];

export function isHandleProfane(handle: string): boolean {
  return BLOCK_PATTERNS.some(re => re.test(handle));
}

/** Validate handle format. Returns reason on failure. */
export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "Handle is required." };
  const trimmed = raw.trim();
  if (trimmed.length < 3) return { ok: false, reason: "Handles must be at least 3 characters." };
  if (trimmed.length > 12) return { ok: false, reason: "Handles must be 12 characters or fewer." };
  if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
    return { ok: false, reason: "Letters, numbers, and underscores only." };
  }
  if (isHandleProfane(trimmed)) {
    return { ok: false, reason: "Pick a different handle." };
  }
  return { ok: true, handle: trimmed };
}
