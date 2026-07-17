import { describe, it, expect } from "vitest";
import { computeRecommendation } from "./recommendation";

const base = { priorities: [] as string[], budgetTier: "medium", familyConfig: ["self"] };

describe("computeRecommendation", () => {
  it("returns the Supreme default for a medium nuclear-family profile", () => {
    expect(computeRecommendation(base).name).toBe("Aegis Supreme Health Shield");
  });

  it("upgrades to Global Elite when medevac is prioritised", () => {
    expect(computeRecommendation({ ...base, priorities: ["global-medevac"] }).name)
      .toBe("Aegis Global Elite Shield");
  });

  it("upgrades to Global Elite for a premium budget tier", () => {
    expect(computeRecommendation({ ...base, budgetTier: "premium" }).name)
      .toBe("Aegis Global Elite Shield");
  });

  it("matches Term Life for a single applicant wanting pre-existing cover", () => {
    expect(computeRecommendation({ ...base, priorities: ["pre-illness"], familyConfig: ["self"] }).name)
      .toBe("Family Shield Term Life");
  });

  it("does NOT match Term Life once the family has more than one member", () => {
    expect(computeRecommendation({ ...base, priorities: ["pre-illness"], familyConfig: ["self", "spouse"] }).name)
      .toBe("Aegis Supreme Health Shield");
  });

  it("matches Essential for a basic budget tier", () => {
    expect(computeRecommendation({ ...base, budgetTier: "basic" }).name)
      .toBe("Aegis Essential Shield");
  });

  it("prioritises Global Elite over the basic tier when both could apply", () => {
    // global-medevac wins the first branch even though budget is basic
    expect(computeRecommendation({ ...base, budgetTier: "basic", priorities: ["global-medevac"] }).name)
      .toBe("Aegis Global Elite Shield");
  });

  it("always returns a fully-populated verdict", () => {
    const r = computeRecommendation(base);
    expect(r.benefits.length).toBeGreaterThan(0);
    expect(r.coverage).toBeTruthy();
    expect(r.premium).toBeTruthy();
    expect(r.claimRatio).toBeTruthy();
  });
});
