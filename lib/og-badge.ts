/**
 * OG-image rank/percentile badge cascade.
 *
 * Pure function over the submit-time snapshot. Five-tier first-match
 * cascade, asymmetric (only shows a badge when the result is shareable).
 * See docs/superpowers/specs/2026-04-30-arcade-polish-design.md Feature 2.
 */

export type BadgeTier = "hero" | "prominent-accent" | "prominent" | "plain";

export interface BadgeInput {
  rankAtSubmit?: number | null;
  totalAtSubmit?: number | null;
}

export interface BadgeOutput {
  text: string | null;
  tier: BadgeTier | null;
}

const NO_BADGE: BadgeOutput = { text: null, tier: null };

export function computeBadge(input: BadgeInput): BadgeOutput {
  const rank = input.rankAtSubmit;
  const total = input.totalAtSubmit;

  // Backwards compat + defensive guards
  if (rank == null || total == null) return NO_BADGE;
  if (rank <= 0 || total <= 0) return NO_BADGE;

  // 1: hero TOP 1% (rank 1 in a real-sized field)
  if (rank === 1 && total >= 50) {
    return { text: "TOP 1%", tier: "hero" };
  }

  const percentile = rank / total;

  // 2: prominent-accent TOP 5%
  if (percentile <= 0.05) {
    return { text: "TOP 5%", tier: "prominent-accent" };
  }

  // 3: prominent TOP 10%
  if (percentile <= 0.10) {
    return { text: "TOP 10%", tier: "prominent" };
  }

  // 4: plain RANK #N if within top 25% AND top 100
  const cap = Math.min(100, Math.ceil(total * 0.25));
  if (rank <= cap) {
    return { text: `RANK #${rank}`, tier: "plain" };
  }

  // 5: nothing (asymmetric: don't shame people for finishing)
  return NO_BADGE;
}
