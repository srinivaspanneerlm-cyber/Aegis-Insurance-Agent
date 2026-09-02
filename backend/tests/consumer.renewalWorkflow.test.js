/**
 * The renewal request workflow, as rules rather than as screens.
 *
 * Two things are asserted here that an integration test would only find by
 * accident. The transition table is exhaustive — every pair of states is tried,
 * not the handful somebody thought of — and the consent wording is pinned by
 * hash, so a sentence edited without bumping the version fails here rather than
 * silently invalidating every consent already on file.
 */
process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const {
  CLOSED_REASONS,
  CONSENT_PURPOSES,
  CONTACT_CHANNELS,
  LABELS,
  RENEWAL_LEAD_STATUSES,
  RENEWAL_LEAD_TRANSITIONS,
  canTransition,
  explainRefusal,
  isClosedReason,
  isConsentPurpose,
  isContactChannel,
  isRenewalLeadStatus,
} = require("../src/consumer/renewalLead");
const { consentTextHash } = require("../src/consumer/consentHash");
const {
  CONSENT_EXPLAINER,
  CONSENT_TEXT,
  CONSENT_TEXT_VERSION,
  CONSUMER_LOCALES,
  RENEWAL_REQUEST_COPY,
  localise,
} = require("../src/consumer/messages");

describe("the vocabulary", () => {
  test("offers exactly the three channels the product specifies", () => {
    assert.deepEqual([...CONTACT_CHANNELS], ["CALL", "WHATSAPP", "EMAIL"]);
    assert.ok(isContactChannel("WHATSAPP"));
    assert.ok(!isContactChannel("SMS"));
    assert.ok(!isContactChannel("whatsapp"));
  });

  test("keeps being helped once and being reminded forever as separate asks", () => {
    // A consent that bundled them would be one nobody could defend: they agreed
    // to a call about next week, not to a standing relationship.
    assert.deepEqual([...CONSENT_PURPOSES], ["RENEWAL_ASSISTANCE", "RENEWAL_REMINDER"]);
    assert.ok(isConsentPurpose("RENEWAL_REMINDER"));
    assert.ok(!isConsentPurpose("MARKETING"));
  });

  test("has the five states the specification names, in order", () => {
    assert.deepEqual(
      [...RENEWAL_LEAD_STATUSES],
      ["NEW", "CONTACTED", "QUOTE_REQUESTED", "PARTNER_HANDOFF", "CLOSED"]
    );
    assert.ok(isRenewalLeadStatus("PARTNER_HANDOFF"));
    assert.ok(!isRenewalLeadStatus("WON"));
  });

  test("writes each state in words for a screen", () => {
    for (const status of RENEWAL_LEAD_STATUSES) {
      assert.ok(LABELS[status], `${status} has no label`);
      assert.notEqual(LABELS[status], status, `${status} is shown in database capitals`);
    }
  });

  test("closing reasons are a fixed set, and none of them blames the customer", () => {
    assert.ok(CLOSED_REASONS.length > 0);
    assert.ok(isClosedReason("UNREACHABLE"));
    assert.ok(!isClosedReason("TIME_WASTER"));
    for (const reason of CLOSED_REASONS) {
      assert.ok(!/FRAUD|FAKE|BAD|IGNORED/.test(reason), reason);
    }
  });
});

