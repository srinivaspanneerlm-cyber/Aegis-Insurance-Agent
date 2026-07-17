import { describe, it, expect } from "vitest";
import {
  generatePolicyNumber,
  generatePolicyId,
  extractPremiumAmount,
  calculateGST,
  getExpiryDate,
} from "./PurchaseContext";

describe("generatePolicyNumber", () => {
  it("matches the AEG-<year>-<9 digits> format", () => {
    expect(generatePolicyNumber()).toMatch(/^AEG-\d{4}-\d{9}$/);
  });

  it("embeds the current year", () => {
    const year = new Date().getFullYear().toString();
    expect(generatePolicyNumber()).toContain(`AEG-${year}-`);
  });

  it("produces distinct numbers across calls", () => {
    expect(generatePolicyNumber()).not.toBe(generatePolicyNumber());
  });
});

describe("generatePolicyId", () => {
  it("matches the POL-<timestamp>-<suffix> format", () => {
    expect(generatePolicyId()).toMatch(/^POL-\d+-[0-9A-Z]{1,6}$/);
  });

  it("produces distinct ids across calls", () => {
    expect(generatePolicyId()).not.toBe(generatePolicyId());
  });
});

describe("extractPremiumAmount", () => {
  it("pulls the number out of a formatted premium string", () => {
    expect(extractPremiumAmount("₹850/month")).toBe(850);
    expect(extractPremiumAmount("₹2,100 / mo")).toBe(2100);
    expect(extractPremiumAmount("1800")).toBe(1800);
  });

  it("strips grouping commas", () => {
    expect(extractPremiumAmount("₹1,00,000 per year")).toBe(100000);
  });

  it("defaults to 850 when no number is present", () => {
    expect(extractPremiumAmount("no digits here")).toBe(850);
    expect(extractPremiumAmount("")).toBe(850);
  });

  it("defaults to 850 for a nullish input", () => {
    // @ts-expect-error exercising the runtime guard for undefined input
    expect(extractPremiumAmount(undefined)).toBe(850);
  });
});

describe("calculateGST", () => {
  it("computes 18% rounded to the nearest rupee", () => {
    expect(calculateGST(850)).toBe(153);
    expect(calculateGST(1000)).toBe(180);
    expect(calculateGST(720)).toBe(130); // 129.6 -> 130
  });

  it("returns 0 for a zero base", () => {
    expect(calculateGST(0)).toBe(0);
  });
});

describe("getExpiryDate", () => {
  it("advances the start date by exactly one year", () => {
    expect(getExpiryDate("2026-01-01")).toBe("2027-01-01");
    expect(getExpiryDate("2026-07-18")).toBe("2027-07-18");
  });

  it("rolls a Feb-29 start into the following March (non-leap target)", () => {
    // JS Date normalises 2025-02-29 (invalid) to 2025-03-01
    expect(getExpiryDate("2024-02-29")).toBe("2025-03-01");
  });
});
