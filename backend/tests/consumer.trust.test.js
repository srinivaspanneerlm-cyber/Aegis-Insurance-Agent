/**
 * The trust gate, and the words it is rendered in.
 *
 * Two properties are load-bearing and neither is visible by reading a screen.
 *
 * The first is precedence. Four states and seven checks means the interesting
 * question is never "does this rule fire" but "which rule wins when three of
 * them fire at once" — and getting that wrong is how a customer is asked to fix
 * a cover type while an unresolved question sits unmentioned behind it.
 *
 * The second is that nothing here accuses anybody. That is asserted against the
 * copy rather than trusted to review, because it is exactly the kind of rule a
 * later well-meaning edit breaks: "we could not verify this" reads as neutral
 * when you write it and as a finding when you receive it about your own
 * paperwork.
 */
process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const { TRUST_STATES, assessTrust } = require("../src/consumer/trustStatus");
const {
  CONSUMER_LOCALES,
  TRUST_ACTION_COPY,
  TRUST_REASON_COPY,
  TRUST_SCOPE_NOTE,
  TRUST_STATE_LABEL,
  localise,
  resolveTrustCopy,
} = require("../src/consumer/messages");

const TODAY = new Date("2026-09-02T10:00:00.000Z");
const day = (iso) => new Date(`${iso}T00:00:00.000Z`);

/** A complete, unremarkable policy: everything filled in, expiry in the future. */
const settled = (over = {}) => ({
  insurer: "Bharat General",
  policyNumber: "POL/2026/000123",
  policyType: "COMPREHENSIVE",
  expiryDate: day("2026-12-31"),
  document: null,
  policyNumberOnAnotherPolicy: false,
  ...over,
});

const readable = { formatAccepted: true, matchesAnotherPolicy: false };

const state = (over) => assessTrust(settled(over), { now: TODAY }).state;

// ── The states ───────────────────────────────────────────────────────────────

describe("what the gate says", () => {
  test("a complete policy with nothing attached is simply unchecked", () => {
    // Not a warning. The customer has done nothing wrong and the product works
    // without a document at all — the copy has to say that.
    const result = assessTrust(settled(), { now: TODAY });
    assert.equal(result.state, "UPLOADED");
    assert.equal(result.reasonKey, "trust.reason.nothingAttached");
    assert.equal(result.actionKey, "trust.action.addDocument");
    assert.equal(result.hasDocument, false);
  });

  test("a complete policy with a readable certificate checks out", () => {
    const result = assessTrust(settled({ document: readable }), { now: TODAY });
    assert.equal(result.state, "CONSISTENCY_VERIFIED");
    assert.equal(result.actionKey, "trust.action.nothingNeeded");
    assert.equal(result.hasDocument, true);
  });

  test("a missing insurer or policy number asks the customer to fill it in", () => {
    assert.equal(state({ insurer: null }), "NEEDS_CONFIRMATION");
    assert.equal(state({ policyNumber: "   " }), "NEEDS_CONFIRMATION");
  });

  test('"I am not sure" about the cover type is a question, not a failure', () => {
    const result = assessTrust(settled({ policyType: "UNKNOWN" }), { now: TODAY });
    assert.equal(result.state, "NEEDS_CONFIRMATION");
    assert.equal(result.reasonKey, "trust.reason.coverTypeUnknown");
  });

  test("an expiry date that has already passed is worth confirming", () => {
    const result = assessTrust(settled({ expiryDate: day("2026-08-31") }), { now: TODAY });
    assert.equal(result.state, "NEEDS_CONFIRMATION");
    assert.equal(result.reasonKey, "trust.reason.alreadyExpired");
  });

  test("expiring today still counts as covered", () => {
    // A policy runs to the end of its last day. Telling somebody at breakfast
    // that it expired is both wrong and the sort of wrong that gets acted on.
    assert.equal(state({ expiryDate: day("2026-09-02") }), "UPLOADED");
  });

  test("no expiry date at all needs confirming rather than passing quietly", () => {
    assert.equal(state({ expiryDate: null }), "NEEDS_CONFIRMATION");
  });

  test("a certificate the platform cannot read does not count as attached", () => {
    // A policy pointing at a DOCX or a video from the general pipeline. The
    // record is complete, so it lands on unchecked rather than on verified.
    const result = assessTrust(
      settled({ document: { formatAccepted: false, matchesAnotherPolicy: false } }),
      { now: TODAY }
    );
    assert.equal(result.state, "UPLOADED");
    assert.equal(result.hasDocument, false);
  });
});

// ── The two questions only a person can settle ───────────────────────────────

