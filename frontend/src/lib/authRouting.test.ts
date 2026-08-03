import { describe, it, expect } from "vitest";
import { needsOnboarding, routeForUser, CUSTOMER_HOME, ONBOARDING_ROUTE } from "./authRouting";

describe("routeForUser", () => {
  it("sends a first-time customer to onboarding", () => {
    expect(routeForUser({ onboardedAt: null })).toBe(ONBOARDING_ROUTE);
  });

  it("sends a returning customer straight to the dashboard", () => {
    expect(routeForUser({ onboardedAt: "2026-08-03T09:00:00.000Z" })).toBe(CUSTOMER_HOME);
  });

  it("treats a missing onboardedAt the same as an explicit null", () => {
    expect(routeForUser({})).toBe(ONBOARDING_ROUTE);
  });

  it("routes every signed-in user the same way — this portal has no roles", () => {
    // Staff accounts still exist server-side; they have no separate destination
    // here, because there is no administrative surface in the customer portal.
    expect(routeForUser({ onboardedAt: "2026-08-03T09:00:00.000Z" })).toBe(CUSTOMER_HOME);
  });
});

describe("needsOnboarding", () => {
  it("is false when nobody is signed in", () => {
    expect(needsOnboarding(null)).toBe(false);
  });

  it("is true only until the answers are given", () => {
    expect(needsOnboarding({ onboardedAt: null })).toBe(true);
    expect(needsOnboarding({ onboardedAt: "2026-08-03T09:00:00.000Z" })).toBe(false);
  });
});
