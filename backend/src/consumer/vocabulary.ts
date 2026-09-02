/**
 * The fixed sets a motor policy is described with.
 *
 * Here rather than inline in the validator because three things have to agree
 * about them: the schema that accepts a request, the service that stores it,
 * and the selector a customer picks from. When those three disagree the failure
 * is silent — a customer picks an option the API rejects, and the form says
 * only that something was invalid.
 *
 * The frontend keeps its own copy with the customer-facing labels, and a test
 * there reads this file to check the two have not drifted.
 */

export const VEHICLE_TYPES = ["BIKE", "CAR", "SCOOTER"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const isVehicleType = (value: unknown): value is VehicleType =>
  typeof value === "string" && (VEHICLE_TYPES as readonly string[]).includes(value);

/**
 * What kind of motor cover this is.
 *
 * `UNKNOWN` is a real answer, not a missing one. A customer who cannot tell
 * from their certificate which of these they hold is the single most common
 * case this product exists to serve — most people have never been told the
 * difference — and forcing a guess would put a fiction on their record and then
 * reason from it. Stored honestly, it becomes something Aegis can explain.
 */
export const POLICY_TYPES = ["THIRD_PARTY", "COMPREHENSIVE", "OWN_DAMAGE", "UNKNOWN"] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const isPolicyType = (value: unknown): value is PolicyType =>
  typeof value === "string" && (POLICY_TYPES as readonly string[]).includes(value);

/**
 * Bounds on the free-text fields.
 *
 * Every one of these is stored and later shown back to somebody, so they are
 * bounded at the door — an unbounded string on a form is a way to fill a
 * database and a way to put a page-long "insurer name" on an operator's screen.
 * Generous enough that no real certificate is turned away.
 */
export const FIELD_LIMITS = {
  INSURER: 120,
  POLICY_NUMBER: 60,
  REGISTRATION: 20,
  MAKE: 60,
  MODEL: 60,
} as const;

/**
 * How far ahead or behind an expiry date may plausibly sit.
 *
 * Deliberately wide. This is a sanity bound against a typo like `20265`, not a
 * judgement about whether a policy is real — somebody entering a certificate
 * that lapsed four years ago is exactly who this product is for, and refusing
 * their date would refuse them the answer they came for. Anything unusual
 * within these bounds is the trust gate's business, and its answer is a prompt
 * to confirm rather than a refusal.
 */
export const EXPIRY_BOUNDS = {
  MAX_YEARS_PAST: 30,
  MAX_YEARS_FUTURE: 10,
} as const;

/** No-claim bonus is a percentage; the published ladder tops out at 50%. */
export const NCB_MAX_PERCENT = 100;

/** A rupee ceiling on IDV, well above any private vehicle. */
export const IDV_MAX = 100_000_000;
