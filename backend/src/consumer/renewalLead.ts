/**
 * Asking a person for help renewing, and the states that request moves through.
 *
 * The vocabulary and the workflow live together because they are one thing: a
 * status column that can hold any of five strings is not a workflow, and the
 * rule that makes it one — which state may follow which — is what stops a queue
 * being tidied instead of worked.
 *
 * Pure. No database, no clock, no Express. Every rule below is a unit test
 * rather than something observed by clicking a button in an admin screen.
 */

// ── How somebody wants to be reached ─────────────────────────────────────────

/**
 * The three channels, and no more.
 *
 * WhatsApp is here as a *preference*, not as an integration: this milestone
 * sends nothing automatically down any of them. A person reads the queue and
 * gets in touch. Recording the preference anyway matters — ringing a customer
 * who asked to be messaged is the fastest way to lose the ones who cannot take
 * calls at work.
 */
export const CONTACT_CHANNELS = ["CALL", "WHATSAPP", "EMAIL"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const isContactChannel = (value: unknown): value is ContactChannel =>
  typeof value === "string" && (CONTACT_CHANNELS as readonly string[]).includes(value);

/**
 * What somebody is agreeing to be contacted *for*.
 *
 * Separate values because being helped once and being reminded every year are
 * different asks. A consent that bundled them would be one nobody could defend:
 * the customer agreed to a phone call about the policy expiring next week, not
 * to a standing relationship.
 */
export const CONSENT_PURPOSES = ["RENEWAL_ASSISTANCE", "RENEWAL_REMINDER"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const isConsentPurpose = (value: unknown): value is ConsentPurpose =>
  typeof value === "string" && (CONSENT_PURPOSES as readonly string[]).includes(value);

// ── The workflow ─────────────────────────────────────────────────────────────

export const RENEWAL_LEAD_STATUSES = [
  /** Raised by the customer. Nobody has picked it up. */
  "NEW",
  /** Somebody has actually spoken to them. */
  "CONTACTED",
  /** They asked for a price, and it has been requested from a partner. */
  "QUOTE_REQUESTED",
  /** Passed to the partner who will actually issue the cover. */
  "PARTNER_HANDOFF",
  /** Finished, one way or another. `closedReason` says which. */
  "CLOSED",
] as const;

export type RenewalLeadStatus = (typeof RENEWAL_LEAD_STATUSES)[number];

export const isRenewalLeadStatus = (value: unknown): value is RenewalLeadStatus =>
  typeof value === "string" && (RENEWAL_LEAD_STATUSES as readonly string[]).includes(value);

/**
 * Which state may follow which.
 *
 * Forward-only, and one rule is worth spelling out because it looks like an
 * omission: **NEW cannot go straight to CLOSED.** A request can only be closed
 * once somebody has actually made contact.
 *
 * That is a deliberate piece of friction. The alternative — a queue where any
 * row can be cleared in one click — is one where the oldest and least appealing
 * requests get closed rather than worked, and the person who raised one is left
 * waiting for a call that was marked as finished without ever being made. If a
 * request genuinely should not be pursued, CONTACTED then CLOSED with a reason
 * records that a human looked at it, which is the thing anybody asking
 * afterwards actually needs to know.
 *
 * There is no going back. A status is a claim about what happened, and history
 * does not run backwards; a mistake is corrected by a note on the record and a
 * new request, not by pretending the call did not happen.
 */
export const RENEWAL_LEAD_TRANSITIONS: Record<RenewalLeadStatus, readonly RenewalLeadStatus[]> = {
  NEW: ["CONTACTED"],
  CONTACTED: ["QUOTE_REQUESTED", "PARTNER_HANDOFF", "CLOSED"],
  QUOTE_REQUESTED: ["PARTNER_HANDOFF", "CLOSED"],
  PARTNER_HANDOFF: ["CLOSED"],
  CLOSED: [],
};

/** Whether this move is one the workflow allows. */
export const canTransition = (from: RenewalLeadStatus, to: RenewalLeadStatus): boolean =>
  (RENEWAL_LEAD_TRANSITIONS[from] as readonly string[]).includes(to);

/**
 * Why a move was refused, in words an operator can act on.
 *
 * Returned rather than thrown so the caller decides the status code, and
 * written for the person in the queue rather than for a log: "NEW → CLOSED is
 * not permitted" says nothing about what to do instead.
 */
export function explainRefusal(from: RenewalLeadStatus, to: RenewalLeadStatus): string {
  if (from === to) return `This request is already ${LABELS[to]}.`;
  if (from === "CLOSED") {
    return "This request is closed. Closing is final — raise a new request rather than reopening this one.";
  }
  if (from === "NEW" && to === "CLOSED") {
    return "Mark it Contacted first. A request should only be closed once somebody has actually spoken to the customer.";
  }
  const allowed = RENEWAL_LEAD_TRANSITIONS[from];
  if (allowed.length === 0) return `Nothing follows ${LABELS[from]}.`;
  return `From ${LABELS[from]} this can go to ${allowed.map((s) => LABELS[s]).join(" or ")}.`;
}

/** How each state is written on a screen. Capitals are for the database. */
export const LABELS: Record<RenewalLeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUOTE_REQUESTED: "Quote requested",
  PARTNER_HANDOFF: "Partner handoff",
  CLOSED: "Closed",
};

/**
 * The reasons a request may be closed for.
 *
 * A fixed set rather than free text, because "why do these close?" is the
 * question that tells an operation whether it is helping anybody, and free text
 * cannot be counted. None of them blames the customer: a person who stopped
 * replying had a reason, and `UNREACHABLE` records what we observed rather than
 * what we assume about them.
 */
export const CLOSED_REASONS = [
  "RENEWED_WITH_PARTNER",
  "RENEWED_ELSEWHERE",
  "CUSTOMER_DECLINED",
  "UNREACHABLE",
  "DUPLICATE_REQUEST",
  "NOT_ELIGIBLE",
] as const;

export type ClosedReason = (typeof CLOSED_REASONS)[number];

export const isClosedReason = (value: unknown): value is ClosedReason =>
  typeof value === "string" && (CLOSED_REASONS as readonly string[]).includes(value);

/** Bounds on the one free-text field an operator can write. */
export const RENEWAL_LEAD_LIMITS = {
  CLOSED_NOTE: 500,
} as const;
