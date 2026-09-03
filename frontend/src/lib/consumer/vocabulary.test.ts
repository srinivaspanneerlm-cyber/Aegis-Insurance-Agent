/**
 * The choice lists, and whether they still agree with the API.
 *
 * A drift here is silent in the worst way: the customer picks an option, the
 * API rejects the id, and the form can only report that something was invalid.
 * So the backend's own file is read rather than trusted.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  POLICY_TYPES,
  POLICY_TYPE_CHOICES,
  VEHICLE_TYPES,
  VEHICLE_TYPE_CHOICES,
  policyTypeChoice,
  vehicleTypeChoice,
} from "./vocabulary";

const backend = readFileSync(
  join(__dirname, "..", "..", "..", "..", "backend", "src", "consumer", "vocabulary.ts"),
  "utf8"
);

describe("the frontend and the API agree on the vocabulary", () => {
  it("uses the same vehicle types", () => {
    for (const id of VEHICLE_TYPES) {
      expect(backend, `${id} is missing from the API's vocabulary`).toContain(`"${id}"`);
    }
  });

  it("uses the same policy types", () => {
    for (const id of POLICY_TYPES) {
      expect(backend, `${id} is missing from the API's vocabulary`).toContain(`"${id}"`);
    }
  });

  it("offers a choice for every type the API accepts", () => {
    expect(POLICY_TYPE_CHOICES.map((c) => c.id).sort()).toEqual([...POLICY_TYPES].sort());
    expect(VEHICLE_TYPE_CHOICES.map((c) => c.id).sort()).toEqual([...VEHICLE_TYPES].sort());
  });
});

describe("every choice explains itself", () => {
  const all = [...POLICY_TYPE_CHOICES, ...VEHICLE_TYPE_CHOICES];

  it("carries a meaning, not just a label", () => {
    // The whole difficulty is that most people do not know what these words
    // mean. A bare label would be a dropdown with the problem intact.
    for (const choice of all) {
      expect(choice.meaning.en.length, `${choice.id} has no explanation`).toBeGreaterThan(20);
    }
  });

  it("is written in all three languages", () => {
    for (const choice of all) {
      for (const text of [choice.label, choice.meaning]) {
        expect(text.ta, `${choice.id} has no Tamil`).toBeTruthy();
        expect(text.taEn, `${choice.id} has no Thanglish`).toBeTruthy();
      }
    }
  });

  it("has real Tamil script in the Tamil, not English left in the slot", () => {
    const tamil = /[஀-௿]/;
    for (const choice of all) {
      expect(tamil.test(choice.meaning.ta!), `${choice.id}'s Tamil is not Tamil`).toBe(true);
    }
  });
});

describe('"I am not sure"', () => {
  const unknown = policyTypeChoice("UNKNOWN")!;

  it("is offered last, as an ordinary answer", () => {
    expect(POLICY_TYPE_CHOICES[POLICY_TYPE_CHOICES.length - 1].id).toBe("UNKNOWN");
  });

  it("reassures rather than scolds", () => {
    // A form that makes not knowing feel like failure pushes people into
    // guessing, which puts a fiction on their record.
    expect(unknown.meaning.en).toMatch(/completely fine|most people/i);
    for (const word of ["invalid", "error", "must", "required"]) {
      expect(unknown.meaning.en.toLowerCase()).not.toContain(word);
    }
  });
});

describe("lookups", () => {
  it("find a choice by id", () => {
    expect(policyTypeChoice("COMPREHENSIVE")?.label.en).toBe("Comprehensive");
    expect(vehicleTypeChoice("SCOOTER")?.label.en).toBe("Scooter");
  });

  it("return null rather than throwing on something unrecognised", () => {
    expect(policyTypeChoice(null)).toBeNull();
    expect(vehicleTypeChoice("TRACTOR")).toBeNull();
  });
});
