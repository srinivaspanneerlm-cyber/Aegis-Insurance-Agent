import { describe, it, expect } from "vitest";
import {
  ACCEPT_MEDIA,
  DOCUMENT_KINDS,
  DOMAIN_DOCUMENTS,
  MAX_UPLOAD_BYTES,
  getKind,
  matchKinds,
  requirementFromKind,
  requirementsForDomain,
} from "./registry";

describe("document catalogue", () => {
  it("gives every kind a label, an icon and at least one accepted type", () => {
    for (const [key, spec] of Object.entries(DOCUMENT_KINDS)) {
      expect(spec.kind, `${key} must key itself`).toBe(key);
      expect(spec.label.en.length).toBeGreaterThan(0);
      expect(spec.icon.length).toBeGreaterThan(0);
      expect(spec.accept.length).toBeGreaterThan(0);
      expect(spec.stages[0]).toBe("upload");
      expect(spec.maxBytes).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    }
  });

  it("only lists documents the catalogue actually defines", () => {
    for (const kinds of Object.values(DOMAIN_DOCUMENTS)) {
      for (const kind of kinds) expect(getKind(kind)).not.toBeNull();
    }
  });

  it("gives each domain its own document set", () => {
    expect(requirementsForDomain("motor").map((r) => r.kind)).toEqual([
      "rc_book", "driving_license", "vehicle_photos", "aadhaar",
    ]);
    expect(requirementsForDomain("travel").map((r) => r.kind)).toEqual([
      "passport", "visa", "boarding_pass",
    ]);
  });

  it("resolves a Python domain name as readily as a UI category", () => {
    // The backend sends "home-property"; the sidebar calls the same thing "property".
    expect(requirementsForDomain("home-property")).toEqual(requirementsForDomain("property"));
  });

  it("returns nothing for a domain it does not know", () => {
    expect(requirementsForDomain("crypto")).toEqual([]);
  });
});

describe("requirementFromKind", () => {
  it("carries the catalogue defaults through", () => {
    const req = requirementFromKind("vehicle_photos");
    expect(req.label.en).toBe("Vehicle Photos");
    expect(req.multiple).toBe(true);
    expect(req.accept).toEqual(ACCEPT_MEDIA);
    expect(req.required).toBe(true);
  });

  it("lets a caller override any field", () => {
    const req = requirementFromKind("rc_book", { id: "custom", required: false, label: { en: "RC copy" } });
    expect(req.id).toBe("custom");
    expect(req.required).toBe(false);
    expect(req.label.en).toBe("RC copy");
    expect(req.kind).toBe("rc_book");
  });

  it("still renders a document the catalogue has never heard of", () => {
    // An agent must never be blocked by the catalogue being out of date.
    const req = requirementFromKind("drone_survey_report");
    expect(req.kind).toBe("drone_survey_report");
    expect(req.label.en).toBe("Drone Survey Report");
    expect(req.stages).toContain("upload");
  });
});

describe("matchKinds", () => {
  it("finds the documents an agent named, in the order it named them", () => {
    const text = "Please share your Aadhaar and then the RC book.";
    expect(matchKinds(text)).toEqual(["aadhaar", "rc_book"]);
  });

  it("matches regardless of case and alias spelling", () => {
    expect(matchKinds("send the REGISTRATION CERTIFICATE")).toEqual(["rc_book"]);
    expect(matchKinds("aadhar card venum")).toEqual(["aadhaar"]);
  });

  it("matches Tamil document names", () => {
    expect(matchKinds("கடவுச்சீட்டு அனுப்புங்கள்")).toEqual(["passport"]);
  });

  it("returns nothing when no document is named", () => {
    expect(matchKinds("What is your budget for the year?")).toEqual([]);
  });
});
