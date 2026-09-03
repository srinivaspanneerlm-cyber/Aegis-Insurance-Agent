/**
 * The customer-facing copy.
 *
 * Two things are checked that a review would not reliably catch: that every key
 * the engine can emit actually resolves to something, and that no string here
 * accuses the customer of anything.
 */

process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const {
  CONSUMER_COPY_VERSION,
  CONSUMER_LOCALES,
  GUIDANCE_DISCLAIMER,
  RENEWAL_ACTION_COPY,
  RENEWAL_STATUS_COPY,
  isConsumerLocale,
  localise,
  resolveRenewalCopy,
} = require("../src/consumer/messages");
const { RENEWAL_BANDS, assessRenewal } = require("../src/consumer/renewalStatus");

const ALL_COPY = [
  ...Object.entries(RENEWAL_STATUS_COPY),
  ...Object.entries(RENEWAL_ACTION_COPY),
  ["renewal.disclaimer", GUIDANCE_DISCLAIMER],
];

describe("copy completeness", () => {
  test("every band's message key has copy", () => {
    for (const band of RENEWAL_BANDS) {
      assert.ok(RENEWAL_STATUS_COPY[band.messageKey], `no copy for ${band.messageKey}`);
      assert.ok(RENEWAL_ACTION_COPY[band.nextActionKey], `no copy for ${band.nextActionKey}`);
    }
  });

  test("the failure path's keys have copy too", () => {
    // A policy with no expiry is a case a customer reaches on their first visit.
    const failure = assessRenewal(null, { now: new Date("2026-09-01T06:30:00.000Z") });
    assert.equal(failure.ok, false);
    assert.ok(RENEWAL_STATUS_COPY[failure.messageKey]);
    assert.ok(RENEWAL_ACTION_COPY[failure.nextActionKey]);
  });

  test("English is present everywhere — a locale can fall back, English cannot", () => {
    for (const [key, text] of ALL_COPY) {
      assert.equal(typeof text.en, "string", `${key} has no English`);
      assert.ok(text.en.trim().length > 0, `${key} has empty English`);
    }
  });

  test("Tamil and Thanglish are present for every string", () => {
    for (const [key, text] of ALL_COPY) {
      assert.ok(text.ta && text.ta.trim().length > 0, `${key} has no Tamil`);
      assert.ok(text.taEn && text.taEn.trim().length > 0, `${key} has no Thanglish`);
    }
  });

  test("the Tamil is actually Tamil script, not English left in the slot", () => {
    const tamil = /[஀-௿]/;
    for (const [key, text] of ALL_COPY) {
      assert.ok(tamil.test(text.ta), `${key}'s Tamil contains no Tamil characters`);
    }
  });
});

describe("tone", () => {
  /**
   * The vocabulary this product does not use.
   *
   * A duplicate document or a mismatched date is, far more often than not, a
   * person re-photographing their own paperwork. Language that treats them as a
   * suspect is wrong on the facts and drives away exactly the customer this
   * platform exists to serve.
   */
  const ACCUSATORY = [
    "fraud", "fraudulent", "fake", "forged", "suspicious", "suspect",
    "invalid", "rejected", "denied", "illegitimate", "tampered",
  ];

  test("no customer-facing string accuses the customer", () => {
    for (const [key, text] of ALL_COPY) {
      for (const locale of CONSUMER_LOCALES) {
        const rendered = localise(text, locale).toLowerCase();
        for (const word of ACCUSATORY) {
          assert.ok(
            !new RegExp(`\\b${word}\\b`).test(rendered),
            `${key} (${locale}) contains "${word}"`
          );
        }
      }
    }
  });

  test("every next action tells somebody what to do", () => {
    for (const [key, text] of Object.entries(RENEWAL_ACTION_COPY)) {
      assert.ok(text.en.length > 20, `${key} is too terse to be actionable`);
    }
  });
});

describe("localise", () => {
  const text = { en: "English", ta: "தமிழ்", taEn: "Thanglish" };

  test("returns the requested language", () => {
    assert.equal(localise(text, "en"), "English");
    assert.equal(localise(text, "ta"), "தமிழ்");
    assert.equal(localise(text, "taEn"), "Thanglish");
  });

  test("defaults to English when no locale is given", () => {
    assert.equal(localise(text), "English");
  });

  test("Thanglish falls back to Tamil before English", () => {
    // A Thanglish reader understands the Tamil line; it is the closer of the two.
    assert.equal(localise({ en: "English", ta: "தமிழ்" }, "taEn"), "தமிழ்");
  });

  test("a missing translation degrades to English rather than to an empty label", () => {
    assert.equal(localise({ en: "English" }, "ta"), "English");
    assert.equal(localise({ en: "English" }, "taEn"), "English");
  });

  test("isConsumerLocale rejects anything not in the set", () => {
    assert.equal(isConsumerLocale("ta"), true);
    assert.equal(isConsumerLocale("hi"), false);
    assert.equal(isConsumerLocale(null), false);
    assert.equal(isConsumerLocale(1), false);
  });
});

describe("resolveRenewalCopy", () => {
  test("returns status, next action and disclaimer together", () => {
    const copy = resolveRenewalCopy("renewal.status.urgent", "renewal.action.renewNow", "en");
    assert.ok(copy.status.length > 0);
    assert.ok(copy.nextAction.length > 0);
    assert.equal(copy.disclaimer, GUIDANCE_DISCLAIMER.en);
    assert.equal(copy.copyVersion, CONSUMER_COPY_VERSION);
  });

  test("the disclaimer travels with every result, in every locale", () => {
    // Requirement 11: it is shown with every result. Returning it alongside is
    // what stops a screen omitting it by simply not asking.
    for (const band of RENEWAL_BANDS) {
      for (const locale of CONSUMER_LOCALES) {
        const copy = resolveRenewalCopy(band.messageKey, band.nextActionKey, locale);
        assert.ok(copy.disclaimer.trim().length > 0, `${band.status}/${locale} lost the disclaimer`);
      }
    }
  });

  test("the English disclaimer is the exact wording the specification fixes", () => {
    assert.equal(
      GUIDANCE_DISCLAIMER.en,
      "Guidance only. Exact coverage, eligibility and renewal terms depend on official policy wording and insurer/partner confirmation."
    );
  });
});
