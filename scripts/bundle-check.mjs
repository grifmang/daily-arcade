#!/usr/bin/env node
/**
 * Bundle-check: scans the production client bundle for forbidden literals.
 *
 * Currently asserts that no client-bundled JS file contains the literal
 * `TURNSTILE_SECRET_KEY`. The Turnstile secret key is server-only; if it
 * ever appears in a client chunk, the build must fail.
 *
 * See THREAT_MODEL.md §P3.6 (R13) and DECISIONS.md ADR-1 (2026-04-30).
 *
 * Run after `next build`; exits 0 if clean, 1 if any forbidden literal is
 * present.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = ".next/static";
const FORBIDDEN = ["TURNSTILE_SECRET_KEY"];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`[bundle:check] '${dir}' does not exist. Run \`next build\` first.`);
      process.exit(1);
    }
    throw err;
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    const s = await stat(p);
    if (s.isDirectory()) yield* walk(p);
    else if (s.isFile()) yield p;
  }
}

let violations = 0;
for await (const file of walk(ROOT)) {
  if (!/\.(js|mjs|cjs|css|map)$/.test(file)) continue;
  const content = await readFile(file, "utf8");
  for (const literal of FORBIDDEN) {
    if (content.includes(literal)) {
      console.error(`[bundle:check] FORBIDDEN literal "${literal}" found in ${file}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`[bundle:check] FAIL — ${violations} violation(s) detected.`);
  process.exit(1);
}
console.log("[bundle:check] ok — no forbidden literals in client bundle.");
