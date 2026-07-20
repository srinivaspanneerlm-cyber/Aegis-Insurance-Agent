import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CURATED_PLANS, INSURANCE_CATEGORIES, PLATFORM_FACTS, SPECIALIST_ADVISORS } from "./platformFacts";

const SRC = join(__dirname, "..");

/** Files allowed to contain illustrative content, because they label it. */
const ALLOWED = ["lib/placeholders.ts", "lib/platformFacts.test.ts"];

/**
 * Claim shapes that were shipped as fact before Phase 4.1.1 and must not come
 * back. These are regulated representations on an insurance product — an
 * invented settlement ratio or certification is a compliance problem, not a
 * copy problem, so it is guarded here rather than left to review.
 */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\d{2}\.\d%\s*(claim|settle|settlement)/i, why: "invented claim settlement ratio" },
  { pattern: /50,000\+\s*families/i, why: "invented customers-served count" },
  { pattern: /₹500Cr\+/i, why: "invented claims-disbursed total" },
  { pattern: /ISO\s*27001/i, why: "unheld certification" },
  { pattern: /PCI-DSS/i, why: "unheld certification" },
  { pattern: /IRDAI\s+(regulatory|compliance)/i, why: "unheld regulatory status" },
  { pattern: /AES-256/i, why: "unverified encryption claim" },
  { pattern: /audited metric/i, why: "unaudited figure labelled as audited" },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("platform facts", () => {
  it("derives its totals from the plan catalogue", () => {
    expect(CURATED_PLANS).toBe(INSURANCE_CATEGORIES * 9);
    expect(INSURANCE_CATEGORIES).toBe(4);
    expect(SPECIALIST_ADVISORS).toBe(5);
  });

  it("publishes a fact tile for every headline number", () => {
    expect(PLATFORM_FACTS).toHaveLength(4);
    for (const fact of PLATFORM_FACTS) {
      expect(fact.value).not.toBe("");
      expect(fact.label).not.toBe("");
    }
  });
});

describe("no unverified claims ship to users", () => {
  const files = walk(SRC).filter((f) => !ALLOWED.some((a) => f.endsWith(a)));

  for (const { pattern, why } of FORBIDDEN) {
    it(`does not reintroduce: ${why}`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
      expect(offenders.map((f) => f.replace(SRC, "src"))).toEqual([]);
    });
  }
});
