/**
 * The vocabulary of the Insurance Intelligence Engine.
 *
 * One rule governs every type here: **nothing leaves this engine without an
 * explanation attached**. Not a recommendation, not a risk score, not a gap.
 * That is enforced structurally rather than by convention — `Recommendation`
 * cannot be constructed without an `Explanation`, so an unexplained
 * recommendation is a compile error rather than a code-review comment.
 *
 * The reason is not decoration. This platform advises people who have been
 * mis-sold insurance before, often by someone who could not or would not say
 * why. A number with no reasoning is indistinguishable from a guess, and a
 * customer cannot challenge what they cannot see.
 */

// ── Domains ──────────────────────────────────────────────────────────────────

export const INSURANCE_DOMAINS = [
  "motor",
  "health",
  "life",
  "travel",
  "property",
  "commercial",
] as const;

export type InsuranceDomain = (typeof INSURANCE_DOMAINS)[number];

export const isInsuranceDomain = (value: unknown): value is InsuranceDomain =>
  typeof value === "string" && (INSURANCE_DOMAINS as readonly string[]).includes(value);

/** Human labels, in the plain words the platform uses with customers. */
export const DOMAIN_LABEL: Record<InsuranceDomain, string> = {
  motor: "Vehicle insurance",
  health: "Health insurance",
  life: "Life insurance",
  travel: "Travel insurance",
  property: "Home and property insurance",
  commercial: "Business insurance",
};

// ── The profile ──────────────────────────────────────────────────────────────

export const INCOME_RANGES = ["BELOW_3L", "3L_6L", "6L_12L", "12L_25L", "ABOVE_25L"] as const;
export type IncomeRange = (typeof INCOME_RANGES)[number];

/**
 * Annual income midpoints in rupees, used for coverage arithmetic.
 *
 * A band rather than an exact figure because people answer a band honestly and
 * an exact figure defensively. The midpoint is deliberately conservative at the
 * top end: `ABOVE_25L` is treated as 30L, not as an unbounded number that would
 * inflate every recommendation.
 */
export const INCOME_MIDPOINT: Record<IncomeRange, number> = {
  BELOW_3L: 200_000,
  "3L_6L": 450_000,
  "6L_12L": 900_000,
  "12L_25L": 1_800_000,
  ABOVE_25L: 3_000_000,
};

export const RISK_PREFERENCES = ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const;
export type RiskPreference = (typeof RISK_PREFERENCES)[number];

export const TRAVEL_FREQUENCIES = [
  "NEVER",
  "RARE",
  "OCCASIONAL",
  "FREQUENT",
  "INTERNATIONAL",
] as const;
export type TravelFrequency = (typeof TRAVEL_FREQUENCIES)[number];

export const FINANCIAL_GOALS = [
  "RETIREMENT",
  "CHILD_EDUCATION",
  "CHILD_MARRIAGE",
  "WEALTH",
  "HOME_PURCHASE",
  "DEBT_FREEDOM",
  "INCOME_PROTECTION",
] as const;
export type FinancialGoal = (typeof FINANCIAL_GOALS)[number];

export interface VehicleHolding {
  readonly kind: "CAR" | "TWO_WHEELER" | "COMMERCIAL" | "OTHER";
  readonly make?: string;
  readonly year?: number;
  readonly commercial?: boolean;
}

export interface PropertyHolding {
  readonly kind: "HOUSE" | "APARTMENT" | "LAND" | "SHOP" | "OTHER";
  readonly ownership: "OWNED" | "RENTED" | "MORTGAGED";
  readonly valueRange?: string;
}

export interface InsuranceHistory {
  readonly yearsHeld?: number;
  readonly priorClaims?: number;
  readonly lapses?: number;
}

/**
 * What the engine reasons over.
 *
 * Every field is optional, and that is load-bearing. A profile is assembled
 * over many conversations, and an engine that refuses to answer until the
 * profile is complete is useless precisely when a customer most needs it — at
 * the beginning. Every analysis therefore reports its own confidence and says
 * which missing facts would raise it.
 */
