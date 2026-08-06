/**
 * The Insurance Intelligence Engine.
 *
 * Composes the six services into one report and decides the single thing to say
 * next. Construction is by injection throughout — `createIntelligenceEngine`
 * takes a partial set of services and fills the rest with the rule-based
 * defaults, so a deployment can replace risk analysis with a model without
 * touching anything else, and a test can replace all six.
 */
import crypto from "node:crypto";
import prisma from "../config/db";
import type {
  DocumentIntelligenceService,
  IntelligenceEngine,
  IntelligenceIntegrations,
  IntelligenceServices,
} from "./contracts";
import { RuleBasedCoverageGap } from "./coverageGap";
import { RuleBasedNeedAnalysis } from "./needAnalysis";
import { RuleBasedRecommendation, UnavailablePolicyMatching } from "./recommendation";
import { RuleBasedRenewalPrediction } from "./renewal";
import { RuleBasedRiskAnalysis } from "./risk";
import { profileCompleteness } from "./explain";
import {
  DOMAIN_LABEL,
  type DocumentReadiness,
  type InsuranceDomain,
  type InsuranceProfileFacts,
  type IntelligenceReport,
} from "./types";

export const ENGINE_VERSION = "1.0.0";

/**
 * Reads document readiness from the Sprint 8 platform.
 *
 * Queries the document tables directly rather than calling `documentService`,
 * because that service scopes by the *calling actor* and this runs as the
 * engine on behalf of a customer. Routing it through the actor-scoped service
 * would either require faking an actor or widening that service's scope rules —
 * both worse than a read-only query with the user id stated explicitly.
 */
export class PrismaDocumentIntelligence implements DocumentIntelligenceService {
  async readiness(userId: string, domain: InsuranceDomain | null): Promise<DocumentReadiness> {
    const [requests, documents] = await Promise.all([
      prisma.documentRequest.findMany({
        where: { subjectId: userId, ...(domain ? { domain } : {}) },
        select: { documentKey: true, label: true, status: true, required: true },
      }),
      prisma.uploadedDocument.findMany({
        where: { ownerId: userId, deletedAt: null, ...(domain ? { domain } : {}) },
        select: { documentKey: true, status: true, filename: true },
      }),
    ]);

    const missing = requests
      .filter((r) => r.required && r.status === "PENDING")
      .map((r) => ({ documentKey: r.documentKey, label: r.label }));

    const rejected = documents.filter((d) => d.status === "REJECTED");
    const awaiting = documents.filter(
      (d) => d.status === "PENDING_REVIEW" || d.status === "PROCESSING" || d.status === "UPLOADED"
    ).length;

    const requiredCount = requests.filter((r) => r.required).length;
    const satisfied = requiredCount - missing.length;
    const completeness =
      requiredCount === 0 ? 100 : Math.round((satisfied / requiredCount) * 100);

    return {
      completeness,
      missing,
      // Expiry needs a document-level expiry date, which the Sprint 8 schema
      // does not capture. Reporting an empty list rather than guessing from the
      // upload date, which would flag documents that never expire.
      expired: [],
      awaitingVerification: awaiting,
      rejected: rejected.length,
      blocksProgress: missing.length > 0 || rejected.length > 0,
    };
  }
}

/** A stable identity for a set of facts, so a cached report can be invalidated. */
export function hashProfile(profile: InsuranceProfileFacts): string {
  const stable = JSON.stringify(profile, Object.keys(profile).sort());
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32);
}

export function defaultServices(): IntelligenceServices {
  return {
    need: new RuleBasedNeedAnalysis(),
    risk: new RuleBasedRiskAnalysis(),
    gaps: new RuleBasedCoverageGap(),
    renewals: new RuleBasedRenewalPrediction(),
    recommendations: new RuleBasedRecommendation(),
    matching: new UnavailablePolicyMatching(),
    documents: new PrismaDocumentIntelligence(),
  };
}

class Engine implements IntelligenceEngine {
  readonly version = ENGINE_VERSION;

  constructor(
    readonly services: IntelligenceServices,
    readonly integrations: IntelligenceIntegrations
  ) {}

