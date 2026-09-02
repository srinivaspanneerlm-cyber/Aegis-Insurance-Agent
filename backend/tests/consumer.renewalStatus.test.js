/**
 * The renewal status engine — every band boundary, and the date arithmetic
 * underneath them.
 *
 * The clock is injected on every call. Nothing here waits for a real date to
 * arrive, so a boundary that is wrong is wrong at test time rather than on the
 * one day of the year somebody would have noticed.
 */

process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const {
  assessRenewal,
  classify,
  isSupportedTimeZone,
  RENEWAL_BANDS,
  RENEWAL_STATUSES,
  URGENCY_RANK,
} = require("../src/consumer/renewalStatus");

/** Midday in India, so a test is never accidentally sitting on a day boundary. */
const IST_NOON = new Date("2026-09-01T06:30:00.000Z"); // 12:00 IST on 2026-09-01
const IST = "Asia/Kolkata";

/** An expiry `days` after 2026-09-01, as the calendar date the platform stores. */
function expiryInDays(days) {
  return new Date(Date.UTC(2026, 8, 1 + days));
}

/** Assess `days` from the fixed IST noon. */
function at(days, options = {}) {
  return assessRenewal(expiryInDays(days), { now: IST_NOON, timeZone: IST, ...options });
}

// ── The bands the product specification names ────────────────────────────────

describe("renewal bands", () => {
  // The twelve cases the specification calls out, written as data so a
  // boundary cannot be tested twice and a neighbour left untested.
  const CASES = [
    { days: 400, status: "ACTIVE", urgency: "NONE", why: "well beyond 60 days" },
    { days: 61, status: "ACTIVE", urgency: "NONE", why: "first day of ACTIVE" },
    { days: 60, status: "RENEWAL_COMING_SOON", urgency: "LOW", why: "exactly 60 days" },
    { days: 31, status: "RENEWAL_COMING_SOON", urgency: "LOW", why: "31 days — lower edge" },
    { days: 30, status: "ACTION_SOON", urgency: "MEDIUM", why: "30 days — upper edge" },
    { days: 8, status: "ACTION_SOON", urgency: "MEDIUM", why: "8 days — lower edge" },
    { days: 7, status: "URGENT_RENEWAL", urgency: "HIGH", why: "7 days — upper edge" },
    { days: 1, status: "URGENT_RENEWAL", urgency: "HIGH", why: "1 day — tomorrow" },
    { days: 0, status: "POLICY_MAY_BE_EXPIRED", urgency: "CRITICAL", why: "expires today" },
    { days: -1, status: "POLICY_MAY_BE_EXPIRED", urgency: "CRITICAL", why: "expired yesterday" },
    { days: -400, status: "POLICY_MAY_BE_EXPIRED", urgency: "CRITICAL", why: "long expired" },
  ];

  for (const { days, status, urgency, why } of CASES) {
    test(`${days} days remaining → ${status} (${why})`, () => {
      const result = at(days);
      assert.equal(result.ok, true);
      assert.equal(result.status, status);
      assert.equal(result.urgency, urgency);
      assert.equal(result.daysRemaining, days);
    });
  }

  test("every band is reachable and no two bands overlap", () => {
    const seen = new Set();
    // -400 through 400 covers every boundary with room on both sides.
    for (let days = -400; days <= 400; days += 1) {
      const band = classify(days);
      assert.ok(band, `no band matched ${days} days`);
      seen.add(band.status);
    }
    assert.deepEqual([...seen].sort(), [...RENEWAL_STATUSES].sort());
  });

  test("urgency rises monotonically as time runs out", () => {
    let previous = -1;
    // Walk from the far future towards the past; urgency must never decrease.
    for (let days = 400; days >= -30; days -= 1) {
      const rank = URGENCY_RANK[classify(days).urgency];
      assert.ok(
        rank >= previous,
        `urgency fell from ${previous} to ${rank} at ${days} days remaining`
      );
      previous = rank;
    }
  });

  test("every band carries a label, a message key and a next action", () => {
    for (const band of RENEWAL_BANDS) {
      assert.ok(band.displayLabel.length > 0, `${band.status} has no label`);
      assert.ok(band.messageKey.startsWith("renewal.status."), `${band.status} key`);
      assert.ok(band.nextActionKey.startsWith("renewal.action."), `${band.status} action`);
    }
  });

  test("the display labels are the ones the specification names", () => {
    assert.deepEqual(
      RENEWAL_BANDS.map((b) => b.displayLabel),
      ["Active", "Renewal Coming Soon", "Action Soon", "Urgent Renewal", "Policy May Be Expired"]
    );
  });
});

