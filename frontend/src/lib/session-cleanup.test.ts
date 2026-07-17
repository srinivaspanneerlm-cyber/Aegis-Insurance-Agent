import { describe, it, expect, beforeEach } from "vitest";
import { purgeCustomerSession } from "./session-cleanup";
import { STORAGE_KEYS, agentHistoryKey } from "./storage-keys";
import { ADVISORS } from "./advisors";

/** Everything a customer's session leaves in the browser, as it looks mid-flow. */
function seedACustomerSession() {
  localStorage.setItem(STORAGE_KEYS.PURCHASE_SESSION, JSON.stringify({ customerDetails: { firstName: "Priya" } }));
  localStorage.setItem(STORAGE_KEYS.SELECTED_PLAN, JSON.stringify({ planName: "Family Floater" }));
  localStorage.setItem(STORAGE_KEYS.SESSION_ID, "sess-priya-123");
  localStorage.setItem(agentHistoryKey("health"), JSON.stringify([{ text: "my father has diabetes" }]));
  localStorage.setItem(agentHistoryKey("motor"), JSON.stringify([{ text: "my car is a 2019 Swift" }]));
  localStorage.setItem(STORAGE_KEYS.THEME, "dark");
}

describe("purgeCustomerSession", () => {
  beforeEach(() => localStorage.clear());

  it("removes the half-finished purchase", () => {
    seedACustomerSession();
    purgeCustomerSession();
    expect(localStorage.getItem(STORAGE_KEYS.PURCHASE_SESSION)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.SELECTED_PLAN)).toBeNull();
  });

  // The transcript is the sensitive one — it names conditions, income, family.
  it("removes every advisor's transcript, not just the one last used", () => {
    seedACustomerSession();
    purgeCustomerSession();
    for (const advisor of Object.values(ADVISORS)) {
      expect(localStorage.getItem(agentHistoryKey(advisor.pythonDomain))).toBeNull();
    }
  });

  it("removes the session id, so the next person cannot resume the conversation server-side", () => {
    seedACustomerSession();
    purgeCustomerSession();
    expect(localStorage.getItem(STORAGE_KEYS.SESSION_ID)).toBeNull();
  });

  it("leaves nothing about the customer behind", () => {
    seedACustomerSession();
    purgeCustomerSession();
    const remaining = Object.keys(localStorage);
    // Only the theme may survive — it says nothing about who the customer is.
    expect(remaining).toEqual([STORAGE_KEYS.THEME]);
  });

  it("keeps the theme, so logging out does not look like a fault", () => {
    seedACustomerSession();
    purgeCustomerSession();
    expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBe("dark");
  });

  it("is safe to run on a browser with nothing stored", () => {
    expect(() => purgeCustomerSession()).not.toThrow();
  });
});
