/**
 * The shape of an intelligence report, as the portals consume it.
 *
 * Mirrors `backend/src/intelligence/types.ts` rather than importing it, because
 * the backend is not in this workspace and a browser bundle must not depend on
 * a server module. The duplication is deliberate and narrow: these are the
 * fields that cross the wire, and a mismatch surfaces immediately as a type
 * error in the portal that reads them.
 */

export const INSURANCE_DOMAINS = [
  "motor",
  "health",
  "life",
  "travel",
  "property",
  "commercial",
] as const;
export type InsuranceDomain = (typeof INSURANCE_DOMAINS)[number];

export const DOMAIN_LABEL: Record<InsuranceDomain, string> = {
  motor: "Vehicle insurance",
  health: "Health insurance",
  life: "Life insurance",
  travel: "Travel insurance",
  property: "Home and property insurance",
  commercial: "Business insurance",
};

export type Severity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
export type Urgency = "IMMEDIATE" | "SOON" | "PLANNED" | "OPTIONAL";
export type RiskBand = "LOW" | "MODERATE" | "ELEVATED" | "HIGH" | "UNKNOWN";
export type GapKind =
  "MISSING" | "UNDERINSURED" | "DUPLICATE" | "OVERLAP" | "FUTURE_RISK" | "LAPSED";

export interface Confidence {
  score: number;
  basis: string[];
  improvedBy: string[];
}

export interface Alternative {
  option: string;
  whyNotChosen: string;
}

export interface Explanation {
  why: string;
  how: string[];
  benefits: string[];
  limitations: string[];
  risksOfInaction: string[];
  alternatives: Alternative[];
  confidence: Confidence;
}

export interface Recommendation {
  domain: InsuranceDomain;
  headline: string;
  urgency: Urgency;
  priorityScore: number;
  suggestedSumInsured: number | null;
  estimatedAnnualPremium: { low: number; high: number } | null;
  coverage: string[];
  idealFor: string;
  explanation: Explanation;
}

export interface CoverageGap {
  kind: GapKind;
  domain: InsuranceDomain;
  severity: Severity;
  summary: string;
  exposureValue: number | null;
  explanation: Explanation;
}

export interface RiskFactor {
  dimension: string;
  band: RiskBand;
  score: number | null;
  drivers: string[];
  mitigations: string[];
}

export interface RiskSummary {
  overall: RiskBand;
  overallScore: number | null;
  factors: RiskFactor[];
  narrative: string;
  explanation: Explanation;
}

export interface RenewalForecast {
  policyId: string;
  domain: InsuranceDomain;
  renewalDate: string;
  daysAway: number;
  priority: Severity;
  reminderOn: string;
  reminderRationale: string;
  coverageReviewSuggested: boolean;
  improvements: string[];
  explanation: Explanation;
}

export interface NeedReport {
  lifeStage: string;
  lifeStageNarrative: string;
  financialResponsibility: {
    annualIncome: number | null;
    dependentCount: number;
    yearsOfSupportNeeded: number | null;
    estimatedLifeCoverNeeded: number | null;
  };
  existingCoverage: Array<{ domain: InsuranceDomain; sumInsured: number | null; source: string }>;
  protectionGapValue: number | null;
  futureGoals: string[];
  familyNeeds: string[];
  coveragePriority: Array<{ domain: InsuranceDomain; rank: number; rationale: string }>;
  explanation: Explanation;
}

export interface DocumentReadiness {
  completeness: number;
  missing: Array<{ documentKey: string; label: string }>;
  expired: Array<{ documentKey: string; label: string }>;
  awaitingVerification: number;
  rejected: number;
  blocksProgress: boolean;
}

export interface IntelligenceReport {
  userId: string;
  profileHash: string;
  profileCompleteness: number;
  generatedAt: string;
  engineVersion: string;
  need: NeedReport;
  recommendations: Recommendation[];
  gaps: CoverageGap[];
  risk: RiskSummary;
  renewals: RenewalForecast[];
  documents: DocumentReadiness | null;
  nextBestAction: { summary: string; domain: InsuranceDomain | null; rationale: string };
}

// ── Presentation vocabulary ──────────────────────────────────────────────────

/**
 * How each severity is said to a customer.
 *
 * `CRITICAL` is never rendered as "CRITICAL". Shouting a status code at
 * somebody about their own insurance produces alarm without understanding, and
 * the people this platform is for have usually been alarmed by insurance
 * paperwork before.
 */
export const SEVERITY_META: Record<
  Severity,
  { label: string; tone: "danger" | "warning" | "info" | "neutral" }
> = {
  CRITICAL: { label: "Needs attention now", tone: "danger" },
  HIGH: { label: "Worth doing soon", tone: "warning" },
  MODERATE: { label: "Worth planning for", tone: "info" },
  LOW: { label: "Something to know", tone: "neutral" },
};

export const URGENCY_META: Record<
  Urgency,
  { label: string; tone: "danger" | "warning" | "info" | "neutral" }
> = {
  IMMEDIATE: { label: "Now", tone: "danger" },
  SOON: { label: "Soon", tone: "warning" },
  PLANNED: { label: "Plan for it", tone: "info" },
  OPTIONAL: { label: "Optional", tone: "neutral" },
};

export const RISK_BAND_META: Record<
  RiskBand,
  { label: string; tone: string; description: string }
> = {
  LOW: { label: "Low", tone: "success", description: "Nothing here raises a concern." },
  MODERATE: {
    label: "Moderate",
    tone: "info",
    description: "Normal for most people in your position.",
  },
  ELEVATED: { label: "Elevated", tone: "warning", description: "Worth factoring into your cover." },
  HIGH: { label: "High", tone: "danger", description: "This shaped the recommendations above." },
  // Rendered as plainly as the others, never greyed out into invisibility. An
  // unknown is a question the platform still needs answered, not a null state.
  UNKNOWN: {
    label: "Not known yet",
    tone: "neutral",
    description: "We have not been told enough to assess this.",
  },
};

export const GAP_KIND_LABEL: Record<GapKind, string> = {
  MISSING: "You have no cover here",
  UNDERINSURED: "Your cover may be too small",
  DUPLICATE: "You may be paying twice",
  OVERLAP: "Two policies overlap",
  FUTURE_RISK: "Something to plan for",
  LAPSED: "Cover has stopped",
};

/** ₹80,00,000 → "₹80 lakh". The way the number is said in India. */
export function formatRupees(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 10_000_000) {
    const cr = value / 10_000_000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} crore`;
  }
  if (value >= 100_000) {
    const l = value / 100_000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)} lakh`;
  }
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/**
 * Confidence as words, with the number alongside.
 *
 * "62%" alone invites a precision that a rule engine on self-reported facts
 * does not have. The phrase carries the meaning; the number is there for
 * anybody who wants it.
 */
export function confidenceLabel(score: number): string {
  if (score >= 0.8) return "We are confident about this";
  if (score >= 0.55) return "Reasonably confident";
  if (score >= 0.3) return "A starting point — we are missing some facts";
  return "Very rough — we know little about you yet";
}