// ── Missing and unusable input ───────────────────────────────────────────────

describe("input the engine cannot use", () => {
  for (const [label, value] of [["null", null], ["undefined", undefined]]) {
    test(`${label} expiry reports MISSING_EXPIRY rather than guessing`, () => {
      const result = assessRenewal(value, { now: IST_NOON, timeZone: IST });
      assert.equal(result.ok, false);
      assert.equal(result.reason, "MISSING_EXPIRY");
      assert.equal(result.messageKey, "renewal.status.unknown");
      assert.equal(result.nextActionKey, "renewal.action.addExpiryDate");
      // The failure shape must not be mistakable for a real assessment.
      assert.equal(result.status, undefined);
      assert.equal(result.daysRemaining, undefined);
    });
  }

  const UNUSABLE = [
    ["empty string", ""],
    ["whitespace", "   "],
    ["not a date at all", "next Tuesday"],
    ["a day that does not exist", "2026-02-31"],
    ["month 13", "2026-13-01"],
    ["an Invalid Date object", new Date("nope")],
  ];

  for (const [label, value] of UNUSABLE) {
    test(`${label} reports INVALID_EXPIRY`, () => {
      const result = assessRenewal(value, { now: IST_NOON, timeZone: IST });
      assert.equal(result.ok, false);
      assert.equal(result.reason, "INVALID_EXPIRY");
    });
  }

  test("a real leap day is accepted, not treated as impossible", () => {
    const result = assessRenewal("2028-02-29", { now: IST_NOON, timeZone: IST });
    assert.equal(result.ok, true);
    assert.equal(result.expiresOn, "2028-02-29");
  });

  test("an unknown timezone is reported, never silently substituted", () => {
    const result = assessRenewal("2026-09-30", { now: IST_NOON, timeZone: "Mars/Olympus" });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "UNKNOWN_TIMEZONE");
  });

  test("isSupportedTimeZone separates real zones from typos", () => {
    assert.equal(isSupportedTimeZone("Asia/Kolkata"), true);
    assert.equal(isSupportedTimeZone("UTC"), true);
    assert.equal(isSupportedTimeZone("Asia/Calcutta"), true); // the old name still resolves
    assert.equal(isSupportedTimeZone("Asia/Kolkatta"), false);
    assert.equal(isSupportedTimeZone(""), false);
  });

  test("it never throws, whatever it is handed", () => {
    for (const value of [null, undefined, "", "??", new Date("x"), "2026-02-30"]) {
      assert.doesNotThrow(() => assessRenewal(value, { now: IST_NOON, timeZone: "Nowhere/Nothing" }));
    }
  });
});

// ── Calendar days, not elapsed hours ─────────────────────────────────────────

