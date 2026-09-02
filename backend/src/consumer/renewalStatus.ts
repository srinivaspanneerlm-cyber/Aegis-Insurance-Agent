/**
 * The renewal status engine.
 *
 * One question, answered the same way everywhere: given a policy's expiry date
 * and the moment it is being asked, how much time is left and how urgent is it?
 *
 * It lives here rather than in a component because the answer drives four
 * different things — what a customer is told, how an operations queue is
 * sorted, when a reminder is worth sending, and what the audit trail says the
 * urgency was at the time. Computed in the browser it would have been four
 * subtly different answers, and the disagreements would have surfaced as a
 * customer being told "Active" on a policy an operator was chasing as urgent.
 *
 * Three properties are load-bearing and are what the tests actually assert:
 *
 *   • **Deterministic.** The clock is injected. Nothing here reads `Date.now()`
 *     on its own, so a band boundary is testable rather than something you wait
 *     until tomorrow to observe.
 *   • **Calendar arithmetic, not elapsed time.** "Seven days left" is a count of
 *     dates on a wall calendar, not a division by 86,400,000. A policy expiring
 *     tomorrow is one day away whether it is now 00:05 or 23:55, and a customer
 *     told "0 days" at breakfast and "1 day" at midnight would rightly stop
 *     trusting the number.
 *   • **Honest about not knowing.** A missing or unparseable expiry returns a
 *     typed failure, never a guess and never a zero. `ok: false` cannot be read
 *     as `ACTIVE` by accident, because the fields simply are not there.
 *
 * This is deliberately NOT `src/intelligence/renewal.ts`. That module forecasts,
 * per domain, when it is worth *contacting* somebody about a renewal, and
 * explains its reasoning. This one classifies a date into the five bands the
 * consumer product is specified in terms of. They answer different questions and
 * are not merged.
 */
import { CONSUMER } from "../config/constants";

// ── The vocabulary ───────────────────────────────────────────────────────────

export const RENEWAL_STATUSES = [
  "ACTIVE",
  "RENEWAL_COMING_SOON",
  "ACTION_SOON",
  "URGENT_RENEWAL",
  "POLICY_MAY_BE_EXPIRED",
] as const;

export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

/**
 * How much this needs somebody's attention.
 *
 * Separate from the status because they are read by different people. A
 * customer reads the status; an operations queue sorts on the urgency, and it
 * needs an ordering that a string like "ACTION_SOON" does not carry.
 */
export const URGENCY_LEVELS = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

/** Sort key for a queue. Higher is more urgent. */
export const URGENCY_RANK: Record<UrgencyLevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export type RenewalMessageKey =
  | "renewal.status.active"
  | "renewal.status.comingSoon"
  | "renewal.status.actionSoon"
  | "renewal.status.urgent"
  | "renewal.status.mayBeExpired"
  | "renewal.status.unknown";

export type RenewalActionKey =
  | "renewal.action.noneNeeded"
  | "renewal.action.reviewCover"
  | "renewal.action.startRenewal"
  | "renewal.action.renewNow"
  | "renewal.action.checkImmediately"
  | "renewal.action.addExpiryDate";

// ── The bands ────────────────────────────────────────────────────────────────

interface Band {
  readonly status: RenewalStatus;
  readonly urgency: UrgencyLevel;
  /**
   * Inclusive floor, in days remaining. A band's ceiling is implied by the one
   * above it, so the boundaries cannot be written inconsistently — there is
   * only one number per band to get wrong, and a test pins each of them.
   */
  readonly minDaysRemaining: number;
  /** What a person reads. Fixed by the product specification. */
  readonly displayLabel: string;
  readonly messageKey: RenewalMessageKey;
  readonly nextActionKey: RenewalActionKey;
}

/**
 * Ordered from most time remaining to least. `classify` takes the first match,
 * so this order is part of the logic and not merely presentational.
 *
 * The thresholds are the product specification, not a deployment setting. They
 * are deliberately not read from the environment: a band silently widened in
 * one deployment would mean two customers with identical policies were told
 * different things, and nothing in the record would explain why.
 */