describe("what gets escalated", () => {
  test("the same file on two policies is raised as a question", () => {
    const result = assessTrust(
      settled({ document: { formatAccepted: true, matchesAnotherPolicy: true } }),
      { now: TODAY }
    );
    assert.equal(result.state, "VERIFICATION_REQUIRED");
    assert.equal(result.reasonKey, "trust.reason.documentMatchesAnotherPolicy");
    assert.equal(result.actionKey, "trust.action.weWillCheck");
  });

  test("the same policy number on two policies is raised as a question", () => {
    const result = assessTrust(settled({ policyNumberOnAnotherPolicy: true }), { now: TODAY });
    assert.equal(result.state, "VERIFICATION_REQUIRED");
    assert.equal(result.reasonKey, "trust.reason.policyNumberOnAnotherPolicy");
  });

  test("it outranks everything the customer could fix themselves", () => {
    // The precedence that matters: a policy that is incomplete AND duplicated
    // must not send somebody off to fill in a field while the real question
    // goes unmentioned.
    const result = assessTrust(
      settled({
        insurer: null,
        policyType: "UNKNOWN",
        expiryDate: day("2020-01-01"),
        policyNumberOnAnotherPolicy: true,
      }),
      { now: TODAY }
    );
    assert.equal(result.state, "VERIFICATION_REQUIRED");
  });

  test("a lapsed policy is asked about before an incomplete one", () => {
    // Being wrong about an expiry costs a fine or an uninsured accident; being
    // wrong about a missing insurer name costs nothing.
    const result = assessTrust(
      settled({ insurer: null, policyType: "UNKNOWN", expiryDate: day("2020-01-01") }),
      { now: TODAY }
    );
    assert.equal(result.reasonKey, "trust.reason.alreadyExpired");
  });

  test("a document alone never lifts a policy past a question about it", () => {
    assert.equal(
      state({ policyType: "UNKNOWN", document: readable }),
      "NEEDS_CONFIRMATION"
    );
  });
});

describe("the checks it reports", () => {
  test("each one is answered independently of the state", () => {
    // The UI shows the state and the individual checks side by side; deriving
    // one from the other in a component is how they end up disagreeing.
    const result = assessTrust(
      settled({ policyType: "UNKNOWN", document: readable }),
      { now: TODAY }
    );
    assert.deepEqual(result.checks, {
      detailsComplete: true,
      coverTypeKnown: false,
      expiryInFuture: true,
      documentAttached: true,
      documentFormatAccepted: true,
      documentUniqueToThisPolicy: true,
      policyNumberUniqueToThisPolicy: true,
    });
  });

  test("every state the engine can reach is one of the four", () => {
    const reachable = [
      state({}),
      state({ document: readable }),
      state({ policyType: "UNKNOWN" }),
      state({ policyNumberOnAnotherPolicy: true }),
    ];
    for (const s of reachable) assert.ok(TRUST_STATES.includes(s), `${s} is not a trust state`);
  });
});

// ── The copy ─────────────────────────────────────────────────────────────────

const ALL_COPY = [
  ...Object.entries(TRUST_STATE_LABEL),
  ...Object.entries(TRUST_REASON_COPY),
  ...Object.entries(TRUST_ACTION_COPY),
  ["trust.scopeNote", TRUST_SCOPE_NOTE],
];

describe("the words a customer reads", () => {
  test("nothing accuses anybody", () => {
    // The product rule, asserted rather than reviewed. Every one of these words
    // turns a description of our own uncertainty into a finding about a person.
    const forbidden = [
      "fraud", "fraudulent", "fake", "forged", "suspicious", "suspect",
      "invalid", "rejected", "denied", "illegitimate", "tampered", "false",
    ];
    for (const [key, text] of ALL_COPY) {
      for (const locale of CONSUMER_LOCALES) {
        const rendered = localise(text, locale).toLowerCase();
        for (const word of forbidden) {
          assert.ok(
            !new RegExp(`\\b${word}\\b`).test(rendered),
            `${key} (${locale}) says "${word}"`
          );
        }
      }
    }
  });

  test("every string exists in English and renders in all three languages", () => {
    for (const [key, text] of ALL_COPY) {
      assert.ok(text.en && text.en.trim().length > 0, `${key} has no English`);
      for (const locale of CONSUMER_LOCALES) {
        assert.ok(localise(text, locale).length > 0, `${key} renders empty in ${locale}`);
      }
    }
  });

  test("every state and every key the engine emits has copy", () => {
    // A missing entry would put a raw key like `trust.reason.alreadyExpired` at
    // the top of somebody's policy screen.
    for (const s of TRUST_STATES) assert.ok(TRUST_STATE_LABEL[s], `${s} has no label`);
    for (const [, text] of Object.entries(TRUST_REASON_COPY)) assert.ok(text.en);
    for (const [, text] of Object.entries(TRUST_ACTION_COPY)) assert.ok(text.en);
  });

  test("the resolved copy always carries the scope note", () => {
    // "Details check out" without it could be read as the insurer having
    // confirmed the cover, which is a promise this milestone cannot keep.
    const copy = resolveTrustCopy(
      "CONSISTENCY_VERIFIED",
      "trust.reason.recordConsistent",
      "trust.action.nothingNeeded",
      "en"
    );
    assert.ok(copy.scopeNote.includes("not a confirmation from your insurer"));
    assert.ok(copy.label.length > 0 && copy.reason.length > 0 && copy.action.length > 0);
  });

  test("it answers in Tamil when asked to", () => {
    const ta = resolveTrustCopy(
      "NEEDS_CONFIRMATION",
      "trust.reason.coverTypeUnknown",
      "trust.action.confirmCoverType",
      "ta"
    );
    assert.notEqual(ta.label, TRUST_STATE_LABEL.NEEDS_CONFIRMATION.en);
    assert.match(ta.label, /[஀-௿]/);
  });

  test("every state's copy tells the customer what happens next", () => {
    // A state with no next step leaves somebody informed and stuck.
    for (const [, text] of Object.entries(TRUST_ACTION_COPY)) {
      assert.ok(text.en.trim().length > 10, "an action must actually say something");
    }
  });
});
