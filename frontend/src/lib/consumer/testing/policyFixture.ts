import type { ConsumerPolicy, TrustState } from "@/services/api";

/**
 * One consumer policy, as the API sends it.
 *
 * Shared rather than redeclared in each test file. The shape has grown twice
 * already — a renewal assessment, then a trust assessment — and each time every
 * copy of it had to be found and widened, which is exactly the kind of edit that
 * gets half-done. One fixture means adding a field breaks the type in one place.
 *
 * Not a `.test.ts` file: it is imported by tests rather than being one.
 */

const TRUST_COPY: Record<TrustState, { label: string; reason: string; action: string }> = {
  UPLOADED: {
    label: "As you entered it",
    reason: "This is exactly what you typed in. We have not compared it against your certificate yet.",
    action: "Add a photo or PDF of your certificate if you have one handy.",
  },
  NEEDS_CONFIRMATION: {
    label: "One thing to confirm",
    reason: "You told us you are not sure which kind of cover this is — which is a perfectly normal answer.",
    action: "Ask our advisor to help you work out which cover you have.",
  },
  CONSISTENCY_VERIFIED: {
    label: "Details check out",
    reason: "Your details are complete and your certificate is on file.",
    action: "Nothing to do. We will tell you when your renewal is coming up.",
  },
  VERIFICATION_REQUIRED: {
    label: "We will check this with you",
    reason: "This is the same file you added to another policy. That often happens.",
    action: "Nothing for you to do. We will go through it with you before we rely on it.",
  },
};

export const SCOPE_NOTE =
  "These checks look at the details you gave us and whether they fit together. They are not a confirmation from your insurer.";

export const GUIDANCE_DISCLAIMER =
  "Guidance only. Exact coverage, eligibility and renewal terms depend on official policy wording and insurer/partner confirmation.";

/** A trust block in one state, with the copy the API would have resolved for it. */
export function trustFixture(
  state: TrustState = "UPLOADED",
  over: Partial<ConsumerPolicy["trust"]> = {}
): Pick<ConsumerPolicy, "trust" | "trustCopy"> {
  return {
    trust: {
      state,
      reasonKey: "trust.reason.nothingAttached",
      actionKey: "trust.action.addDocument",
      hasDocument: state === "CONSISTENCY_VERIFIED",
      checks: {
        detailsComplete: true,
        coverTypeKnown: true,
        expiryInFuture: true,
        documentAttached: state === "CONSISTENCY_VERIFIED",
        documentFormatAccepted: state === "CONSISTENCY_VERIFIED",
        documentUniqueToThisPolicy: true,
        policyNumberUniqueToThisPolicy: true,
      },
      ...over,
    },
    trustCopy: { ...TRUST_COPY[state], scopeNote: SCOPE_NOTE, copyVersion: "consumer-renewal-copy-v1" },
  };
}

export function policyFixture(over: Partial<ConsumerPolicy> = {}): ConsumerPolicy {
  return {
    id: "pol-1",
    insurer: "Bharat General",
    policyNumberMasked: "••••1234",
    policyType: "COMPREHENSIVE",
    startDate: "2025-12-31",
    expiryDate: "2026-12-31",
    idv: 65000,
    ncbPercent: 25,
    verificationState: "UPLOADED",
    verificationNote: null,
    enteredVia: "MANUAL",
    vehicle: {
      id: "veh-1",
      registrationNumber: "TN 09 AB 1234",
      vehicleType: "BIKE",
      make: "Hero",
      model: "Splendor",
    },
    renewal: {
      ok: true,
      status: "ACTIVE",
      daysRemaining: 120,
      urgency: "NONE",
      displayLabel: "Active",
      messageKey: "renewal.status.active",
      nextActionKey: "renewal.action.noneNeeded",
      evaluatedOn: "2026-09-02",
      expiresOn: "2026-12-31",
      timeZone: "Asia/Kolkata",
    },
    copy: {
      status: "Your cover is active.",
      nextAction: "Nothing to do today.",
      disclaimer: GUIDANCE_DISCLAIMER,
      copyVersion: "consumer-renewal-copy-v1",
    },
    ...trustFixture("UPLOADED"),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}
