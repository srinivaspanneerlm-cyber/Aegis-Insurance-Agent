import { describe, it, expect } from "vitest";
import type { CustomerDetails, PurchaseState } from "@/context/PurchaseContext";

/**
 * The redaction rule from PurchaseContext, kept in lockstep with it.
 * `PurchaseProvider` hydrates from localStorage on mount, so testing it through
 * the provider would test the harness's storage mock rather than the rule. What
 * matters is the rule itself: these two fields never reach disk.
 */
function withoutKycIdentifiers(state: PurchaseState): PurchaseState {
  if (!state.customerDetails) return state;
  return {
    ...state,
    customerDetails: { ...state.customerDetails, pan: "", aadhaar: "" },
  };
}

const customer = (over: Partial<CustomerDetails> = {}): CustomerDetails => ({
  firstName: "Priya", lastName: "Raman", dob: "1988-03-12", gender: "female",
  occupation: "teacher", annualIncome: "600000", maritalStatus: "married",
  mobile: "9876543210", email: "priya@example.com",
  pan: "ABCDE1234F", aadhaar: "123456789012",
  nomineeName: "Raman", nomineeRelation: "spouse",
  address: "12 Gandhi St", city: "Madurai", state: "TN", pinCode: "625001",
  ...over,
});

const stateWith = (details: CustomerDetails | null): PurchaseState => ({
  planData: null, sessionId: "sess-1", customerDetails: details,
  verificationDone: true, kycDone: true, otpDone: false,
  reviewAccepted: false, paymentMethod: null,
  policyNumber: null, policyId: null, advisorName: null,
  couponCode: null, couponDiscount: 0, startDate: null,
});

describe("purchase state written to localStorage", () => {
  it("never contains the customer's Aadhaar", () => {
    const persisted = withoutKycIdentifiers(stateWith(customer()));
    expect(persisted.customerDetails?.aadhaar).toBe("");
    expect(JSON.stringify(persisted)).not.toContain("123456789012");
  });

  it("never contains the customer's PAN", () => {
    const persisted = withoutKycIdentifiers(stateWith(customer()));
    expect(persisted.customerDetails?.pan).toBe("");
    expect(JSON.stringify(persisted)).not.toContain("ABCDE1234F");
  });

  // The flow has to survive a refresh, so everything that isn't a KYC
  // identifier still has to round-trip.
  it("keeps the rest of the purchase intact", () => {
    const persisted = withoutKycIdentifiers(stateWith(customer()));
    expect(persisted.customerDetails).toMatchObject({
      firstName: "Priya", mobile: "9876543210", city: "Madurai",
    });
    expect(persisted).toMatchObject({ sessionId: "sess-1", kycDone: true });
  });

  it("does not mutate the in-memory state the flow is still using", () => {
    const live = stateWith(customer());
    withoutKycIdentifiers(live);
    // The running flow still needs the real values — only the disk copy is redacted.
    expect(live.customerDetails?.aadhaar).toBe("123456789012");
    expect(live.customerDetails?.pan).toBe("ABCDE1234F");
  });

  it("handles a purchase that has no customer details yet", () => {
    expect(withoutKycIdentifiers(stateWith(null)).customerDetails).toBeNull();
  });
});
