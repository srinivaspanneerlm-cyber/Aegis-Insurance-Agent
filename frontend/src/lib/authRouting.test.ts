import { describe, it, expect } from "vitest";
import {
  needsOnboarding,
  routeForUser,
  ADMIN_HOME,
  CUSTOMER_HOME,
  ONBOARDING_ROUTE,
} from "./authRouting";

const customer = (onboardedAt: string | null = null) => ({ role: "customer", onboardedAt });

describe("routeForUser", () => {
  it("sends a first-time customer to onboarding", () => {
    expect(routeForUser(customer())).toBe(ONBOARDING_ROUTE);
  });

  it("sends a returning customer straight to the dashboard", () => {
    expect(routeForUser(customer("2026-08-03T09:00:00.000Z"))).toBe(CUSTOMER_HOME);
  });

  it("treats a missing onboardedAt the same as an explicit null", () => {
    expect(routeForUser({ role: "customer" })).toBe(ONBOARDING_ROUTE);
  });

  it("never asks staff which insurance they are shopping for", () => {
    expect(routeForUser({ role: "admin", onboardedAt: null })).toBe(ADMIN_HOME);
    expect(routeForUser({ role: "superadmin", onboardedAt: null })).toBe(ADMIN_HOME);
  });
});

describe("needsOnboarding", () => {
  it("is false when nobody is signed in", () => {
    expect(needsOnboarding(null)).toBe(false);
  });

  it("is true only for a customer who has not finished", () => {
    expect(needsOnboarding(customer())).toBe(true);
    expect(needsOnboarding(customer("2026-08-03T09:00:00.000Z"))).toBe(false);
    expect(needsOnboarding({ role: "admin" })).toBe(false);
  });
});