export interface InsuranceProfileFacts {
  readonly userId: string;
  readonly age?: number | null;
  readonly occupation?: string | null;
  readonly incomeRange?: IncomeRange | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly maritalStatus?: string | null;
  readonly familyMembers?: number | null;
  readonly dependents?: number | null;
  readonly parentsDependent?: boolean | null;
  readonly vehicles?: readonly VehicleHolding[];
  readonly properties?: readonly PropertyHolding[];
  readonly travelFrequency?: TravelFrequency | null;
  readonly healthConditions?: readonly string[];
  readonly smoker?: boolean | null;
  readonly financialGoals?: readonly FinancialGoal[];
  readonly riskPreference?: RiskPreference | null;
  readonly insuranceHistory?: InsuranceHistory | null;
  readonly heldPolicies?: readonly HeldPolicyFacts[];
}

export interface HeldPolicyFacts {
  readonly id: string;
  readonly domain: InsuranceDomain;
  readonly insurer?: string | null;
  readonly productName?: string | null;
  readonly sumInsured?: number | null;
  readonly premium?: number | null;
  readonly renewalDate?: Date | null;
  readonly status: string;
  readonly external: boolean;
}

// ── Explanation ──────────────────────────────────────────────────────────────

/**
 * Confidence, as a stated basis rather than a bare number.
 *
 * `0.42` on its own invites false precision. Pairing the score with the facts
 * it rests on — and the facts that would improve it — turns it into something
 * a customer can act on: "answer these two questions and this gets better".
 */
export interface Confidence {
  /** 0–1. */
  readonly score: number;
  readonly basis: readonly string[];
  /** Profile fields that would raise this if known. */
  readonly improvedBy: readonly string[];
}

/**
 * Why the engine said what it said.
 *
 * Required on every output. `alternatives` is not optional politeness: a
 * recommendation with no stated alternative reads as the only option, which is
 * how people end up over-insured. Naming what else would work, and why it was
 * ranked lower, is the difference between advice and a sales pitch.
 */
export interface Explanation {
  /** The one-sentence answer to "why am I being told this?" */
  readonly why: string;
  /** How the engine arrived at it — the actual reasoning steps. */
  readonly how: readonly string[];
  readonly benefits: readonly string[];
  /** What this does *not* cover, or what it costs. Never omitted. */
  readonly limitations: readonly string[];
  /** What happens if the customer does nothing. */
  readonly risksOfInaction: readonly string[];
  readonly alternatives: readonly Alternative[];
  readonly confidence: Confidence;
}

export interface Alternative {
  readonly option: string;
  readonly whyNotChosen: string;
}

// ── Need analysis ────────────────────────────────────────────────────────────

export const LIFE_STAGES = [
  "YOUNG_INDEPENDENT",
  "YOUNG_FAMILY",
  "ESTABLISHED_FAMILY",
  "PEAK_RESPONSIBILITY",
  "PRE_RETIREMENT",
  "RETIRED",
  "UNKNOWN",
] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export interface NeedReport {
  readonly lifeStage: LifeStage;
  readonly lifeStageNarrative: string;
  /** Annual income the household would lose if the earner stopped earning. */
  readonly financialResponsibility: {
    readonly annualIncome: number | null;
    readonly dependentCount: number;
    readonly yearsOfSupportNeeded: number | null;
    readonly estimatedLifeCoverNeeded: number | null;
  };
  readonly existingCoverage: ReadonlyArray<{
    readonly domain: InsuranceDomain;
    readonly sumInsured: number | null;
    readonly source: "AEGIS" | "EXTERNAL";
  }>;
  readonly protectionGapValue: number | null;
  readonly futureGoals: readonly string[];
  readonly familyNeeds: readonly string[];
  /** Domains in the order the engine believes they matter for this person. */
  readonly coveragePriority: ReadonlyArray<{
    readonly domain: InsuranceDomain;
    readonly rank: number;
    readonly rationale: string;
  }>;
  readonly explanation: Explanation;
}

// ── Recommendation ───────────────────────────────────────────────────────────

export const URGENCY = ["IMMEDIATE", "SOON", "PLANNED", "OPTIONAL"] as const;
export type Urgency = (typeof URGENCY)[number];

/**
 * A recommendation about *protection*, not about a product SKU.
 *
 * This engine says "you need term life cover of about ₹80 lakh, before you
 * upgrade your health plan, and here is why". Choosing which insurer's term
 * plan best fits is the job of the decision engine in `Aegis-AI/layer4`, which
 * already does eligibility, budget matching and plan-level scoring. Keeping
 * those two questions apart is what stops this codebase from growing a second,
 * disagreeing scoring engine.
 */
