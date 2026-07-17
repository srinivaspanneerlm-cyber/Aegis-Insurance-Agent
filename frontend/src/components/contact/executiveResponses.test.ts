import { describe, it, expect } from "vitest";
import { getExecutiveResponse } from "./executiveResponses";

describe("getExecutiveResponse", () => {
  it("greets on hello-style input", () => {
    expect(getExecutiveResponse("hello there")).toContain("Greetings");
    expect(getExecutiveResponse("hey")).toContain("Chief Executive AI Advisor");
  });

  it("routes insurance/plan queries to the coverage guide", () => {
    expect(getExecutiveResponse("tell me about a plan")).toContain("Talk-to-Unlock");
    expect(getExecutiveResponse("what cover do I need")).toContain("Policies Portal");
  });

  it("routes support/error queries to the technical response", () => {
    expect(getExecutiveResponse("technical support please")).toContain("Underwriting channels");
    expect(getExecutiveResponse("reporting a bug")).toContain("Underwriting channels");
  });

  // Matching is plain substring, and the greeting branch runs first, so any word
  // containing "hi" ("hit", "this", "shipping") greets instead of matching the
  // later branch. Pinned as-is: this mock's replies predate the extraction.
  it("lets the greeting branch win over words that merely contain 'hi'", () => {
    expect(getExecutiveResponse("I hit a technical error")).toContain("Greetings");
  });

  it("routes recommendation queries to the engine response", () => {
    expect(getExecutiveResponse("show me a recommendation")).toContain("recommendation engine");
  });

  it("routes account/login queries to the vault-security response", () => {
    expect(getExecutiveResponse("I need to register an account")).toContain("digital vault security");
  });

  it("falls back to the default executive response for unmatched input", () => {
    expect(getExecutiveResponse("zzxqw")).toContain("Query processed through executive leadership channels");
  });

  it("is case-insensitive", () => {
    expect(getExecutiveResponse("RECOMMENDATION")).toContain("recommendation engine");
  });
});