export const RENEWAL_BANDS: readonly Band[] = [
  {
    status: "ACTIVE",
    urgency: "NONE",
    minDaysRemaining: 61,
    displayLabel: "Active",
    messageKey: "renewal.status.active",
    nextActionKey: "renewal.action.noneNeeded",
  },
  {
    status: "RENEWAL_COMING_SOON",
    urgency: "LOW",
    minDaysRemaining: 31,
    displayLabel: "Renewal Coming Soon",
    messageKey: "renewal.status.comingSoon",
    nextActionKey: "renewal.action.reviewCover",
  },
  {
    status: "ACTION_SOON",
    urgency: "MEDIUM",
    minDaysRemaining: 8,
    displayLabel: "Action Soon",
    messageKey: "renewal.status.actionSoon",
    nextActionKey: "renewal.action.startRenewal",
  },
  {
    status: "URGENT_RENEWAL",
    urgency: "HIGH",
    minDaysRemaining: 1,
    displayLabel: "Urgent Renewal",
    messageKey: "renewal.status.urgent",
    nextActionKey: "renewal.action.renewNow",
  },
  {
    // Expiry today counts here, not in URGENT_RENEWAL. Cover normally ends at
    // the start of the expiry date, so telling somebody they have "1 day" on
    // the day itself would be telling them they are covered when they may not
    // be. "May be expired" is the honest phrasing: we know the date, we do not
    // know the hour the insurer used.
    status: "POLICY_MAY_BE_EXPIRED",
    urgency: "CRITICAL",
    minDaysRemaining: Number.NEGATIVE_INFINITY,
    displayLabel: "Policy May Be Expired",
    messageKey: "renewal.status.mayBeExpired",
    nextActionKey: "renewal.action.checkImmediately",
  },
];

/** Which band a day count falls in. Total: every integer matches exactly one. */
export function classify(daysRemaining: number): Band {
  // The final band's floor is -Infinity, so this always finds one. The
  // non-null assertion would be a lie in any other arrangement; here the array
  // is a module constant and the property is checked by a test.
  return RENEWAL_BANDS.find((band) => daysRemaining >= band.minDaysRemaining) as Band;
}

// ── Calendar arithmetic ──────────────────────────────────────────────────────

interface CivilDate {
  readonly year: number;
  readonly month: number; // 1–12
  readonly day: number; // 1–31
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Whether the runtime recognises this IANA zone name. */
export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    // Intl throws RangeError for an unknown zone. Anything else is also a
    // reason not to trust it.
    return false;
  }
}

/**
 * What day it is, where the customer is.
 *
 * `en-CA` is chosen because it formats as `YYYY-MM-DD`, which parses back
 * without ambiguity about which number is the month — a locale that emits
 * `01/09/2026` would silently mean two different dates depending on the host.
 */
function civilDateInZone(instant: Date, timeZone: string): CivilDate | null {
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return null;
  }

  const match = DATE_ONLY.exec(formatted);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/**
 * The expiry, as a calendar date.
 *
 * Read in **UTC**, deliberately, while "today" above is read in the customer's
 * zone. That asymmetry is the correct one: an expiry is a date printed on a
 * certificate, not an instant, and this platform stores such a date as UTC
 * midnight. Reading it back in a local zone would move it a day in every zone
 * behind UTC — a policy expiring on the 1st would read as the 31st for anyone
 * west of Greenwich, and the whole flow would be off by one for them.
 *
 * A bare `YYYY-MM-DD` string skips instant parsing altogether, so it means the
 * same date no matter where it is read.
 */
function expiryCivilDate(value: Date | string): CivilDate | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;

    const dateOnly = DATE_ONLY.exec(trimmed);
    if (dateOnly) {
      const candidate = {
        year: Number(dateOnly[1]),
        month: Number(dateOnly[2]),
        day: Number(dateOnly[3]),
      };
      // `2026-02-31` matches the pattern and is not a date. Round-tripping
      // through Date.UTC is what catches it: the components come back changed.
      const roundTrip = new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day));
      if (
        roundTrip.getUTCFullYear() !== candidate.year ||
        roundTrip.getUTCMonth() + 1 !== candidate.month ||
        roundTrip.getUTCDate() !== candidate.day
      ) {
        return null;
      }
      return candidate;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return utcCivilDate(parsed);
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return utcCivilDate(value);
}