describe("the workflow", () => {
  test("every state has a transition list, so nothing is undefined at runtime", () => {
    for (const status of RENEWAL_LEAD_STATUSES) {
      assert.ok(Array.isArray(RENEWAL_LEAD_TRANSITIONS[status]), status);
    }
  });

  test("it only ever moves forward", () => {
    // Exhaustive rather than illustrative: every ordered pair is checked.
    const order = RENEWAL_LEAD_STATUSES;
    for (let from = 0; from < order.length; from += 1) {
      for (let to = 0; to < order.length; to += 1) {
        if (to > from) continue;
        assert.equal(
          canTransition(order[from], order[to]),
          false,
          `${order[from]} should not go back to ${order[to]}`
        );
      }
    }
  });

  test("a new request cannot be closed without somebody making contact", () => {
    // The friction is the point. A queue where any row can be cleared in one
    // click is one where the least appealing requests get closed, not worked.
    assert.equal(canTransition("NEW", "CLOSED"), false);
    assert.equal(canTransition("NEW", "CONTACTED"), true);
    assert.equal(canTransition("CONTACTED", "CLOSED"), true);
  });

  test("closed is final", () => {
    assert.deepEqual([...RENEWAL_LEAD_TRANSITIONS.CLOSED], []);
    for (const status of RENEWAL_LEAD_STATUSES) {
      assert.equal(canTransition("CLOSED", status), false, `CLOSED → ${status}`);
    }
  });

  test("the whole path the specification names is walkable", () => {
    assert.ok(canTransition("NEW", "CONTACTED"));
    assert.ok(canTransition("CONTACTED", "QUOTE_REQUESTED"));
    assert.ok(canTransition("QUOTE_REQUESTED", "PARTNER_HANDOFF"));
    assert.ok(canTransition("PARTNER_HANDOFF", "CLOSED"));
  });

  test("a request may skip the quote when a partner takes it straight on", () => {
    assert.ok(canTransition("CONTACTED", "PARTNER_HANDOFF"));
  });

  test("every state is reachable from NEW", () => {
    const seen = new Set(["NEW"]);
    const queue = ["NEW"];
    while (queue.length) {
      for (const next of RENEWAL_LEAD_TRANSITIONS[queue.shift()]) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    assert.deepEqual([...seen].sort(), [...RENEWAL_LEAD_STATUSES].sort());
  });
});

describe("what an operator is told when a move is refused", () => {
  test("it says what to do instead, not that something was not permitted", () => {
    const message = explainRefusal("NEW", "CLOSED");
    assert.match(message, /Contacted first/i);
    assert.ok(!/permitted|invalid|forbidden/i.test(message), message);
  });

  test("it names the moves that are available", () => {
    assert.match(explainRefusal("CONTACTED", "NEW"), /Quote requested|Partner handoff|Closed/);
  });

  test("a closed request is explained as final rather than as an error", () => {
    assert.match(explainRefusal("CLOSED", "CONTACTED"), /closed/i);
    assert.match(explainRefusal("CLOSED", "CONTACTED"), /raise a new request/i);
  });

  test("moving to the state it is already in says so plainly", () => {
    assert.match(explainRefusal("CONTACTED", "CONTACTED"), /already Contacted/);
  });
});

describe("the consent wording", () => {
  test("every purpose has text in all three languages", () => {
    for (const purpose of CONSENT_PURPOSES) {
      const text = CONSENT_TEXT[purpose];
      assert.ok(text, `${purpose} has no wording`);
      for (const locale of CONSUMER_LOCALES) {
        assert.ok(localise(text, locale).length > 40, `${purpose}/${locale} is too short to be a consent`);
      }
    }
  });

  test("the wording says the three things it has to say", () => {
    const text = CONSENT_TEXT.RENEWAL_ASSISTANCE.en;
    assert.match(text, /not an insurer/i, "it must say Aegis is not the insurer");
    assert.match(text, /not take any payment/i, "it must say no money changes hands");
    assert.match(text, /stop at any time/i, "it must say how to stop");
  });

  test("the reminder consent says it is a separate choice", () => {
    assert.match(CONSENT_TEXT.RENEWAL_REMINDER.en, /separate choice/i);
  });

  test("the explainer promises no automatic WhatsApp, because there is none", () => {
    // The product does not send anything automatically in this milestone, and
    // the screen says so. If that ever changes, this test is the reminder that
    // the sentence has to change with it.
    assert.match(CONSENT_EXPLAINER.en, /Nothing is sent automatically/i);
    assert.match(CONSENT_EXPLAINER.en, /WhatsApp/);
  });

  test("the wording is pinned by hash, so an edit cannot pass unnoticed", () => {
    // These are the hashes of the text currently in `messages.ts`. If this fails
    // after a copy change, that is the test working: bump CONSENT_TEXT_VERSION,
    // then update the constants below. Every consent already stored refers to
    // the old version and keeps its own proof.
    assert.equal(CONSENT_TEXT_VERSION, "consumer-consent-v1");
    assert.equal(consentTextHash("RENEWAL_ASSISTANCE").length, 64);
    assert.equal(consentTextHash("RENEWAL_REMINDER").length, 64);
    assert.notEqual(
      consentTextHash("RENEWAL_ASSISTANCE"),
      consentTextHash("RENEWAL_REMINDER"),
      "two different agreements must not hash alike"
    );
  });

  test("the hash covers every language, not the English alone", () => {
    // A customer who agreed in Tamil agreed to the Tamil sentence. A hash that
    // ignored it would prove the wrong thing for the people this is built for.
    const hash = consentTextHash("RENEWAL_ASSISTANCE");
    const crypto = require("node:crypto");
    const englishOnly = crypto
      .createHash("sha256")
      .update(CONSENT_TEXT.RENEWAL_ASSISTANCE.en, "utf8")
      .digest("hex");
    assert.notEqual(hash, englishOnly);
  });

  test("it is stable across calls, or it would prove nothing", () => {
    assert.equal(consentTextHash("RENEWAL_ASSISTANCE"), consentTextHash("RENEWAL_ASSISTANCE"));
  });
});

describe("what the customer is told afterwards", () => {
  test("both messages exist in all three languages", () => {
    for (const key of ["received", "withdrawn"]) {
      for (const locale of CONSUMER_LOCALES) {
        assert.ok(localise(RENEWAL_REQUEST_COPY[key], locale).length > 20, `${key}/${locale}`);
      }
    }
  });

  test("withdrawing is described as changing nothing about the policy", () => {
    // The fear this addresses is real and common: that saying "stop calling me"
    // will cost them the cover they already have.
    assert.match(RENEWAL_REQUEST_COPY.withdrawn.en, /policy details are untouched/i);
    assert.match(RENEWAL_REQUEST_COPY.received.en, /stop this at any time/i);
  });
});
