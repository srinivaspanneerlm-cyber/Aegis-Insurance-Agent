import { describe, it, expect } from "vitest";
import {
  needsOnboarding,
  routeForUser,
  destinationAfterAuth,
  CUSTOMER_HOME,
  ONBOARDING_ROUTE,
} from "./authRouting";

const ONBOARDED = { onboardedAt: "2026-08-03T09:00:00.000Z" };

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

describe("destinationAfterAuth", () => {
  it("finishes the journey the customer started", () => {
    // They asked for a page, the guard sent them to sign in, they signed in.
    // Dropping them on the dashboard now would lose what they came for.
    expect(destinationAfterAuth(ONBOARDED, "/consumer/profile")).toBe("/consumer/profile");
  });

  it("falls back to the dashboard when they asked for nothing in particular", () => {
    expect(destinationAfterAuth(ONBOARDED, null)).toBe(CUSTOMER_HOME);
  });

  it("puts onboarding ahead of any requested page", () => {
    // A customer who has not finished onboarding cannot use the page they
    // asked for anyway.
    expect(destinationAfterAuth({ onboardedAt: null }, "/consumer/profile")).toBe(
      ONBOARDING_ROUTE
    );
  });

  it("never redirects off-site, however the destination is dressed up", () => {
    expect(destinationAfterAuth(ONBOARDED, "https://evil.example")).toBe(CUSTOMER_HOME);
    expect(destinationAfterAuth(ONBOARDED, "//evil.example")).toBe(CUSTOMER_HOME);
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
