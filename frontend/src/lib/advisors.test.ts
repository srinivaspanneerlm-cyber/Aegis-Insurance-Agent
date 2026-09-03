import { describe, it, expect } from "vitest";
import {
  resolveAdvisorKey,
  resolveAdvisorName,
  advisorForAgentName,
  ADVISORS,
  PYTHON_DOMAIN_TO_CATEGORY,
} from "./advisors";
import { AGENTS } from "@/components/brand/geometry";

describe("resolveAdvisorKey", () => {
  it("accepts UI category keys", () => {
    expect(resolveAdvisorKey("health")).toBe("health");
    expect(resolveAdvisorKey("property")).toBe("property");
    expect(resolveAdvisorKey("miscellaneous")).toBe("miscellaneous");
  });

  it("accepts Python domain keys", () => {
    expect(resolveAdvisorKey("home-property")).toBe("property");
    expect(resolveAdvisorKey("executive")).toBe("miscellaneous");
  });

  it("returns null for anything unrecognised", () => {
    expect(resolveAdvisorKey("pet")).toBeNull();
    expect(resolveAdvisorKey("")).toBeNull();
  });

  // The two key spaces overlap; these are the keys that mean the same advisor
  // under both names, and the reason a single resolver has to accept both.
  it("agrees with itself across both key spaces", () => {
    for (const [domain, category] of Object.entries(PYTHON_DOMAIN_TO_CATEGORY)) {
      expect(resolveAdvisorKey(domain)).toBe(resolveAdvisorKey(category));
    }
  });

  it("resolves every advisor's own pythonDomain back to that advisor", () => {
    for (const [key, adv] of Object.entries(ADVISORS)) {
      expect(resolveAdvisorKey(adv.pythonDomain)).toBe(key);
    }
  });
});

describe("resolveAdvisorName", () => {
  it("names the advisor behind a category or a domain", () => {
    expect(resolveAdvisorName("health", "x")).toBe("Sarah AI");
    expect(resolveAdvisorName("motor", "x")).toBe("Alex AI");
    expect(resolveAdvisorName("travel", "x")).toBe("Ethan AI");
    expect(resolveAdvisorName("property", "x")).toBe("Emma AI");
    expect(resolveAdvisorName("home-property", "x")).toBe("Emma AI");
  });

  it("uses the caller's fallback for an unknown key", () => {
    expect(resolveAdvisorName("pet", "Sarah AI")).toBe("Sarah AI");
    expect(resolveAdvisorName("", "Sri AI")).toBe("Sri AI");
  });

  // Pins the contract the purchase receipt depends on: the five keys the old
  // inline advisorMap in PurchaseContext handled must resolve identically.
  it("matches the map it replaced on every key that map handled", () => {
    const replaced: Record<string, string> = {
      health: "Sarah AI",
      motor: "Alex AI",
      travel: "Ethan AI",
      "home-property": "Emma AI",
      property: "Emma AI",
    };
    for (const [key, name] of Object.entries(replaced)) {
      expect(resolveAdvisorName(key, "Sarah AI")).toBe(name);
    }
  });

  // The one place the resolver KNOWINGLY diverges from that old map: it knows
  // about Sri, which the old map omitted, so these fell through to the fallback.
  it("resolves the executive advisor, which the old map did not", () => {
    expect(resolveAdvisorName("executive", "Sarah AI")).toBe("Sri AI");
    expect(resolveAdvisorName("miscellaneous", "Sarah AI")).toBe("Sri AI");
  });
});

describe("advisor marks", () => {
  it("gives every advisor a mark that the brand system actually defines", () => {
    for (const adv of Object.values(ADVISORS)) {
      expect(AGENTS[adv.brand]).toBeDefined();
    }
  });

  it("gives each advisor a different mark", () => {
    const marks = Object.values(ADVISORS).map(a => a.brand);
    expect(new Set(marks).size).toBe(marks.length);
  });

  it("pins each domain to its own mark", () => {
    expect(ADVISORS.health.brand).toBe("sarah");
    expect(ADVISORS.motor.brand).toBe("alex");
    expect(ADVISORS.travel.brand).toBe("ethan");
    expect(ADVISORS.property.brand).toBe("emma");
  });

  // Nova is in the master artwork as a claims-and-fraud agent, and no such
  // agent exists. Handing its mark to a real advisor would label that advisor
  // with work they do not do, so the executive wears the platform shield.
  it("keeps the unassigned Nova mark off every advisor", () => {
    expect(ADVISORS.miscellaneous.brand).toBe("aegis");
    expect(Object.values(ADVISORS).map(a => a.brand)).not.toContain("nova");
  });
});

describe("advisorForAgentName", () => {
  // What makes a transferred transcript show each agent beside their own words.
  it("finds the advisor who actually sent the message", () => {
    expect(advisorForAgentName("Alex AI", ADVISORS.health).brand).toBe("alex");
    expect(advisorForAgentName("Emma AI", ADVISORS.health).brand).toBe("emma");
  });

  it("falls back to the advisor on screen for an unknown or missing name", () => {
    expect(advisorForAgentName("Nova AI", ADVISORS.motor)).toBe(ADVISORS.motor);
    expect(advisorForAgentName(undefined, ADVISORS.motor)).toBe(ADVISORS.motor);
  });
});
