/**
 * xoshiro256** PRNG. Pure, seedable, fast.
 * Reference: https://prng.di.unimi.it/xoshiro256starstar.c
 *
 * State is four BigInt 64-bit integers. We expose a numeric `next()` that
 * returns a uniform double in [0, 1) for ease of use in game logic, and a
 * `nextInt(n)` helper that returns a uniform integer in [0, n).
 */

const MASK64 = (1n << 64n) - 1n;

function rotl64(x: bigint, k: number): bigint {
  return ((x << BigInt(k)) | (x >> BigInt(64 - k))) & MASK64;
}

function splitmix64(seed: bigint): bigint {
  let z = (seed + 0x9e3779b97f4a7c15n) & MASK64;
  z = (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n & MASK64;
  z = (z ^ (z >> 27n)) * 0x94d049bb133111ebn & MASK64;
  return z ^ (z >> 31n);
}

export type PRNGState = [bigint, bigint, bigint, bigint];

export function seedState(seed: bigint): PRNGState {
  let s = seed;
  const a = (s = splitmix64(s));
  const b = (s = splitmix64(s));
  const c = (s = splitmix64(s));
  const d = splitmix64(s);
  return [a, b, c, d];
}

export class XoShiRo {
  private s: PRNGState;
  constructor(state: PRNGState) {
    this.s = [...state] as PRNGState;
  }
  /** Raw 64-bit unsigned BigInt. */
  next64(): bigint {
    const [s0, s1, s2, s3] = this.s;
    const result = (rotl64(s1 * 5n & MASK64, 7) * 9n) & MASK64;
    const t = (s1 << 17n) & MASK64;
    const n0 = s0 ^ s2;
    const n1 = s1 ^ s3;
    let n2 = s2 ^ t;
    let n3 = s3 ^ n0;
    n2 = n2 ^ ((s0 << 0n) & MASK64); // no-op for clarity
    n3 = rotl64(n3, 45);
    this.s = [n0, n1, n2, n3];
    return result;
  }
  /** Uniform double in [0, 1). 53 bits of precision. */
  next(): number {
    const v = this.next64() >> 11n; // top 53 bits
    return Number(v) / 2 ** 53;
  }
  /** Uniform integer in [0, n). */
  nextInt(n: number): number {
    if (n <= 0 || !Number.isFinite(n)) throw new Error("nextInt: n must be positive");
    return Math.floor(this.next() * n);
  }
  /** Fisher–Yates shuffle of an array (in place). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }
  /** Pick one element uniformly at random. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick: empty array");
    return arr[this.nextInt(arr.length)]!;
  }
}

/** Build a deterministic PRNG from a date string + secret salt. */
export function prngForDate(date: string, salt: string): XoShiRo {
  // Hash salt+date into a 64-bit BigInt seed using a simple FNV-1a-ish mix.
  // No crypto required: we just need determinism and avalanche.
  const input = `${salt}|${date}`;
  let h = 0xcbf29ce484222325n; // FNV offset basis (64-bit)
  const FNV_PRIME = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    h = (h ^ BigInt(input.charCodeAt(i))) & MASK64;
    h = (h * FNV_PRIME) & MASK64;
  }
  return new XoShiRo(seedState(h));
}
