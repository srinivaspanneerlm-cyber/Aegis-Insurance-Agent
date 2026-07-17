"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { resolveAdvisorName } from "@/lib/advisors";

/**
 * Categories a policy can actually be sold under, and the advisor a receipt may
 * therefore name. Sri (`executive`/`miscellaneous`) is deliberately excluded:
 * the executive advisor routes to specialists rather than closing a sale, so a
 * receipt naming him would be wrong. `category` arrives untyped from the Python
 * engine, so anything unrecognised falls back to the health advisor.
 */
const RECEIPT_CATEGORIES = ["health", "motor", "travel", "home-property", "property"];
const DEFAULT_ADVISOR_NAME = "Sarah AI";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlanData {
  planName: string;
  category: string;
  coverage: string;
  premium: string;
  benefits: string[];
  claimSettlementRatio?: string;
  riskLevel?: string;
  score?: number;
  confidenceScore?: number;
  executiveApproval?: string;
  executiveNotes?: string;
  hospitalNetwork?: string;
  premiumBreakdown?: string;
  waitingPeriod?: string;
  exclusions?: string[];
  alternativePlan?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  occupation: string;
  annualIncome: string;
  maritalStatus: string;
  mobile: string;
  email: string;
  pan: string;
  aadhaar: string;
  nomineeName: string;
  nomineeRelation: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface PurchaseState {
  planData: PlanData | null;
  sessionId: string;
  customerDetails: CustomerDetails | null;
  verificationDone: boolean;
  kycDone: boolean;
  otpDone: boolean;
  reviewAccepted: boolean;
  paymentMethod: string | null;
  policyNumber: string | null;
  policyId: string | null;
  advisorName: string | null;
  couponCode: string | null;
  couponDiscount: number;
  startDate: string | null;
}

const DEFAULT_STATE: PurchaseState = {
  planData: null, sessionId: "", customerDetails: null,
  verificationDone: false, kycDone: false, otpDone: false,
  reviewAccepted: false, paymentMethod: null,
  policyNumber: null, policyId: null, advisorName: null,
  couponCode: null, couponDiscount: 0, startDate: null,
};

// ── Context ──────────────────────────────────────────────────────────────────

interface PurchaseContextType {
  state: PurchaseState;
  setPlanData: (plan: PlanData) => void;
  setCustomerDetails: (details: CustomerDetails) => void;
  setVerificationDone: (v: boolean) => void;
  setKycDone: (v: boolean) => void;
  setOtpDone: (v: boolean) => void;
  setReviewAccepted: (v: boolean) => void;
  setPaymentMethod: (m: string) => void;
  setSuccess: (policyNumber: string, policyId: string) => void;
  setCoupon: (code: string, discount: number) => void;
  resetPurchase: () => void;
  isReady: boolean;
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);
const STORAGE_KEY = STORAGE_KEYS.PURCHASE_SESSION;

/**
 * Strip the KYC identifiers before anything is written to disk.
 *
 * `localStorage` is readable by any script on the origin and outlives the
 * browser session, so a persisted PAN or Aadhaar sits there for whoever opens
 * the browser next — and a shared or borrowed device is exactly the one many of
 * our customers are on. They stay in memory for the length of the flow instead;
 * the cost is that a refresh mid-purchase makes the customer type them again,
 * which is the trade we're choosing.
 */
function withoutKycIdentifiers(state: PurchaseState): PurchaseState {
  if (!state.customerDetails) return state;
  return {
    ...state,
    customerDetails: { ...state.customerDetails, pan: "", aadhaar: "" },
  };
}

export function PurchaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PurchaseState>(DEFAULT_STATE);
  const [isReady, setIsReady] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PurchaseState>;
        setState(prev => ({ ...prev, ...saved }));
      }
      // Always try to pull planData from selectedPlanDetails
      const planRaw = localStorage.getItem(STORAGE_KEYS.SELECTED_PLAN);
      if (planRaw) {
        const plan = JSON.parse(planRaw) as PlanData;
        setState(prev => ({ ...prev, planData: plan }));
      }
      const sid = localStorage.getItem(STORAGE_KEYS.SESSION_ID) || crypto.randomUUID();
      setState(prev => ({ ...prev, sessionId: sid }));
    } catch {}
    setIsReady(true);
  }, []);

  // Persist state to localStorage on every change — minus the KYC identifiers
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutKycIdentifiers(state)));
    } catch {}
  }, [state, isReady]);

  const setPlanData = useCallback((plan: PlanData) => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_PLAN, JSON.stringify(plan));
    setState(prev => ({ ...prev, planData: plan }));
  }, []);

  const setCustomerDetails = useCallback((details: CustomerDetails) => {
    setState(prev => ({
      ...prev, customerDetails: details,
      startDate: new Date().toISOString().split("T")[0],
    }));
  }, []);

  const setVerificationDone = useCallback((v: boolean) =>
    setState(prev => ({ ...prev, verificationDone: v })), []);

  const setKycDone = useCallback((v: boolean) =>
    setState(prev => ({ ...prev, kycDone: v })), []);

  const setOtpDone = useCallback((v: boolean) =>
    setState(prev => ({ ...prev, otpDone: v })), []);

  const setReviewAccepted = useCallback((v: boolean) =>
    setState(prev => ({ ...prev, reviewAccepted: v })), []);

  const setPaymentMethod = useCallback((m: string) =>
    setState(prev => ({ ...prev, paymentMethod: m })), []);

  const setCoupon = useCallback((code: string, discount: number) =>
    setState(prev => ({ ...prev, couponCode: code, couponDiscount: discount })), []);

  const setSuccess = useCallback((policyNumber: string, policyId: string) => {
    setState(prev => {
      const category = prev.planData?.category || "health";
      return {
        ...prev, policyNumber, policyId,
        advisorName: RECEIPT_CATEGORIES.includes(category)
          ? resolveAdvisorName(category, DEFAULT_ADVISOR_NAME)
          : DEFAULT_ADVISOR_NAME,
      };
    });
  }, []);

  const resetPurchase = useCallback(() => {
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <PurchaseContext.Provider value={{
      state, setPlanData, setCustomerDetails, setVerificationDone,
      setKycDone, setOtpDone, setReviewAccepted, setPaymentMethod,
      setSuccess, setCoupon, resetPurchase, isReady,
    }}>
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error("usePurchase must be used within PurchaseProvider");
  return ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function generatePolicyNumber(): string {
  const prefix = "AEG";
  const year = new Date().getFullYear();
  const rand = Math.floor(100000000 + Math.random() * 900000000);
  return `${prefix}-${year}-${rand}`;
}

export function generatePolicyId(): string {
  return `POL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function extractPremiumAmount(premiumStr: string): number {
  const match = premiumStr?.match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, "")) : 850;
}

export function calculateGST(base: number): number {
  return Math.round(base * 0.18);
}

export function getExpiryDate(startDate: string): string {
  const d = new Date(startDate);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}
