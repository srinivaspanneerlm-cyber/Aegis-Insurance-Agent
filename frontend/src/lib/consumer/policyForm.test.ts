/**
 * The manual policy form's rules.
 *
 * Tested here rather than through six rendered screens, which is the whole
 * reason this logic is pure. What matters is the shape of the judgements: which
 * fields a person may leave blank, which mistakes are caught, and — the part
 * easiest to get wrong — which apparent mistakes are not mistakes at all.
 */
import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  FORM_STEPS,
  REVIEW_STEP_INDEX,
  draftFromPolicy,
  hasErrors,
  isRealDate,
  toCreatePayload,
  toUpdatePayload,
  validateDraft,
  validateField,
  validateStep,
  vehicleChanged,
  type EditablePolicy,
  type PolicyDraft,
} from "./policyForm";

const complete: PolicyDraft = {
  registrationNumber: "TN 09 AB 1234",
  vehicleType: "BIKE",
  make: "Hero",
  model: "Splendor",
  insurer: "Bharat General Insurance",
  policyNumber: "POL/2026/000123",
  policyType: "COMPREHENSIVE",
  startDate: "2025-09-08",
  expiryDate: "2026-09-08",
  idv: "65000",
  ncbPercent: "25",
};

const draft = (overrides: Partial<PolicyDraft> = {}): PolicyDraft => ({ ...complete, ...overrides });

describe("the steps", () => {
  it("asks for the vehicle first and reviews last", () => {
    expect(FORM_STEPS[0].id).toBe("vehicle");
    expect(FORM_STEPS[REVIEW_STEP_INDEX].id).toBe("review");
  });

  it("keeps every step short — no screen asks more than two things", () => {
    // The whole reason for splitting the form. A step that grows past two
    // fields is the beginning of the long form this replaced.
    for (const step of FORM_STEPS) {
      expect(step.fields.length, `${step.id} asks too much at once`).toBeLessThanOrEqual(2);
    }
  });

  it("explains why it is asking on every step", () => {
    for (const step of FORM_STEPS) {
      expect(step.help.en.length, `${step.id} has no help text`).toBeGreaterThan(20);
      expect(step.title.ta, `${step.id} has no Tamil title`).toBeTruthy();
      expect(step.title.taEn, `${step.id} has no Thanglish title`).toBeTruthy();
    }
  });

  it("marks only the extras step as skippable", () => {
    const optional = FORM_STEPS.filter((s) => s.optional).map((s) => s.id);
    expect(optional).toEqual(["extras"]);
  });
});

describe("what must be answered", () => {
  it("accepts a complete draft", () => {
    expect(hasErrors(validateDraft(complete))).toBe(false);
  });

  it("requires an expiry date — it is the whole answer", () => {
    const error = validateField("expiryDate", draft({ expiryDate: "" }));
    expect(error).not.toBeNull();
    expect(error!.en).toMatch(/expiry date/i);
    // Not just English: the message a Tamil reader gets must exist too.
    expect(error!.ta).toBeTruthy();
    expect(error!.taEn).toBeTruthy();
  });

  it("requires a vehicle number, a type, an insurer, a policy number and a cover type", () => {
    for (const field of ["registrationNumber", "vehicleType", "insurer", "policyNumber", "policyType"] as const) {
      expect(validateField(field, draft({ [field]: "" })), `${field} should be required`).not.toBeNull();
    }
  });

  it("lets the start date, IDV and no-claim bonus be left blank", () => {
    const sparse = draft({ startDate: "", idv: "", ncbPercent: "", make: "", model: "" });
    expect(hasErrors(validateDraft(sparse))).toBe(false);
  });
});

describe("mistakes that are caught", () => {
  it("a date that does not exist", () => {
    expect(validateField("expiryDate", draft({ expiryDate: "2026-02-31" }))).not.toBeNull();
    expect(isRealDate("2026-02-31")).toBe(false);
    expect(isRealDate("2028-02-29")).toBe(true); // a real leap day
  });

  it("dates entered the other way round, and says so in those words", () => {
    const error = validateField("startDate", draft({ startDate: "2026-12-01", expiryDate: "2026-09-08" }));
    expect(error).not.toBeNull();
    // "Invalid date range" tells nobody which box to fix.
    expect(error!.en).toMatch(/other way round/i);
  });

  it("a no-claim bonus above 100, because it is a percentage", () => {
    expect(validateField("ncbPercent", draft({ ncbPercent: "150" }))).not.toBeNull();
    expect(validateField("ncbPercent", draft({ ncbPercent: "50" }))).toBeNull();
  });

  it("letters where a number belongs", () => {
    expect(validateField("idv", draft({ idv: "sixty thousand" }))).not.toBeNull();
    expect(validateField("ncbPercent", draft({ ncbPercent: "-5" }))).not.toBeNull();
  });

  it("a vehicle number too short to be one", () => {
    expect(validateField("registrationNumber", draft({ registrationNumber: "TN" }))).not.toBeNull();
  });
});

