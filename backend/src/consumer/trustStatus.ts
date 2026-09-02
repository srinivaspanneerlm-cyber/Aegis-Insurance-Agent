/**
 * The trust gate.
 *
 * Answers one question about one policy: **what can Aegis currently say about
 * these details, and what would move that forward?** Not "is this customer
 * honest", which is a question this platform is not equipped to ask and has no
 * business asking of somebody who typed their own certificate into a form.
 *
 * That distinction is the whole design, and it shows up in three ways:
 *
 *   • **There is no rejected state and no fraud score.** The four states are a
 *     description of our own knowledge, not a verdict on a person. Every one of
 *     them is followed by something the customer can do.
 *   • **A document never overrules what was typed.** Manual entry is the source
 *     of truth in this milestone; an attachment can raise confidence in the
 *     record, and it can raise a question about it, but it cannot silently
 *     rewrite a field. No OCR runs — none is configured (see
 *     `documents/services.ts`) — so there is nothing here that pretends to have
 *     read the certificate.
 *   • **`CONSISTENCY_VERIFIED` is a claim about internal consistency only.** It
 *     says the record hangs together and a readable document is attached. It
 *     does not say an insurer confirmed anything, and the copy that renders it
 *     is written so that nobody could read it that way.
 *
 * Pure and clock-injected, like `renewalStatus.ts`: every rule below is a unit
 * test rather than something observed by uploading a file and looking.
 */

// ── The vocabulary ───────────────────────────────────────────────────────────

/**
 * The four states, in the order they represent increasing knowledge — except
 * the last, which is a branch rather than a step.
 *
 * These strings are already the default and the documented set on
 * `HeldPolicy.verificationState`, so this engine names them rather than
 * introducing a parallel vocabulary.
 */
export const TRUST_STATES = [
  /** We have what you gave us. Nothing has been checked yet. */
  "UPLOADED",
  /** Something is missing or unusual, and you are the person who can settle it. */
  "NEEDS_CONFIRMATION",
  /** The record hangs together and a readable document is attached. */
  "CONSISTENCY_VERIFIED",
  /** Somebody at Aegis should look at this with you before we rely on it. */
  "VERIFICATION_REQUIRED",
] as const;

export type TrustState = (typeof TRUST_STATES)[number];

/**
 * Why the state is what it is.
 *
 * A key rather than a sentence, for the same reason the renewal engine returns
 * keys: the reasoning has one right answer and the wording has three languages.
 */
export type TrustReasonKey =
  | "trust.reason.nothingAttached"
  | "trust.reason.detailsIncomplete"
  | "trust.reason.coverTypeUnknown"
  | "trust.reason.alreadyExpired"
  | "trust.reason.documentMatchesAnotherPolicy"
  | "trust.reason.policyNumberOnAnotherPolicy"
  | "trust.reason.recordConsistent";

/** What the customer can do about it. Every state has one. */
export type TrustActionKey =
  | "trust.action.addDocument"
  | "trust.action.completeDetails"
  | "trust.action.confirmCoverType"
  | "trust.action.confirmExpiry"
  | "trust.action.weWillCheck"
  | "trust.action.nothingNeeded";

export interface TrustAssessment {
  readonly state: TrustState;
  readonly reasonKey: TrustReasonKey;
  readonly actionKey: TrustActionKey;
  /**
   * Whether a document is attached and readable. Reported separately from the
   * state because the UI shows the two side by side, and deriving one from the
   * other in a component is how they end up disagreeing.
   */
  readonly hasDocument: boolean;
  /** The individual checks, so a support conversation can be specific. */
  readonly checks: TrustChecks;
}

export interface TrustChecks {
  readonly detailsComplete: boolean;
  readonly coverTypeKnown: boolean;
  readonly expiryInFuture: boolean;
  readonly documentAttached: boolean;
  readonly documentFormatAccepted: boolean;
  readonly documentUniqueToThisPolicy: boolean;
  readonly policyNumberUniqueToThisPolicy: boolean;
}

// ── What the engine is given ─────────────────────────────────────────────────

export interface TrustInput {
  /** The policy as the customer typed it. Nothing here was read off a file. */
  readonly insurer: string | null;
  readonly policyNumber: string | null;
  readonly policyType: string | null;
  readonly expiryDate: Date | null;

  /** The attached document, when there is one and it passed the content check. */
  readonly document: {
    readonly formatAccepted: boolean;
    /**
     * The same bytes are attached to another policy this customer holds.
     *
     * Worth a question and never an accusation: the innocent explanations are
     * ordinary — a two-wheeler and a car renewed on one combined certificate,
     * or the same file picked twice by somebody working through a list on a
     * phone — and the platform cannot tell which without asking.
     */
    readonly matchesAnotherPolicy: boolean;
  } | null;

