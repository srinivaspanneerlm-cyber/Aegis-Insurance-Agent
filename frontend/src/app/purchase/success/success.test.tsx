/**
 * The purchase flow must never tell somebody they are insured.
 *
 * Nothing in this journey is real: no underwriting, no payment, no document
 * emailed, and the policy number is generated locally. The success screen used
 * to announce "Policy Issued" and "Your insurance policy is active and
 * documents have been sent to your email."
 *
 * A customer who believed that would stop looking for cover and be uninsured
 * without knowing it — the one outcome an insurance platform must never cause.
 * These tests read the source rather than rendering, because the claim is in
 * the copy and the copy is what has to stay corrected.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const successPage = readFileSync(join(__dirname, "page.tsx"), "utf8");
const purchaseLayout = readFileSync(join(__dirname, "..", "layout.tsx"), "utf8");

/** Strips comments, so an explanation of a removed claim is not read as the claim. */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("purchase success screen", () => {
  const copy = withoutComments(successPage);

  it("does not announce that a policy was issued", () => {
    expect(copy).not.toMatch(/Policy Issued/i);
  });

  it("does not claim the policy is active", () => {
    expect(copy).not.toMatch(/policy is active/i);
  });

  it("does not claim documents were emailed", () => {
    expect(copy).not.toMatch(/sent to your email/i);
  });

  it("states plainly that the customer is not insured", () => {
    expect(copy).toMatch(/You are not insured/i);
  });

  it("raises that statement as an alert rather than fine print", () => {
    expect(copy).toMatch(/role="alert"/);
  });
});

describe("purchase layout", () => {
  const copy = withoutComments(purchaseLayout);

  it("shows the demonstration notice at every width", () => {
    expect(copy).toMatch(/Demonstration/i);
    // `hidden sm:flex` on this notice meant it vanished on a phone, which is
    // where most of these journeys happen.
    expect(copy).not.toMatch(/hidden sm:flex[^"]*"[\s\S]{0,200}Demonstration/i);
  });
});