describe("what is deliberately NOT treated as a mistake", () => {
  it("an unfamiliar plate format", () => {
    // Older and out-of-state plates do not match the current pattern, and the
    // people holding them are exactly who this product is for. Length is
    // checked; format never is.
    for (const plate of ["MYS 4021", "DL1CAB0001", "TN09AB1234", "tn-09-ab-1234"]) {
      expect(validateField("registrationNumber", draft({ registrationNumber: plate })), plate).toBeNull();
    }
  });

  it('"I am not sure" about the cover type', () => {
    // The most honest answer a first-time buyer can give, and the form must
    // accept it rather than pushing them into a guess.
    expect(validateField("policyType", draft({ policyType: "UNKNOWN" }))).toBeNull();
    expect(hasErrors(validateDraft(draft({ policyType: "UNKNOWN" })))).toBe(false);
  });

  it("an expiry date in the past", () => {
    // Somebody whose cover lapsed last year is precisely who came here for an
    // answer. Refusing their date would refuse them the answer.
    expect(validateField("expiryDate", draft({ expiryDate: "2019-04-01" }))).toBeNull();
  });

  it("a missing make and model", () => {
    expect(hasErrors(validateDraft(draft({ make: "", model: "" })))).toBe(false);
  });
});

describe("step-by-step validation", () => {
  it("only complains about the step you are on", () => {
    // An empty draft has problems everywhere; step one must mention only its own.
    const errors = validateStep(0, EMPTY_DRAFT);
    expect(Object.keys(errors).sort()).toEqual(["registrationNumber", "vehicleType"]);
  });

  it("the review step has nothing of its own to check", () => {
    expect(validateStep(REVIEW_STEP_INDEX, complete)).toEqual({});
  });

  it("validating the whole draft catches a field cleared on an earlier step", () => {
    // The bug this stops: passing step one, walking to the end, going back and
    // clearing the plate, then submitting on the strength of the earlier pass.
    const sabotaged = draft({ registrationNumber: "" });
    expect(validateStep(REVIEW_STEP_INDEX, sabotaged)).toEqual({});
    expect(validateDraft(sabotaged).registrationNumber).toBeTruthy();
  });
});

describe("the request body", () => {
  it("nests the vehicle so both are written together", () => {
    const payload = toCreatePayload(complete) as Record<string, Record<string, unknown>>;
    expect(payload.vehicle).toMatchObject({
      registrationNumber: "TN 09 AB 1234",
      vehicleType: "BIKE",
      make: "Hero",
      model: "Splendor",
    });
  });

  it("omits blank optional fields rather than sending empty strings", () => {
    // The API reads an absent field as "not supplied". An empty string would
    // have to be separately understood as the same thing in two places.
    const payload = toCreatePayload(draft({ startDate: "", idv: "", ncbPercent: "", make: "", model: "" }));
    expect("startDate" in payload).toBe(false);
    expect("idv" in payload).toBe(false);
    expect("ncbPercent" in payload).toBe(false);
    expect(payload.vehicle).not.toHaveProperty("make");
  });

  it("sends numbers as numbers", () => {
    const payload = toCreatePayload(complete);
    expect(payload.idv).toBe(65000);
    expect(payload.ncbPercent).toBe(25);
  });

  it("trims what the customer typed", () => {
    const payload = toCreatePayload(draft({ insurer: "  Bharat General  " }));
    expect(payload.insurer).toBe("Bharat General");
  });

  it("sends no field the API refuses", () => {
    // The API rejects unknown keys outright, so anything extra here would turn
    // a valid form into a 400 the customer cannot act on.
    const allowed = new Set(["insurer", "policyNumber", "policyType", "startDate", "expiryDate", "idv", "ncbPercent", "vehicle", "vehicleId"]);
    for (const key of Object.keys(toCreatePayload(complete))) {
      expect(allowed.has(key), `${key} is not accepted by the API`).toBe(true);
    }
  });
});

// ── Correcting a policy that is already saved ────────────────────────────────

const saved: EditablePolicy = {
  insurer: "Bharat General Insurance",
  policyType: "COMPREHENSIVE",
  startDate: "2025-09-08",
  expiryDate: "2026-09-08",
  idv: 65000,
  ncbPercent: 25,
  vehicle: {
    registrationNumber: "TN 09 AB 1234",
    vehicleType: "BIKE",
    make: "Hero",
    model: "Splendor",
  },
};