  async report(profile: InsuranceProfileFacts): Promise<IntelligenceReport> {
    // Need analysis first — gaps and recommendations both depend on it. Risk and
    // renewals do not, so they run alongside rather than after.
    const [need, risk, renewals] = await Promise.all([
      this.services.need.analyse(profile),
      this.services.risk.assess(profile),
      this.services.renewals.forecast(profile),
    ]);

    const gaps = await this.services.gaps.detect(profile, need);
    const recommendations = await this.services.recommendations.recommend(profile, {
      need,
      risk,
      gaps,
    });

    // Documents are best-effort: a failure to read them must not deny somebody
    // their coverage analysis, which is the part that matters.
    let documents: DocumentReadiness | null = null;
    try {
      documents = await this.services.documents.readiness(profile.userId, null);
    } catch {
      documents = null;
    }

    return {
      userId: profile.userId,
      profileHash: hashProfile(profile),
      profileCompleteness: profileCompleteness(profile),
      generatedAt: new Date(),
      engineVersion: this.version,
      need,
      recommendations,
      gaps,
      risk,
      renewals,
      documents,
      nextBestAction: nextBestAction({ need, recommendations, gaps, renewals, documents, profile }),
    };
  }
}

/**
 * The one thing to say next.
 *
 * Ordered by what would hurt most if ignored, not by what is most profitable.
 * An overdue renewal beats a new recommendation, because losing existing cover
 * costs the customer more than not yet having new cover — and a customer whose
 * lapse went unmentioned while they were sold something else has been failed.
 */
function nextBestAction(input: {
  need: IntelligenceReport["need"];
  recommendations: IntelligenceReport["recommendations"];
  gaps: IntelligenceReport["gaps"];
  renewals: IntelligenceReport["renewals"];
  documents: DocumentReadiness | null;
  profile: InsuranceProfileFacts;
}): IntelligenceReport["nextBestAction"] {
  const { need, recommendations, gaps, renewals, documents, profile } = input;

  const overdue = renewals.find((r) => r.daysAway < 0);
  if (overdue) {
    return {
      summary: `Your ${DOMAIN_LABEL[overdue.domain].toLowerCase()} renewal date has passed. Let us check whether it has lapsed.`,
      domain: overdue.domain,
      rationale:
        "A policy that has lapsed pays nothing, and for health cover a lapse restarts every waiting period. This comes before anything else.",
    };
  }

  const urgentRenewal = renewals.find((r) => r.priority === "CRITICAL");
  if (urgentRenewal) {
    return {
      summary: `Your ${DOMAIN_LABEL[urgentRenewal.domain].toLowerCase()} renews in ${urgentRenewal.daysAway} days.`,
      domain: urgentRenewal.domain,
      rationale: "Keeping cover you already have is worth more than adding cover you do not.",
    };
  }

  const critical = gaps.find((g) => g.severity === "CRITICAL");
  if (critical) {
    return {
      summary: critical.summary,
      domain: critical.domain,
      rationale: critical.explanation.why,
    };
  }

  if (documents?.blocksProgress && documents.missing.length > 0) {
    const first = documents.missing[0];
    return {
      summary: `We still need your ${first?.label ?? "documents"} before this can move forward.`,
      domain: null,
      rationale:
        "An application waiting on a document is not progressing, and the customer usually does not know it is stuck.",
    };
  }

  // Asking comes before advising on a nearly blank profile. The engine can
  // always produce *a* recommendation — everybody needs health cover — but
  // leading with one derived from no facts is how a customer learns that the
  // advice is generic. The recommendations are still returned; they are just
  // not what we open with.
  const completeness = profileCompleteness(profile);
  if (completeness < 40) {
    return {
      summary: "Tell us a little more about your situation so we can be useful.",
      domain: null,
      rationale: `We know about ${completeness}% of what we would need. ${need.explanation.confidence.improvedBy.slice(0, 2).join(" and ")} would help most.`,
    };
  }

  const top = recommendations[0];
  if (top) {
    return { summary: top.headline, domain: top.domain, rationale: top.explanation.why };
  }

  return {
    summary: "Nothing needs attention right now. Your cover looks appropriate for your situation.",
    domain: null,
    rationale:
      "No missing cover, no shortfall, and no renewal approaching. We will tell you when that changes.",
  };
}

/**
 * Builds an engine.
 *
 * Every service is overridable; anything not supplied gets the rule-based
 * default. This is the whole dependency-injection surface of the module — there
 * is no container and no decorators, because seven constructor arguments do not
 * need one.
 */
export function createIntelligenceEngine(
  overrides: Partial<IntelligenceServices> = {},
  integrations: IntelligenceIntegrations = {}
): IntelligenceEngine {
  return new Engine({ ...defaultServices(), ...overrides }, integrations);
}

/** The engine the application uses. Swappable for the same reasons as the pipeline. */
let active: IntelligenceEngine = createIntelligenceEngine();

export const intelligenceEngine = (): IntelligenceEngine => active;

export function registerIntelligenceEngine(engine: IntelligenceEngine): void {
  active = engine;
}

export function resetIntelligenceEngine(): void {
  active = createIntelligenceEngine();
}
