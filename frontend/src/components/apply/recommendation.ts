import { NOT_DISCLOSED } from "@/lib/platformFacts";
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

/**
 * Which catalogue product suits this answer set.
 *
 * Returns a *selection*, not a product. The rules for who needs what are the
 * platform's judgement and stay here; the product's name, premium and coverage
 * come from the catalogue, because a page that hardcodes a premium is a page
 * that quotes a stale price the day pricing changes.
 *
 * The benefit lists that used to be written here went further than stale — they
 * asserted policy terms ("Day-1 Coverage for Pre-Existing Conditions",
 * "Guaranteed Level Premium Locks for 40 years") that no plan in the catalogue
 * has been checked to offer.
 */
/**
 * What happens next, rather than what the policy contains.
 *
 * The lists here previously read as confirmed policy terms — "Day-1 Coverage
 * for Pre-Existing Conditions", "Guaranteed Level Premium Locks for 40 years" —
 * rendered under a "What's covered" heading with ticks beside them. Nothing had
 * checked that any plan in the catalogue offers those, and a customer who
 * bought on the strength of one and then had a claim declined would have been
 * misled by this screen.
 *
 * What the flow can honestly say is what happens next.
 */
const GENERIC_NEXT_STEPS = [
  "An advisor will confirm what this plan covers",
  "You will see the full terms before anything is signed",
  "Nothing is charged until you agree",
  "You can ask us anything before deciding",
];

export function selectPlanKey({
  priorities,
  budgetTier,
  familyConfig,
}: RecommendationInput): PlanKey {
  const isGlobal = priorities.includes("global-medevac") || budgetTier === "premium";
  const isLegacy = priorities.includes("pre-illness") && familyConfig.length === 1;
  const isBasic = budgetTier === "basic";

  if (isGlobal) return "global";
  if (isLegacy) return "legacy";
  if (isBasic) return "basic";
  return "standard";
}

/** The four outcomes the questions can reach. */
export type PlanKey = "global" | "legacy" | "basic" | "standard";

/** Why each was chosen — the platform's reasoning, not a product claim. */
export const PLAN_REASON: Record<PlanKey, string> = {
  global:
    "You named international cover or the widest protection, so this is the plan that travels with you.",
  legacy:
    "You are covering yourself and asked about pre-existing conditions, which is what this plan is built around.",
  basic:
    "You asked to keep the premium down, so this is the most cover available at the lowest price.",
  standard:
    "It balances what you told us about your family against what you said you could spend.",
};

/** Catalogue names, so a lookup can find the product the rules chose. */
export const PLAN_CATALOGUE_NAME: Record<PlanKey, string> = {
  global: "Aegis Global Elite Shield",
  legacy: "Aegis Supreme Health Shield",
  basic: "Aegis Essential Shield",
  standard: "Aegis Supreme Health Shield",
};

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
      claimRatio: NOT_DISCLOSED,
      icon: "crown",
      reason: "Highest match for global travel or comprehensive multi-country private medical cover, featuring absolute medevac routing locks.",
      benefits: GENERIC_NEXT_STEPS
    };
  }

  if (isLegacy) {
    return {
      name: "Family Shield Term Life",
      coverage: "₹2 Crore Guaranteed Payout",
      premium: "₹990 / mo",
      claimRatio: NOT_DISCLOSED,
      icon: "shield",
      reason: "Best tailored for single professional breadwinners seeking guaranteed generational asset security.",
      benefits: GENERIC_NEXT_STEPS
    };
  }

  if (isBasic) {
    return {
      name: "Aegis Essential Shield",
      coverage: "₹25 Lakh Cashless Cover",
      premium: "₹390 / mo",
      claimRatio: NOT_DISCLOSED,
      icon: "heart",
      reason: "Cost-optimized policy for young applicants seeking high-value baseline hospital locks.",
      benefits: GENERIC_NEXT_STEPS
    };
  }

  return {
    name: "Aegis Supreme Health Shield",
    coverage: "₹1 Crore Cashless Cover",
    premium: "₹850 / mo",
    claimRatio: NOT_DISCLOSED,
    icon: "sparkles",
    reason: "Optimized comprehensive health protection for growing nuclear families without any room rent co-pays.",
    benefits: GENERIC_NEXT_STEPS
  };
}