  /**
   * This policy number already appears on another of *this customer's* policies.
   *
   * Scoped to the one customer deliberately. A cross-customer check would be
   * both a privacy leak — the answer tells you something about a stranger's
   * record — and wrong more often than right, since a policy legitimately moves
   * between people when a vehicle is sold.
   */
  readonly policyNumberOnAnotherPolicy: boolean;
}

export interface TrustOptions {
  /** Injected so the "already expired" rule is testable on a fixed day. */
  readonly now?: Date;
}

// ── The rules ────────────────────────────────────────────────────────────────

const isBlank = (value: string | null): boolean => (value ?? "").trim() === "";

/** Calendar-day comparison in UTC, matching how expiry dates are stored. */
function isInFuture(expiry: Date | null, now: Date): boolean {
  if (!expiry) return false;
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return day(expiry) >= day(now);
}

/**
 * Assess one policy.
 *
 * Ordered, first match wins, and the order is the point:
 *
 *   1. Anything needing a human at Aegis outranks everything else, because it
 *      is the only state the customer cannot resolve alone.
 *   2. Then anything the customer can settle themselves, so they are asked for
 *      one thing rather than told they are finished and asked later.
 *   3. Then the confident state, which requires both a complete record and a
 *      readable document.
 *   4. Otherwise: we simply have not checked anything yet.
 */
export function assessTrust(input: TrustInput, options: TrustOptions = {}): TrustAssessment {
  const now = options.now ?? new Date();

  const checks: TrustChecks = {
    detailsComplete: !isBlank(input.insurer) && !isBlank(input.policyNumber),
    coverTypeKnown: input.policyType !== null && input.policyType !== "UNKNOWN",
    expiryInFuture: isInFuture(input.expiryDate, now),
    documentAttached: input.document !== null,
    documentFormatAccepted: input.document?.formatAccepted ?? false,
    documentUniqueToThisPolicy: !(input.document?.matchesAnotherPolicy ?? false),
    policyNumberUniqueToThisPolicy: !input.policyNumberOnAnotherPolicy,
  };

  const hasDocument = checks.documentAttached && checks.documentFormatAccepted;

  const decide = (): Pick<TrustAssessment, "state" | "reasonKey" | "actionKey"> => {
    // 1. Needs somebody at Aegis. Both of these are questions, not findings.
    if (!checks.documentUniqueToThisPolicy) {
      return {
        state: "VERIFICATION_REQUIRED",
        reasonKey: "trust.reason.documentMatchesAnotherPolicy",
        actionKey: "trust.action.weWillCheck",
      };
    }
    if (!checks.policyNumberUniqueToThisPolicy) {
      return {
        state: "VERIFICATION_REQUIRED",
        reasonKey: "trust.reason.policyNumberOnAnotherPolicy",
        actionKey: "trust.action.weWillCheck",
      };
    }

    // 2. Things the customer can settle. Asked one at a time, most consequential
    //    first: a policy that may have lapsed is the one where being wrong costs
    //    them a fine or an uninsured accident.
    if (!checks.expiryInFuture) {
      return {
        state: "NEEDS_CONFIRMATION",
        reasonKey: "trust.reason.alreadyExpired",
        actionKey: "trust.action.confirmExpiry",
      };
    }
    if (!checks.detailsComplete) {
      return {
        state: "NEEDS_CONFIRMATION",
        reasonKey: "trust.reason.detailsIncomplete",
        actionKey: "trust.action.completeDetails",
      };
    }
    if (!checks.coverTypeKnown) {
      return {
        state: "NEEDS_CONFIRMATION",
        reasonKey: "trust.reason.coverTypeUnknown",
        actionKey: "trust.action.confirmCoverType",
      };
    }

    // 3. Complete record, readable document. The strongest thing this milestone
    //    is entitled to say — and it is a statement about our own record.
    if (hasDocument) {
      return {
        state: "CONSISTENCY_VERIFIED",
        reasonKey: "trust.reason.recordConsistent",
        actionKey: "trust.action.nothingNeeded",
      };
    }

    // 4. Nothing is wrong; nothing has been checked either. Said plainly.
    return {
      state: "UPLOADED",
      reasonKey: "trust.reason.nothingAttached",
      actionKey: "trust.action.addDocument",
    };
  };

  return { ...decide(), hasDocument, checks };
}
