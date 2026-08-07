import type { PlanDetails } from "./types";

/** Mock cashless hospital / service network shown in the Network tab. */
export const MOCK_HOSPITALS = [
  { name: "Apollo Proton Cancer Centre", city: "Chennai", rating: "4.9", category: "Super Specialty" },
  { name: "Fortis Escorts Heart Institute", city: "New Delhi", rating: "4.8", category: "Cardiology Center" },
  { name: "Manipal Hospital Whitefield", city: "Bengaluru", rating: "4.8", category: "Multispecialty" },
  { name: "Medanta The Medicity", city: "Gurugram", rating: "4.9", category: "Integrated Care" },
  { name: "Tata Memorial Hospital", city: "Mumbai", rating: "4.7", category: "Oncology Special" },
  { name: "Max Super Specialty Hospital", city: "Noida", rating: "4.6", category: "Multispecialty" },
  { name: "Lilavati Hospital & Research Centre", city: "Mumbai", rating: "4.8", category: "Research & Care" },
];

/** Fallback plan shown when no plan was saved to localStorage yet. */
/**
 * The shape a plan detail page renders while no plan has been chosen.
 *
 * Several fields are deliberately empty rather than filled with plausible
 * values. A claim settlement ratio is an IRDAI-published figure per insurer,
 * and it is the number people actually decide on — inventing 99.1% here was
 * both the most consequential fabrication on the page and the most easily
 * checked. The same applies to hospital network counts and to benefit lines
 * asserting policy terms: "Day-1 Pre-Existing Illness Cover" sat two lines
 * above a waiting period that contradicted it.
 *
 * The components already render `NOT_DISCLOSED` for an empty value, so an
 * unknown is shown as unknown rather than as a number.
 */
export const DEFAULT_PLAN: PlanDetails = {
  planName: "Aegis Supreme Health Shield",
  coverage: "₹1 Crore Cover",
  premium: "₹850/month",
  benefits: [],
  claimSettlementRatio: "",
  riskLevel: "Low Risk",
  score: 98,
  confidenceScore: 0.98,
  executiveApproval: "Approved - All family health checks, age brackets, and budget constraints fully validated.",
  exclusions: ["Cosmetic surgery", "Self-inflicted injuries", "Experimental therapies"],
  waitingPeriod: "12 months for pre-existing diseases, 30 days initial waiting period.",
  claimProcess: "1. Intimate claim at desk. 2. Submit cashless digital health card. 3. Direct billing settlement in 15 mins.",
  hospitalNetwork: "",
  premiumBreakdown: "Base Premium: ₹720, GST (18%): ₹130",
  executiveNotes: "Underwritten under premium guidelines. Optimized for growing households.",
  alternativePlan: {
    planName: "Aegis Care Silver Floater",
    coverage: "₹8 Lakh Cover",
    premium: "₹1800/month",
    benefits: ["Day Care Procedures", "Cashless Hospitalization", "Restore Benefit"],
    claimSettlementRatio: "",
    riskLevel: "Low Risk",
    score: 85,
    confidenceScore: 0.92,
    executiveApproval: "Approved - Secondary lower coverage tier.",
    exclusions: ["Global coverage benefits"],
    waitingPeriod: "24 months for pre-existing diseases.",
    claimProcess: "Cashless approval within 4 hours.",
    hospitalNetwork: "",
    premiumBreakdown: "Base Premium: ₹1600, GST: ₹200",
    executiveNotes: "Alternative choice for smaller budget limits.",
  },
};
