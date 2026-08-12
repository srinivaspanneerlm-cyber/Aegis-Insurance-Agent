import { describe, it, expect } from "vitest";
import type { MultiPlan } from "../types";
import { healthRows, motorRows, propertyRows, travelRows } from "./detailRows";

/** Minimal valid plan; tests override only the fields they care about. */
const basePlan = (overrides: Partial<MultiPlan> = {}): MultiPlan => ({
  rank: 1,
  plan_id: "p1",
  plan_name: "Test Plan",
  segment: "standard",
  coverage: "₹10L",
  premium: "₹500/mo",
  benefits: ["b1"],
  scores: { overall: 90, suitability: 90, budget_match: 90, coverage_match: 90, risk_match: 90 },
  ...overrides,
});

const labels = (rows: { label: string }[]) => rows.map((r) => r.label);

describe("detailRows", () => {
  it("healthRows keeps only rows with a value", () => {
    const rows = healthRows(basePlan({ room_rent: "No cap", icu: undefined, ncb: "50%" }));
    expect(labels(rows)).toEqual(["Room rent limit", "No-claim bonus"]);
  });

  it("motorRows drops negative values but keeps a real value", () => {
    const rows = motorRows(basePlan({
      idv: "₹5L",
      engine_protect: true,     // -> "Yes", kept
      zero_dep: false,          // -> "No", dropped (not in always-list)
      consumables: false,       // -> "Not included", dropped
    }));
    expect(labels(rows)).toContain("Vehicle's insured value");
    expect(labels(rows)).toContain("Engine damage cover");
    expect(labels(rows)).not.toContain("Full parts cover");
    expect(labels(rows)).not.toContain("Oils and small parts");
  });

  it("motorRows drops an always-listed label when its value is missing", () => {
    // "Policy Type" is in the keep-list but has no value -> final filter removes it.
    const rows = motorRows(basePlan({ policy_type: undefined }));
    expect(labels(rows)).not.toContain("Type of cover");
  });

  it("propertyRows drops 'Not included' rows", () => {
    const rows = propertyRows(basePlan({
      fire_cover: true, fire_detail: "Full",
      flood_cover: false,   // -> "Not included", dropped
    }));
    expect(labels(rows)).toContain("Fire");
    expect(labels(rows)).not.toContain("Flood");
  });

  it("travelRows drops negatives but keeps declared covers", () => {
    const rows = travelRows(basePlan({
      medical_cover_amount: "$50k",
      lost_baggage: false,        // -> "Not included", dropped
      schengen_compliant: false,  // -> "Not Schengen", dropped
    }));
    expect(labels(rows)).toContain("Medical Cover");
    expect(labels(rows)).not.toContain("Lost Baggage");
    expect(labels(rows)).not.toContain("Schengen");
  });
});