export interface Recommendation {
  readonly domain: InsuranceDomain;
  readonly headline: string;
  readonly urgency: Urgency;
  /** 0–100. Relative priority *for this customer*, not a product rating. */
  readonly priorityScore: number;
  readonly suggestedSumInsured: number | null;
  readonly estimatedAnnualPremium: { readonly low: number; readonly high: number } | null;
  readonly coverage: readonly string[];
  readonly idealFor: string;
  readonly explanation: Explanation;
}

// ── Coverage gap ─────────────────────────────────────────────────────────────

export const GAP_KINDS = [
  "MISSING",
  "UNDERINSURED",
  "DUPLICATE",
  "OVERLAP",
  "FUTURE_RISK",
  "LAPSED",
] as const;
export type GapKind = (typeof GAP_KINDS)[number];

export const SEVERITIES = ["CRITICAL", "HIGH", "MODERATE", "LOW"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface CoverageGap {
  readonly kind: GapKind;
  readonly domain: InsuranceDomain;
  readonly severity: Severity;
  readonly summary: string;
  /** What it would cost the customer if the gap is not closed, where computable. */
  readonly exposureValue: number | null;
  readonly explanation: Explanation;
}

// ── Risk ─────────────────────────────────────────────────────────────────────

export const RISK_DIMENSIONS = [
  "health",
  "vehicle",
  "travel",
  "property",
  "family",
  "lifestyle",
  "occupation",
  "financial",
] as const;
export type RiskDimension = (typeof RISK_DIMENSIONS)[number];

export const RISK_BANDS = ["LOW", "MODERATE", "ELEVATED", "HIGH", "UNKNOWN"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

/**
 * One dimension of risk.
 *
 * `UNKNOWN` is a first-class band, not a fallback to `LOW`. Treating an unknown
 * as low risk is how somebody with an undisclosed condition gets sold a policy
 * that will not pay — the engine says it does not know, and says what it would
 * need to know.
 */
export interface RiskFactor {
  readonly dimension: RiskDimension;
  readonly band: RiskBand;
  /** 0–100 where higher is more concerning. Null when the band is UNKNOWN. */
  readonly score: number | null;
  readonly drivers: readonly string[];
  readonly mitigations: readonly string[];
}

export interface RiskSummary {
  readonly overall: RiskBand;
  readonly overallScore: number | null;
  readonly factors: readonly RiskFactor[];
  readonly narrative: string;
  readonly explanation: Explanation;
}

// ── Renewal ──────────────────────────────────────────────────────────────────

export interface RenewalForecast {
  readonly policyId: string;
  readonly domain: InsuranceDomain;
  readonly renewalDate: Date;
  readonly daysAway: number;
  readonly priority: Severity;
  /** When to first contact the customer, and why then. */
  readonly reminderOn: Date;
  readonly reminderRationale: string;
  readonly coverageReviewSuggested: boolean;
  readonly improvements: readonly string[];
  readonly explanation: Explanation;
}

// ── Document intelligence ────────────────────────────────────────────────────

export interface DocumentReadiness {
  readonly completeness: number;
  readonly missing: ReadonlyArray<{ readonly documentKey: string; readonly label: string }>;
  readonly expired: ReadonlyArray<{ readonly documentKey: string; readonly label: string }>;
  readonly awaitingVerification: number;
  readonly rejected: number;
  readonly blocksProgress: boolean;
}

// ── The composed report ──────────────────────────────────────────────────────

export interface IntelligenceReport {
  readonly userId: string;
  readonly profileHash: string;
  readonly profileCompleteness: number;
  readonly generatedAt: Date;
  readonly engineVersion: string;
  readonly need: NeedReport;
  readonly recommendations: readonly Recommendation[];
  readonly gaps: readonly CoverageGap[];
  readonly risk: RiskSummary;
  readonly renewals: readonly RenewalForecast[];
  readonly documents: DocumentReadiness | null;
  /**
   * The one thing to say to this customer next.
   *
   * Derived from everything above, because an advisor who opens with seven
   * findings loses the customer. This is what the conversational AI leads with.
   */
  readonly nextBestAction: {
    readonly summary: string;
    readonly domain: InsuranceDomain | null;
    readonly rationale: string;
  };
}
