/**
 * The default plan must not assert figures nobody has verified.
 *
 * A claim settlement ratio is published per insurer by IRDAI and is the number
 * customers actually decide on. This file once carried 99.1% and 98.4%, a
 * hospital network of "12,000+", and a benefit line reading "Day-1 Pre-Existing
 * Illness Cover" that sat two lines above a waiting period contradicting it.
 *
 * The rendering components fall back to NOT_DISCLOSED for empty values, so an
 * unknown shows as unknown. This test stops a plausible-looking figure being
 * typed back in.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN } from "./constants";

describe("DEFAULT_PLAN", () => {
  it("claims no settlement ratio it cannot source", () => {
    expect(DEFAULT_PLAN.claimSettlementRatio).toBe("");
    expect(DEFAULT_PLAN.alternativePlan?.claimSettlementRatio).toBe("");
  });

  it("claims no hospital network size", () => {
    expect(DEFAULT_PLAN.hospitalNetwork).toBe("");
    expect(DEFAULT_PLAN.alternativePlan?.hospitalNetwork).toBe("");
  });

  it("asserts no policy terms as benefits", () => {
    expect(DEFAULT_PLAN.benefits).toEqual([]);
  });

  it("contains no percentage that would read as a settlement figure", () => {
    const serialised = JSON.stringify(DEFAULT_PLAN);
    expect(serialised).not.toMatch(/\d{2}\.\d%/);
  });
});
