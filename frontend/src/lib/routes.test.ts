import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSUMER_HOME, PROTECTED_PREFIXES, isProtectedPath, safeNextPath } from "./routes";

describe("isProtectedPath", () => {
  it("protects the dashboard and everything under it", () => {
    expect(isProtectedPath("/consumer-dashboard")).toBe(true);
    expect(isProtectedPath("/consumer-dashboard/claims")).toBe(true);
    expect(isProtectedPath("/consumer/profile")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
  });

  it("leaves the public pages public", () => {
    for (const path of ["/", "/about", "/contact", "/login", "/register", "/policies"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });

  it("keeps the advisor public — talking to Aegis is how customers arrive", () => {
    expect(isProtectedPath("/advisor")).toBe(false);
  });

  it("protects the Aegis Consumer home itself, not only the pages beneath it", () => {
    // `/consumer` was in the prefix list for its subpages long before it had an
    // index of its own. `isProtectedPath` matches a prefix exactly as well as
    // beneath it, which is what makes the new page protected without a change
    // to the list — this pins that, because the alternative is a signed-out
    // stranger being served a page addressed "Vanakkam".
    expect(isProtectedPath(CONSUMER_HOME)).toBe(true);
    expect(isProtectedPath("/consumer")).toBe(true);
  });

  it("does not protect a page that merely starts with the same letters", () => {
    // "/consumer-dashboard-preview" is not beneath "/consumer-dashboard".
    expect(isProtectedPath("/consumerx")).toBe(false);
    expect(isProtectedPath("/onboarding-guide")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("accepts a same-site path", () => {
    expect(safeNextPath("/consumer/profile")).toBe("/consumer/profile");
  });

  it("refuses to send a freshly signed-in customer to another site", () => {
    expect(safeNextPath("https://evil.example/pay")).toBeNull();
    // A browser reads a protocol-relative path as a different origin, despite
    // the leading slash — the open-redirect that looks safest.
    expect(safeNextPath("//evil.example/pay")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("treats a missing destination as no destination", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});

describe("the edge guard and the route list agree", () => {
  it("has a middleware matcher for every protected prefix", () => {
    // Next.js requires the matcher to be statically analysable, so it cannot be
    // generated from PROTECTED_PREFIXES. This is what keeps the copy honest: a
    // prefix added to the list without a matcher would protect the page in the
    // client guard only, and the page would still be served to a stranger.
    const middleware = readFileSync(join(__dirname, "..", "middleware.ts"), "utf8");

    for (const prefix of PROTECTED_PREFIXES) {
      expect(middleware).toContain(`"${prefix}/:path*"`);
    }
  });

  it("covers the Aegis Consumer home with an existing matcher", () => {
    // `/consumer/:path*` matches zero trailing segments, so it covers
    // `/consumer` itself. Stated as a test because it is the kind of thing that
    // looks like it needs a second matcher and quietly does not.
    const middleware = readFileSync(join(__dirname, "..", "middleware.ts"), "utf8");
    expect(middleware).toContain('"/consumer/:path*"');
    expect(PROTECTED_PREFIXES).toContain(CONSUMER_HOME);
  });
});
