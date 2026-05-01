import { describe, it, expect } from "vitest";
import { computeBadge } from "./og-badge";

describe("computeBadge", () => {
  it("returns hero TOP 1% when rank=1 and total>=50", () => {
    expect(computeBadge({ rankAtSubmit: 1, totalAtSubmit: 50 })).toEqual({ text: "TOP 1%", tier: "hero" });
    expect(computeBadge({ rankAtSubmit: 1, totalAtSubmit: 1000 })).toEqual({ text: "TOP 1%", tier: "hero" });
  });

  it("falls through to TOP 5% when rank=1 but total<50", () => {
    // 1/30 = 0.033 → top 5%. Not eligible for the hero tier (total < 50).
    expect(computeBadge({ rankAtSubmit: 1, totalAtSubmit: 30 })).toEqual({ text: "TOP 5%", tier: "prominent-accent" });
  });

  it("returns TOP 5% when percentile <= 0.05 and not in TOP 1% tier", () => {
    expect(computeBadge({ rankAtSubmit: 5, totalAtSubmit: 100 })).toEqual({ text: "TOP 5%", tier: "prominent-accent" });
    expect(computeBadge({ rankAtSubmit: 50, totalAtSubmit: 1000 })).toEqual({ text: "TOP 5%", tier: "prominent-accent" });
  });

  it("returns TOP 10% when percentile <= 0.10 and not above tier", () => {
    expect(computeBadge({ rankAtSubmit: 10, totalAtSubmit: 100 })).toEqual({ text: "TOP 10%", tier: "prominent" });
    expect(computeBadge({ rankAtSubmit: 100, totalAtSubmit: 1000 })).toEqual({ text: "TOP 10%", tier: "prominent" });
  });

  it("returns RANK #N when below 10% but within min(100, ceil(total*0.25))", () => {
    // total=200, ceil(200*0.25)=50, min(100,50)=50.
    // rank=21 → 21/200=0.105 (> 0.10, not TOP 10%), 21<=50, qualifies.
    expect(computeBadge({ rankAtSubmit: 21, totalAtSubmit: 200 })).toEqual({ text: "RANK #21", tier: "plain" });
    // total=500, ceil(500*0.25)=125, min(100,125)=100.
    // rank=80 → 80/500=0.16 (> 0.10), 80<=100, qualifies.
    expect(computeBadge({ rankAtSubmit: 80, totalAtSubmit: 500 })).toEqual({ text: "RANK #80", tier: "plain" });
  });

  it("clamps the RANK #N tier to top 25% AND top 100", () => {
    // total=60 → ceil(60*0.25)=15 → only top 15 see RANK #N. Rank 20 of 60 → no badge.
    expect(computeBadge({ rankAtSubmit: 20, totalAtSubmit: 60 })).toEqual({ text: null, tier: null });
    // total=1000 → ceil*0.25=250 but min with 100 caps. Rank 150 of 1000 → no badge (above 100).
    expect(computeBadge({ rankAtSubmit: 150, totalAtSubmit: 1000 })).toEqual({ text: null, tier: null });
  });

  it("returns no badge when rankAtSubmit or totalAtSubmit is null/undefined (backwards compat)", () => {
    expect(computeBadge({ rankAtSubmit: null, totalAtSubmit: null })).toEqual({ text: null, tier: null });
    expect(computeBadge({ rankAtSubmit: 5, totalAtSubmit: null })).toEqual({ text: null, tier: null });
    expect(computeBadge({ rankAtSubmit: null, totalAtSubmit: 100 })).toEqual({ text: null, tier: null });
    expect(computeBadge({})).toEqual({ text: null, tier: null });
  });

  it("returns no badge for rank=0 or total=0 (defensive)", () => {
    expect(computeBadge({ rankAtSubmit: 0, totalAtSubmit: 100 })).toEqual({ text: null, tier: null });
    expect(computeBadge({ rankAtSubmit: 5, totalAtSubmit: 0 })).toEqual({ text: null, tier: null });
  });
});
