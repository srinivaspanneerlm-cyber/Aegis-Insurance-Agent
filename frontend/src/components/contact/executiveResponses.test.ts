import { describe, it, expect } from "vitest";
import { getExecutiveResponse } from "./executiveResponses";

describe("getExecutiveResponse", () => {
  it("greets on hello-style input", () => {
    expect(getExecutiveResponse("hello there")).toContain("Sri AI");
    expect(getExecutiveResponse("hey")).toContain("Chief Executive AI Advisor");
  });

  it("routes insurance/plan queries to the coverage guide", () => {
    expect(getExecutiveResponse("tell me about a plan")).toContain("Policies page");
    expect(getExecutiveResponse("what cover do I need")).toContain("Policies page");
  });

  it("routes support/error queries to the technical response", () => {
    expect(getExecutiveResponse("technical support please")).toContain("up and running");
    expect(getExecutiveResponse("reporting a bug")).toContain("up and running");
  });

  it("does not greet on words that merely contain a greeting ('hit', 'this')", () => {
    expect(getExecutiveResponse("I hit a technical error")).toContain("up and running");
    expect(getExecutiveResponse("what is this plan")).toContain("Policies page");
  });

  it("greets on a standalone 'hi' or 'hey'", () => {
    expect(getExecutiveResponse("hi")).toContain("Sri AI");
    expect(getExecutiveResponse("hey there")).toContain("Sri AI");
  });

  it("routes recommendation queries to the engine response", () => {
    expect(getExecutiveResponse("show me a recommendation")).toContain("suggests a plan");
  });

  it("routes account/login queries to the vault-security response", () => {
    expect(getExecutiveResponse("I need to register an account")).toContain("digital vault security");
  });

  it("falls back to the default executive response for unmatched input", () => {
    expect(getExecutiveResponse("zzxqw")).toContain("Query processed through executive leadership channels");
  });

  it("is case-insensitive", () => {
    expect(getExecutiveResponse("RECOMMENDATION")).toContain("suggests a plan");
  });
});
