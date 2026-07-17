/**
 * Guided-underwriting recommendation logic for the Apply flow.
 *
 * Pure decision function extracted from the page so the plan-matching rules can
 * be reasoned about and unit-tested in isolation, separate from the form UI.
 * Behaviour is identical to the original inline `computeRecommendation`.
 */

export interface RecommendationInput {
  priorities: string[];
  budgetTier: string;
  familyConfig: string[];
}

export interface Recommendation {
  name: string;
  coverage: string;
  premium: string;
  claimRatio: string;
  icon: string;
  reason: string;
  benefits: string[];
}

export function computeRecommendation({
  priorities,
  budgetTier,
  familyConfig,
}: RecommendationInput): Recommendation {
  const isGlobal = priorities.includes("global-medevac") || budgetTier === "premium";
  const isLegacy = priorities.includes("pre-illness") && familyConfig.length === 1;
  const isBasic = budgetTier === "basic";

  if (isGlobal) {
    return {
      name: "Aegis Global Elite Shield",
      coverage: "₹5 Crore Cashless Cover",
      premium: "₹2,100 / mo",
      claimRatio: "99.6% Claims Settled",
      icon: "crown",
      reason: "Highest match for global travel or comprehensive multi-country private medical cover, featuring absolute medevac routing locks.",
      benefits: [
        "Global Critical Medical Air Rescue & Transport",
        "Private Suite Hospital Room Lock-In Guaranteed",
        "Day-1 Coverage for Pre-Existing Conditions",
        "Personalized Medical Concierge Assigned"
      ]
    };
  }

  if (isLegacy) {
    return {
      name: "Family Shield Term Life",
      coverage: "₹2 Crore Guaranteed Payout",
      premium: "₹990 / mo",
      claimRatio: "99.2% Claims Settled",
      icon: "shield",
      reason: "Best tailored for single professional breadwinners seeking guaranteed generational asset security.",
      benefits: [
        "Tax-Free Terminal Disbursals under Section 80C",
        "Immediate Lump Sum payout upon Terminal Illness",
        "Guaranteed Level Premium Locks for 40 years",
        "Accidental Death Rider & Child Welfare support"
      ]
    };
  }

  if (isBasic) {
    return {
      name: "Aegis Essential Shield",
      coverage: "₹25 Lakh Cashless Cover",
      premium: "₹390 / mo",
      claimRatio: "98.8% Claims Settled",
      icon: "heart",
      reason: "Cost-optimized policy for young applicants seeking high-value baseline hospital locks.",
      benefits: [
        "1,500+ Network Cashless Hospital access",
        "Free Annual Advanced Medical Checkups",
        "Cashless claims authorized within 2 hours",
        "Zero Room Rent Cap sub-limits"
      ]
    };
  }

  return {
    name: "Aegis Supreme Health Shield",
    coverage: "₹1 Crore Cashless Cover",
    premium: "₹850 / mo",
    claimRatio: "99.2% Claims Settled",
    icon: "sparkles",
    reason: "Optimized comprehensive health protection for growing nuclear families without any room rent co-pays.",
    benefits: [
      "Unlimited Network Cashless Bed allocation",
      "Zero Co-Pay or Sub-limit Deductibles required",
      "2-Hour Cashless claims desk pre-approval",
      "24/7 Unlimited Direct doctor consultations"
    ]
  };
}
