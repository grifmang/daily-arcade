// RNG contract and implementations for Tideforge Pearls.
// Spec: docs/superpowers/specs/slots-tideforge-pearls.md section 7

export interface SlotRng {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an unbiased integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

// ---------------------------------------------------------------------------
// xoshiro256** — seedable, deterministic. Used by tests and the Monte Carlo
// simulation harness. Same algorithm family as lib/seed.ts (the daily-puzzle
// PRNG) but a separate, isolated instance — slots and daily puzzles never
// share a PRNG.
// ---------------------------------------------------------------------------

const U64 = 0xFFFFFFFFFFFFFFFFn;

function rotl(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & U64;
}

// Splitmix64 — used to seed xoshiro256**'s 256-bit state from a single u64.
function splitmix64(x: bigint): [bigint, bigint] {
  const next = (x + 0x9E3779B97F4A7C15n) & U64;
  let z = next;
  z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & U64;
  z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & U64;
  z = z ^ (z >> 31n);
  return [next, z];
}

export function createSeededRng(seed: bigint | number): SlotRng {
  let s0: bigint, s1: bigint, s2: bigint, s3: bigint;
  let x = (typeof seed === "bigint" ? seed : BigInt(seed)) & U64;
  let z: bigint;
  [x, z] = splitmix64(x); s0 = z;
  [x, z] = splitmix64(x); s1 = z;
  [x, z] = splitmix64(x); s2 = z;
  [x, z] = splitmix64(x); s3 = z;

  function nextU64(): bigint {
    const result = (rotl((s1 * 5n) & U64, 7n) * 9n) & U64;
    const t = (s1 << 17n) & U64;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 45n);
    return result;
  }

  return {
    next(): number {
      // Top 53 bits give a uniformly distributed double in [0, 1).
      return Number(nextU64() >> 11n) / 9007199254740992;
    },
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
        throw new Error(`nextInt: maxExclusive must be a positive integer (got ${maxExclusive})`);
      }
      const max = BigInt(maxExclusive);
      // Unbiased rejection sampling.
      const limit = (1n << 64n) - ((1n << 64n) % max);
      let v: bigint;
      do {
        v = nextU64();
      } while (v >= limit);
      return Number(v % max);
    },
  };
}

// ---------------------------------------------------------------------------
// Production runtime RNG — wraps crypto.getRandomValues for high-entropy
// per-spin outcomes. Per ADR-S5 (DECISIONS.md 2026-05-01), slots do NOT
// consume the daily seed engine; this RNG is fresh per spin.
// ---------------------------------------------------------------------------

export function createCryptoRng(): SlotRng {
  // We pull a buffer of u32s and burn through it. Top up when exhausted.
  const POOL_SIZE = 64;
  const pool = new Uint32Array(POOL_SIZE);
  let cursor = POOL_SIZE; // start exhausted to force first refill

  function refill(): void {
    crypto.getRandomValues(pool);
    cursor = 0;
  }

  function nextU32(): number {
    if (cursor >= POOL_SIZE) refill();
    return pool[cursor++]!;
  }

  return {
    next(): number {
      // Combine two u32s into a 53-bit double for full precision in [0, 1).
      const a = nextU32() >>> 5; // 27 bits
      const b = nextU32() >>> 6; // 26 bits
      return (a * 0x4000000 + b) / 0x20000000000000;
    },
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
        throw new Error(`nextInt: maxExclusive must be a positive integer (got ${maxExclusive})`);
      }
      // Trivial case.
      if (maxExclusive === 1) return 0;
      // Unbiased rejection sampling on u32.
      // CAREFUL: do NOT apply `>>> 0` to `limit`. When `0x100000000 % max === 0`
      // (i.e. max is a power of 2 like 2, 4, 8, 16, 32, ...), `limit` would be
      // exactly 2^32, which `>>> 0` truncates to 0 — making `v >= limit` always
      // true and the loop infinite. The Tideforge call sites only use nextInt(60)
      // so they never trip this in practice, but the bug was latent here and
      // would surface if any consumer called with a power-of-2 size.
      const max = maxExclusive >>> 0;
      const limit = 0x100000000 - (0x100000000 % max);
      let v: number;
      do {
        v = nextU32();
      } while (v >= limit);
      return v % max;
    },
  };
}