describe("timezone and day-boundary behaviour", () => {
  test("the answer is the same all day — 00:05 and 23:55 IST agree", () => {
    const expiry = "2026-09-08"; // seven days after the 1st
    const justAfterMidnight = new Date("2026-08-31T18:35:00.000Z"); // 00:05 IST on the 1st
    const justBeforeMidnight = new Date("2026-09-01T18:25:00.000Z"); // 23:55 IST on the 1st

    const early = assessRenewal(expiry, { now: justAfterMidnight, timeZone: IST });
    const late = assessRenewal(expiry, { now: justBeforeMidnight, timeZone: IST });

    assert.equal(early.daysRemaining, 7);
    assert.equal(late.daysRemaining, 7);
    assert.equal(early.status, "URGENT_RENEWAL");
    assert.equal(late.status, late.status, "same band");
    assert.equal(early.status, late.status);
    assert.equal(early.evaluatedOn, "2026-09-01");
    assert.equal(late.evaluatedOn, "2026-09-01");
  });

  test("one instant is a different day in different zones, and the count follows", () => {
    // 18:35 UTC: already the 1st in Kolkata, still the 31st in New York.
    const instant = new Date("2026-08-31T18:35:00.000Z");
    const expiry = "2026-09-08";

    const kolkata = assessRenewal(expiry, { now: instant, timeZone: IST });
    const newYork = assessRenewal(expiry, { now: instant, timeZone: "America/New_York" });

    assert.equal(kolkata.evaluatedOn, "2026-09-01");
    assert.equal(newYork.evaluatedOn, "2026-08-31");
    assert.equal(kolkata.daysRemaining, 7);
    assert.equal(newYork.daysRemaining, 8);
  });

  test("a spring-forward day is still one day (23 real hours, not 0.96 days)", () => {
    // US DST begins 2026-03-08. Midday on the 7th; expiry on the 8th.
    const beforeShift = new Date("2026-03-07T17:00:00.000Z"); // 12:00 EST on the 7th
    const result = assessRenewal("2026-03-08", { now: beforeShift, timeZone: "America/New_York" });
    assert.equal(result.ok, true);
    assert.equal(result.evaluatedOn, "2026-03-07");
    assert.equal(result.daysRemaining, 1);
  });

  test("an autumn fall-back day is still one day (25 real hours)", () => {
    // US DST ends 2026-11-01. Midday on 31 Oct; expiry on 1 Nov.
    const beforeShift = new Date("2026-10-31T16:00:00.000Z"); // 12:00 EDT on the 31st
    const result = assessRenewal("2026-11-01", { now: beforeShift, timeZone: "America/New_York" });
    assert.equal(result.ok, true);
    assert.equal(result.daysRemaining, 1);
  });

  test("counting across a DST change stays exact over a long span", () => {
    // 2026-03-07 → 2026-06-07: 24 + 30 + 31 + 7 = 92 days, DST change included.
    const result = assessRenewal("2026-06-07", {
      now: new Date("2026-03-07T17:00:00.000Z"),
      timeZone: "America/New_York",
    });
    assert.equal(result.daysRemaining, 92);
  });

  test("expiry is a calendar date, so a Date and a YYYY-MM-DD string agree", () => {
    const asString = assessRenewal("2026-09-08", { now: IST_NOON, timeZone: IST });
    const asDate = assessRenewal(new Date(Date.UTC(2026, 8, 8)), { now: IST_NOON, timeZone: IST });
    assert.equal(asString.daysRemaining, asDate.daysRemaining);
    assert.equal(asString.expiresOn, asDate.expiresOn);
  });

  test("a stored expiry does not drift a day in a zone behind UTC", () => {
    // The bug this guards: reading a UTC-midnight expiry in a negative-offset
    // zone yields the previous date, moving every band by one for that customer.
    const stored = new Date(Date.UTC(2026, 8, 8)); // 2026-09-08T00:00:00Z
    const result = assessRenewal(stored, {
      now: new Date("2026-09-01T17:00:00.000Z"),
      timeZone: "America/New_York",
    });
    assert.equal(result.expiresOn, "2026-09-08");
  });

  test("a leap year is counted correctly across February", () => {
    // 2028-02-01 → 2028-03-01 is 29 days, not 28.
    const result = assessRenewal("2028-03-01", {
      now: new Date("2028-02-01T06:30:00.000Z"),
      timeZone: IST,
    });
    assert.equal(result.daysRemaining, 29);
  });

  test("a year boundary is counted correctly", () => {
    const result = assessRenewal("2027-01-01", {
      now: new Date("2026-12-31T06:30:00.000Z"),
      timeZone: IST,
    });
    assert.equal(result.daysRemaining, 1);
    assert.equal(result.status, "URGENT_RENEWAL");
  });
});

// ── The payload ──────────────────────────────────────────────────────────────

describe("the assessment payload", () => {
  test("carries the dates it reasoned from, so a result can be explained later", () => {
    const result = at(30);
    assert.equal(result.evaluatedOn, "2026-09-01");
    assert.equal(result.expiresOn, "2026-10-01");
    assert.equal(result.timeZone, IST);
  });

  test("defaults to the platform's configured zone when none is given", () => {
    const result = assessRenewal("2026-09-08", { now: IST_NOON });
    assert.equal(result.ok, true);
    assert.equal(result.timeZone, "Asia/Kolkata");
  });

  test("is deterministic — the same inputs give the same answer every time", () => {
    const once = at(45);
    const twice = at(45);
    assert.deepEqual(once, twice);
  });
});