describe("filling the form from a saved policy", () => {
  it("puts every stored answer back in the box it came from", () => {
    expect(draftFromPolicy(saved)).toMatchObject({
      registrationNumber: "TN 09 AB 1234",
      vehicleType: "BIKE",
      make: "Hero",
      model: "Splendor",
      insurer: "Bharat General Insurance",
      policyType: "COMPREHENSIVE",
      startDate: "2025-09-08",
      expiryDate: "2026-09-08",
      idv: "65000",
      ncbPercent: "25",
    });
  });

  it("leaves the policy number blank rather than pre-filling a mask", () => {
    // The browser is only ever sent the last few characters. Putting those in an
    // editable box invites a customer to save the mask as the real number.
    expect(draftFromPolicy(saved).policyNumber).toBe("");
  });

  it("survives a policy with nothing optional on it", () => {
    const bare = draftFromPolicy({
      insurer: null,
      policyType: null,
      startDate: null,
      expiryDate: null,
      idv: null,
      ncbPercent: null,
      vehicle: null,
    });
    expect(bare).toEqual(EMPTY_DRAFT);
  });

  it("keeps a zero no-claim bonus rather than reading it as absent", () => {
    expect(draftFromPolicy({ ...saved, ncbPercent: 0 }).ncbPercent).toBe("0");
  });
});

describe("validation while correcting", () => {
  it("accepts a blank policy number, because blank means keep the one you have", () => {
    const blank = draft({ policyNumber: "" });
    expect(validateField("policyNumber", blank, "edit")).toBeNull();
    expect(hasErrors(validateDraft(blank, "edit"))).toBe(false);
  });

  it("still requires it when the policy is being added", () => {
    expect(validateField("policyNumber", draft({ policyNumber: "" }))).toBeTruthy();
  });

  it("checks a policy number that was actually retyped", () => {
    expect(validateField("policyNumber", draft({ policyNumber: "PO" }), "edit")).toBeTruthy();
  });

  it("will not let the expiry date be cleared", () => {
    // Everything this product says comes from that one date. A correction that
    // removes it leaves a policy nothing can be said about.
    expect(validateField("expiryDate", draft({ expiryDate: "" }), "edit")).toBeTruthy();
  });

  it("still catches the two dates the wrong way round", () => {
    const swapped = draft({ startDate: "2026-09-08", expiryDate: "2025-09-08" });
    expect(validateField("startDate", swapped, "edit")).toBeTruthy();
  });
});

describe("the correction request body", () => {
  it("sends the optional fields even when emptied, so clearing one works", () => {
    // Omitting them would silently keep the old value, and the customer who just
    // deleted their IDV would see it reappear.
    const payload = toUpdatePayload(draft({ startDate: "", idv: "", ncbPercent: "" }));
    expect(payload.startDate).toBe("");
    expect(payload.idv).toBe("");
    expect(payload.ncbPercent).toBe("");
  });

  it("omits the policy number when it was left blank", () => {
    expect("policyNumber" in toUpdatePayload(draft({ policyNumber: "" }))).toBe(false);
  });

  it("sends the policy number when it was retyped", () => {
    expect(toUpdatePayload(draft({ policyNumber: " POL/9 " })).policyNumber).toBe("POL/9");
  });

  it("sends no field the API refuses", () => {
    const allowed = new Set(["insurer", "policyNumber", "policyType", "startDate", "expiryDate", "idv", "ncbPercent", "vehicle", "vehicleId"]);
    for (const key of Object.keys(toUpdatePayload(complete))) {
      expect(allowed.has(key), `${key} is not accepted by the API`).toBe(true);
    }
  });
});

describe("noticing whether the vehicle changed", () => {
  const original = draftFromPolicy(saved);

  it("says no when only policy fields were touched", () => {
    expect(vehicleChanged(draft({ ...original, insurer: "Someone Else" }), original)).toBe(false);
  });

  it("says yes when the plate was corrected", () => {
    expect(vehicleChanged({ ...original, registrationNumber: "TN 09 AB 1235" }, original)).toBe(true);
  });

  it("says yes when the kind of vehicle was corrected", () => {
    expect(vehicleChanged({ ...original, vehicleType: "CAR" }, original)).toBe(true);
  });

  it("ignores surrounding spaces, which are not a change", () => {
    expect(vehicleChanged({ ...original, registrationNumber: " TN 09 AB 1234 " }, original)).toBe(
      false
    );
  });
});
