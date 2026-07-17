import { describe, it, expect } from "vitest";
import { resolveAdvisorName } from "@/lib/advisors";

/**
 * The receipt-naming rule extracted from PurchaseContext.setSuccess, kept in
 * lockstep with it. `PurchaseContext` is a client component wired to
 * localStorage, so this pins the decision itself rather than rendering it.
 */
const RECEIPT_CATEGORIES = ["health", "motor", "travel", "home-property", "property"];
const DEFAULT_ADVISOR_NAME = "Sarah AI";

const receiptAdvisorName = (category: string) =>
  RECEIPT_CATEGORIES.includes(category)
    ? resolveAdvisorName(category, DEFAULT_ADVISOR_NAME)
    : DEFAULT_ADVISOR_NAME;

/** Verbatim copy of the inline advisorMap this logic replaced. */
const legacyAdvisorMap: Record<string, string> = {
  health: "Sarah AI", motor: "Alex AI",
  travel: "Ethan AI", "home-property": "Emma AI", property: "Emma AI",
};
const legacy = (category: string) => legacyAdvisorMap[category || "health"] || "Sarah AI";

describe("purchase receipt advisor name", () => {
  it("names the selling specialist for each sellable category", () => {
    expect(receiptAdvisorName("health")).toBe("Sarah AI");
    expect(receiptAdvisorName("motor")).toBe("Alex AI");
    expect(receiptAdvisorName("travel")).toBe("Ethan AI");
  });

  it("names Emma under both the UI category and the Python domain", () => {
    expect(receiptAdvisorName("property")).toBe("Emma AI");
    expect(receiptAdvisorName("home-property")).toBe("Emma AI");
  });

  // The deliberate exclusion: Sri routes, he does not close sales, so a receipt
  // must not name him — even though the shared roster knows who he is.
  it("does not name Sri on a receipt, even for an executive category", () => {
    expect(resolveAdvisorName("executive", DEFAULT_ADVISOR_NAME)).toBe("Sri AI");
    expect(receiptAdvisorName("executive")).toBe("Sarah AI");
    expect(receiptAdvisorName("miscellaneous")).toBe("Sarah AI");
  });

  it("falls back to the health advisor for an unknown category", () => {
    expect(receiptAdvisorName("pet")).toBe("Sarah AI");
    expect(receiptAdvisorName("")).toBe("Sarah AI");
  });

  // The whole point of the refactor: identical output, one less copy of the map.
  it("is byte-for-byte equivalent to the map it replaced", () => {
    const categories = [
      "health", "motor", "travel", "home-property", "property",
      "executive", "miscellaneous", "cyber", "pet", "",
    ];
    for (const c of categories) {
      expect(receiptAdvisorName(c)).toBe(legacy(c));
    }
  });
});