const utcCivilDate = (instant: Date): CivilDate => ({
  year: instant.getUTCFullYear(),
  month: instant.getUTCMonth() + 1,
  day: instant.getUTCDate(),
});

/**
 * Days since the epoch for a calendar date.
 *
 * Projecting both dates onto UTC midnights before subtracting is what makes the
 * difference DST-proof. Subtracting two local instants across a clock change
 * yields 23 or 25 hours and rounds to the wrong day roughly twice a year, in
 * whichever direction is least convenient.
 */
const toEpochDay = (date: CivilDate): number =>
  Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;

/** `YYYY-MM-DD`, for a payload or a log line. */
const formatCivilDate = (date: CivilDate): string =>
  `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

// ── The result ───────────────────────────────────────────────────────────────

/**
 * Why no assessment could be made.
 *
 * Distinguished rather than collapsed into one "invalid", because they need
 * different responses: a policy with no expiry needs the customer to supply
 * one, while an unparseable value or a bad zone is our problem and not theirs.
 */
export type RenewalFailureReason = "MISSING_EXPIRY" | "INVALID_EXPIRY" | "UNKNOWN_TIMEZONE";

export interface RenewalAssessed {
  readonly ok: true;
  readonly status: RenewalStatus;
  /** Calendar days from today to expiry. Zero on the day, negative after it. */
  readonly daysRemaining: number;
  readonly urgency: UrgencyLevel;
  readonly displayLabel: string;
  readonly messageKey: RenewalMessageKey;
  readonly nextActionKey: RenewalActionKey;
  /** The customer's calendar day this was assessed on, `YYYY-MM-DD`. */
  readonly evaluatedOn: string;
  /** The expiry as a calendar date, `YYYY-MM-DD`. */
  readonly expiresOn: string;
  readonly timeZone: string;
}

export interface RenewalUnknown {
  readonly ok: false;
  readonly reason: RenewalFailureReason;
  readonly messageKey: "renewal.status.unknown";
  readonly nextActionKey: "renewal.action.addExpiryDate";
}

/**
 * A discriminated union, so `ok` has to be checked before anything else can be
 * read. A shape with optional fields would have let `assessment.status` compile
 * on a failure and be `undefined` at runtime, which is exactly the bug this
 * engine exists to prevent.
 */
export type RenewalAssessment = RenewalAssessed | RenewalUnknown;

const unknown = (reason: RenewalFailureReason): RenewalUnknown => ({
  ok: false,
  reason,
  messageKey: "renewal.status.unknown",
  nextActionKey: "renewal.action.addExpiryDate",
});

export interface AssessOptions {
  /** The moment to assess against. Injected so tests own the clock. */
  readonly now?: Date;
  /** IANA zone the customer's calendar day is read in. */
  readonly timeZone?: string;
}

/**
 * Assess a policy's renewal readiness.
 *
 * Never throws. Every failure the caller could provoke — a null date, a typo in
 * a zone name, February the 31st — comes back as `ok: false` with a reason,
 * because this runs inside a page a worried customer is looking at and an
 * exception there costs them the whole screen.
 */
export function assessRenewal(
  expiry: Date | string | null | undefined,
  options: AssessOptions = {}
): RenewalAssessment {
  const timeZone = options.timeZone ?? CONSUMER.TIMEZONE;
  const now = options.now ?? new Date();

  if (expiry === null || expiry === undefined) return unknown("MISSING_EXPIRY");
  if (!isSupportedTimeZone(timeZone)) return unknown("UNKNOWN_TIMEZONE");
  if (Number.isNaN(now.getTime())) return unknown("INVALID_EXPIRY");

  const today = civilDateInZone(now, timeZone);
  if (!today) return unknown("UNKNOWN_TIMEZONE");

  const expiresOn = expiryCivilDate(expiry);
  if (!expiresOn) return unknown("INVALID_EXPIRY");

  const daysRemaining = toEpochDay(expiresOn) - toEpochDay(today);
  const band = classify(daysRemaining);

  return {
    ok: true,
    status: band.status,
    daysRemaining,
    urgency: band.urgency,
    displayLabel: band.displayLabel,
    messageKey: band.messageKey,
    nextActionKey: band.nextActionKey,
    evaluatedOn: formatCivilDate(today),
    expiresOn: formatCivilDate(expiresOn),
    timeZone,
  };
}
