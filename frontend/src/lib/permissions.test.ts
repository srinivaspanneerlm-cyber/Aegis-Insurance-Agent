import { describe, it, expect } from "vitest";
import { hasPermission, hasAllPermissions, hasAnyPermission } from "./permissions";

/**
 * These helpers decide what a screen shows, so every case here is really the
 * same question: when we are not sure, do we show more or less? The answer has
 * to be less, every time. A control that appears and then 403s reads to a
 * first-time buyer as the product being broken, and to anyone else as an
 * invitation to find out what is behind it.
 */

const ADMIN_GRANT = ["policy.read", "policy.write", "lead.read", "lead.write", "analytics.read"];

describe("hasPermission", () => {
  it("finds a capability that was granted", () => {
    expect(hasPermission(ADMIN_GRANT, "lead.read")).toBe(true);
  });

  it("does not find one that was not", () => {
    expect(hasPermission(ADMIN_GRANT, "lead.delete")).toBe(false);
  });

  it("treats no grant at all as no capability", () => {
    // This is the state during the boot probe, before the server has answered.
    // Rendering an administrative control on the assumption that one is coming
    // is the wrong way to be wrong.
    expect(hasPermission(undefined, "lead.read")).toBe(false);
    expect(hasPermission(null, "lead.read")).toBe(false);
    expect(hasPermission([], "lead.read")).toBe(false);
  });

  it("matches exactly, not by prefix", () => {
    // "policy.read" must not satisfy a check for "policy.read.all" and
    // "policy.write" must not be satisfied by holding "policy".
    expect(hasPermission(["policy"], "policy.read")).toBe(false);
    expect(hasPermission(["policy.read"], "policy.write")).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  it("requires every capability listed", () => {
    expect(hasAllPermissions(ADMIN_GRANT, ["lead.read", "lead.write"])).toBe(true);
    expect(hasAllPermissions(ADMIN_GRANT, ["lead.read", "lead.delete"])).toBe(false);
  });

  it("an empty requirement is vacuously satisfied", () => {
    // Guarded at the call site by <Can>, which refuses to render on an empty
    // list — this documents that the primitive itself does not decide that.
    expect(hasAllPermissions(ADMIN_GRANT, [])).toBe(true);
  });
});

describe("hasAnyPermission", () => {
  it("one is enough", () => {
    expect(hasAnyPermission(ADMIN_GRANT, ["lead.delete", "lead.read"])).toBe(true);
  });

  it("none is not", () => {
    expect(hasAnyPermission(ADMIN_GRANT, ["lead.delete", "staff.manage"])).toBe(false);
  });

  it("an empty requirement grants nothing", () => {
    expect(hasAnyPermission(ADMIN_GRANT, [])).toBe(false);
  });
});
