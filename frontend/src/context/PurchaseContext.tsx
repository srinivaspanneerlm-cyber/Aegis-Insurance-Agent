"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

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

const EMPTY_CUSTOMER: CustomerDetails = {
  firstName: "", lastName: "", dob: "", gender: "", occupation: "",
  annualIncome: "", maritalStatus: "", mobile: "", email: "",
  pan: "", aadhaar: "", nomineeName: "", nomineeRelation: "",
  address: "", city: "", state: "", pinCode: "",
};

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
const STORAGE_KEY = "aegis_purchase_session";

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
      const planRaw = localStorage.getItem("selectedPlanDetails");
      if (planRaw) {
        const plan = JSON.parse(planRaw) as PlanData;
        setState(prev => ({ ...prev, planData: plan }));
      }
      const sid = localStorage.getItem("aegis_session_id") || crypto.randomUUID();
      setState(prev => ({ ...prev, sessionId: sid }));
    } catch {}
    setIsReady(true);
  }, []);

  // Persist state to localStorage on every change
  useEffect(() => {
    if (!isReady) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state, isReady]);

  const setPlanData = useCallback((plan: PlanData) => {
    localStorage.setItem("selectedPlanDetails", JSON.stringify(plan));
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
    const advisorMap: Record<string, string> = {
      health: "Sarah AI", motor: "Alex AI",
      travel: "Ethan AI", "home-property": "Emma AI", property: "Emma AI",
    };
    setState(prev => ({
      ...prev, policyNumber, policyId,
      advisorName: advisorMap[prev.planData?.category || "health"] || "Sarah AI",
    }));
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
