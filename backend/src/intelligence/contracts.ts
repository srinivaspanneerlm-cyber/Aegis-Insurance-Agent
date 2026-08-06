/**
 * The service contracts of the Intelligence Engine, and the registry that binds
 * them.
 *
 * Six capabilities, six interfaces, injected rather than imported. The reason
 * is not architectural fashion — it is that these six things will be replaced
 * at different times and by different kinds of implementation. Need analysis is
 * deterministic arithmetic and will stay that way. Risk analysis will
 * eventually be a model. Policy matching will eventually be an insurer's API
 * behind a network call. Code that constructs its collaborators cannot make
 * those substitutions one at a time.
 *
 * The concrete implementations in this directory are deliberately deterministic
 * and rule-driven: given the same profile they return the same advice, and the
 * reasoning can be read in the source. That matters for insurance advice
 * specifically, because "why was I told this?" is a question with regulatory
 * weight, and "the model said so" is not an answer.
 */
import type {
  CoverageGap,
  DocumentReadiness,
  InsuranceDomain,
  InsuranceProfileFacts,
  IntelligenceReport,
  NeedReport,
  Recommendation,
  RenewalForecast,
  RiskSummary,
} from "./types";

// ── The six core services ────────────────────────────────────────────────────

export interface NeedAnalysisService {
  analyse(profile: InsuranceProfileFacts): Promise<NeedReport>;
}

export interface RiskAnalysisService {
  assess(profile: InsuranceProfileFacts): Promise<RiskSummary>;
}

export interface CoverageGapService {
  detect(profile: InsuranceProfileFacts, need: NeedReport): Promise<readonly CoverageGap[]>;
}

export interface RenewalPredictionService {
  forecast(profile: InsuranceProfileFacts): Promise<readonly RenewalForecast[]>;
}

export interface InsuranceRecommendationService {
  recommend(
    profile: InsuranceProfileFacts,
    context: { readonly need: NeedReport; readonly risk: RiskSummary; readonly gaps: readonly CoverageGap[] }
  ): Promise<readonly Recommendation[]>;
}

/**
 * Turns a protection recommendation into named products.
 *
 * Separate from `InsuranceRecommendationService` on purpose. That one decides
 * *what cover a person needs*; this one decides *which product provides it*.
 * The second question depends on insurer catalogues, live pricing and
 * eligibility rules that this platform does not own — and it is already
 * answered, for the domains it covers, by the decision engine in
 * `Aegis-AI/layer4`. Keeping the seam here means that engine can be plugged in
 * without the rest of the intelligence layer knowing it changed.
 */
export interface PolicyMatchingService {
  match(
    profile: InsuranceProfileFacts,
    recommendation: Recommendation
  ): Promise<{
    readonly available: boolean;
    /** Present when `available`. Empty otherwise, with `reason` populated. */
    readonly matches: ReadonlyArray<{
      readonly productName: string;
      readonly insurer: string;
      readonly annualPremium: number | null;
      readonly sumInsured: number | null;
      readonly score: number | null;
      readonly justification: string;
    }>;
    readonly reason?: string;
  }>;
}

// ── Document intelligence (Sprint 8 seam) ────────────────────────────────────

export interface DocumentIntelligenceService {
  readiness(userId: string, domain: InsuranceDomain | null): Promise<DocumentReadiness>;
}

// ── Future-ready seams ───────────────────────────────────────────────────────
//
// Declared, not implemented. Each of these is a real integration this platform
// will need and does not have, and writing the interface now is what keeps the
// eventual integration from being threaded through the engine by hand.
//
// None of them has a simulated implementation that returns plausible data. A
// stub premium calculator returning a believable number is worse than no
// calculator, because somebody will quote it to a customer.

/** An insurer's own quotation and issuance API. */
export interface InsurerApiService {
  readonly insurer: string;
  quote(request: unknown): Promise<unknown>;
  issue(request: unknown): Promise<unknown>;
}

/**
 * IRDAI regulatory data — product filings, mandated wordings, circulars.
 *
 * Modelled as a feed rather than a lookup because the compliance question is
 * usually "what changed since we last checked", not "what is the rule today".
 */
export interface IrdaiUpdateService {
  since(cursor: string | null): Promise<{ readonly cursor: string; readonly updates: readonly unknown[] }>;
}

export interface PremiumCalculatorService {
  calculate(input: unknown): Promise<{ readonly premium: number; readonly breakdown: unknown }>;
}

export interface ClaimsSystemService {
  history(customerRef: string): Promise<readonly unknown[]>;
  register(claim: unknown): Promise<{ readonly claimRef: string }>;
}

/**
 * A trained model, as opposed to the rule engines above.
 *
 * Returns its own confidence and the features it used, because a prediction
 * this platform cannot explain is a prediction it will not show a customer.
 */
export interface PredictiveModelService {
  readonly name: string;
  predict(features: Record<string, unknown>): Promise<{
    readonly value: number;
    readonly confidence: number;
    readonly featuresUsed: readonly string[];
  }>;
}

// ── The registry ─────────────────────────────────────────────────────────────

export interface IntelligenceServices {
  readonly need: NeedAnalysisService;
  readonly risk: RiskAnalysisService;
  readonly gaps: CoverageGapService;
  readonly renewals: RenewalPredictionService;
  readonly recommendations: InsuranceRecommendationService;
  readonly matching: PolicyMatchingService;
  readonly documents: DocumentIntelligenceService;
}

/** Optional integrations. Absent until a deployment provides them. */
export interface IntelligenceIntegrations {
  readonly insurers?: readonly InsurerApiService[];
  readonly irdai?: IrdaiUpdateService;
  readonly premium?: PremiumCalculatorService;
  readonly claims?: ClaimsSystemService;
  readonly models?: Readonly<Record<string, PredictiveModelService>>;
}

export interface IntelligenceEngine {
  readonly version: string;
  readonly services: IntelligenceServices;
  readonly integrations: IntelligenceIntegrations;
  /** Runs every service and composes one report. */
  report(profile: InsuranceProfileFacts): Promise<IntelligenceReport>;
}
