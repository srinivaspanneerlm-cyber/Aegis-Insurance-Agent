/**
 * Intelligence analytics — the employee brief and the admin aggregates.
 *
 * Everything here is derived from stored `IntelligenceRun` payloads rather than
 * recomputed. That is a deliberate trade: the numbers describe the advice the
 * platform *actually gave*, which is the thing worth measuring. Recomputing
 * would report what the current engine would say today, and would quietly
 * rewrite history every time the rules changed.
 *
 * Where there is no data, these methods say so with `{ available: false,
 * reason, needs }` rather than returning a zero. A dashboard showing "0%
 * recommendation success" when nothing has been tracked is worse than one that
 * says the tracking does not exist — the first looks like a business problem,
 * the second is an engineering one.
 */
import prisma from "../config/db";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { intelligenceService } from "./intelligence.service";
import {
  DOMAIN_LABEL,
  INSURANCE_DOMAINS,
  type CoverageGap,
  type InsuranceDomain,
  type IntelligenceReport,
  type Recommendation,
  type RiskBand,
} from "../intelligence/types";

interface Actor {
  readonly id: string;
  readonly role: string;
}

/** The shape used everywhere a metric has no data source yet. */
interface Unavailable {
  readonly available: false;
  readonly reason: string;
  readonly needs: string;
}

/** Reads the most recent stored run per customer, parsed. */
async function latestRuns(limit = 500): Promise<IntelligenceReport[]> {
  const runs = await prisma.intelligenceRun.findMany({
    where: { kind: "FULL" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { userId: true, payload: true },
  });

  const seen = new Set<string>();
  const out: IntelligenceReport[] = [];
  for (const run of runs) {
    if (!run.userId || seen.has(run.userId)) continue;
    seen.add(run.userId);
    try {
      out.push(JSON.parse(run.payload) as IntelligenceReport);
    } catch {
      // A corrupt row is excluded from the aggregate rather than failing it.
    }
  }
  return out;
}

export const analyticsService = {
  /**
   * One customer, as an employee needs to see them before a conversation.
   *
   * Ordered by what to say first, not by what is easiest to compute. The brief
   * leads with the next best action because an advisor who opens with seven
   * findings loses the customer in the first minute.
   */
  async customerBrief(actor: Actor, userId: string) {
    if (!userId) throw new AppError("No customer was named.", 400, "USER_REQUIRED");

    const customer = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, email: true, realm: true, createdAt: true },
    });
    if (!customer) throw new AppError("That customer does not exist.", 404, "NOT_FOUND");

    // Goes through the same authorisation as every other read, so an employee
    // cannot reach a profile here that they could not reach directly.
    const report = await intelligenceService.report(actor, { targetUserId: userId });

    auditService.record({
      actorId: actor.id,
      action: "intelligence.brief.viewed",
      metadata: { customerId: userId },
    });

    const urgentRenewals = report.renewals.filter(
      (r) => r.priority === "CRITICAL" || r.priority === "HIGH"
    );

    return {
      customer,
      profileCompleteness: report.profileCompleteness,
      // The one-line summary an advisor reads before dialling.
      openWith: report.nextBestAction,
      lifeStage: {
        stage: report.need.lifeStage,
        narrative: report.need.lifeStageNarrative,
      },
      suggestedPolicies: report.recommendations.slice(0, 3).map((r) => ({
        domain: r.domain,
        label: DOMAIN_LABEL[r.domain],
        headline: r.headline,
        urgency: r.urgency,
        priorityScore: r.priorityScore,
        suggestedSumInsured: r.suggestedSumInsured,
        // The employee gets the same reasoning the customer will see, so the
        // two are never working from different explanations of the same advice.
        why: r.explanation.why,
        talkingPoints: r.explanation.how,
        limitations: r.explanation.limitations,
        confidence: r.explanation.confidence.score,
      })),
      coverageInsights: report.gaps.slice(0, 5).map((g) => ({
        kind: g.kind,
        domain: g.domain,
        severity: g.severity,
        summary: g.summary,
        exposureValue: g.exposureValue,
      })),
      risk: {
        overall: report.risk.overall,
        narrative: report.risk.narrative,
        raised: report.risk.factors
          .filter((f) => f.band === "HIGH" || f.band === "ELEVATED")
          .map((f) => ({ dimension: f.dimension, band: f.band, drivers: f.drivers })),
        unknown: report.risk.factors.filter((f) => f.band === "UNKNOWN").map((f) => f.dimension),
      },
      missingDocuments: report.documents?.missing ?? [],
      documentsBlocked: report.documents?.blocksProgress ?? false,
      renewalAlerts: urgentRenewals.map((r) => ({
        domain: r.domain,
        renewalDate: r.renewalDate,
        daysAway: r.daysAway,
        priority: r.priority,
        improvements: r.improvements,
      })),
      /**
       * Claim observations.
       *
       * Declared unavailable rather than fabricated. Claims live in a system
       * this platform does not yet talk to — `ClaimsSystemService` is the seam
       * for it — and inventing a claim history would be the single most
       * damaging thing this brief could get wrong.
       */
      claimObservations: {
        available: false,
        reason: "No claims system is connected.",
        needs:
          "An implementation of ClaimsSystemService (src/intelligence/contracts.ts) pointed at the insurer's claims platform.",
      } satisfies Unavailable,
      /** What the advisor should ask about, most valuable first. */
      askAbout: report.need.explanation.confidence.improvedBy.slice(0, 3),
    };
  },

  /**
   * Customers an advisor can look up, for choosing whose brief to open.
   *
   * Deliberately thin: name, email, and whether a profile exists. An advisor
   * picking somebody from a list does not need their risk band on screen, and
   * putting it there would spread one customer's assessment across every search
   * result an employee ever types.
   *
   * Always bounded, never unbounded — an empty search returns the most recent
   * customers rather than all of them.
   */
  async searchCustomers(actor: Actor, search: string | undefined, take = 20) {
    const limit = Math.min(Math.max(take, 1), 50);
    const customers = await prisma.user.findMany({
      where: {
        realm: "CUSTOMER",
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        insuranceProfile: { select: { completeness: true, updatedAt: true } },
      },
    });

    auditService.record({
      actorId: actor.id,
      action: "intelligence.customers.searched",
      metadata: { search: search ?? null, results: customers.length },
    });

    return {
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        joinedAt: c.createdAt,
        profileCompleteness: c.insuranceProfile?.completeness ?? 0,
        hasProfile: c.insuranceProfile !== null,
      })),
    };
  },

  /** Business overview. Aggregates only — nothing here identifies a customer. */
  async overview() {
    const [profileCount, runCount, policyCount, reports] = await Promise.all([
      prisma.insuranceProfile.count(),
      prisma.intelligenceRun.count(),
      prisma.heldPolicy.count(),
      latestRuns(),
    ]);

    const recommendations = reports.flatMap((r) => r.recommendations);
    const byDomain = new Map<InsuranceDomain, number>();
    for (const rec of recommendations) {
      byDomain.set(rec.domain, (byDomain.get(rec.domain) ?? 0) + 1);
    }

    const mostRecommended = [...byDomain.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({
        domain,
        label: DOMAIN_LABEL[domain],
        count,
        share: recommendations.length === 0 ? 0 : Math.round((count / recommendations.length) * 100),
      }));

    const completenessValues = reports.map((r) => r.profileCompleteness);
    const averageCompleteness =
      completenessValues.length === 0
        ? null
        : Math.round(completenessValues.reduce((a, b) => a + b, 0) / completenessValues.length);

    return {
      profiles: profileCount,
      analysesRun: runCount,
      policiesTracked: policyCount,
      customersAnalysed: reports.length,
      averageProfileCompleteness: averageCompleteness,
      mostRecommendedProducts: mostRecommended,
      /**
       * Whether a recommendation led to a sale.
       *
       * There is no link between an `IntelligenceRun` and a policy purchase,
       * because nothing writes one. Reporting a success rate would mean
       * inventing the denominator.
       */
      recommendationSuccess: {
        available: false,
        reason:
          "Nothing records whether a recommendation resulted in a policy being bought.",
        needs:
          "A conversion link — writing the originating IntelligenceRun id onto HeldPolicy when a policy is sold through the platform.",
      } satisfies Unavailable,
      /** Trend over time needs a time series this schema does not retain per-day. */
      customerTrends: {
        available: false,
        reason: "Runs are stored, but nothing aggregates them into a daily series.",
        needs:
          "A scheduled rollup writing daily counts, or a query window once there is enough history to be meaningful.",
      } satisfies Unavailable,
    };
  },

  /** How risk is distributed across analysed customers. */
  async riskDistribution() {
    const reports = await latestRuns();

    const bands: Record<RiskBand, number> = {
      LOW: 0,
      MODERATE: 0,
      ELEVATED: 0,
      HIGH: 0,
      UNKNOWN: 0,
    };
    for (const r of reports) bands[r.risk.overall] += 1;

    // Per-dimension, so a heatmap can show *which* risk is concentrated where
    // rather than only how many customers are "high risk" overall.
    const dimensions = new Map<string, Record<RiskBand, number>>();
    for (const report of reports) {
      for (const factor of report.risk.factors) {
        const row =
          dimensions.get(factor.dimension) ??
          ({ LOW: 0, MODERATE: 0, ELEVATED: 0, HIGH: 0, UNKNOWN: 0 } as Record<RiskBand, number>);
        row[factor.band] += 1;
        dimensions.set(factor.dimension, row);
      }
    }

    return {
      customersAnalysed: reports.length,
      overall: bands,
      heatmap: [...dimensions.entries()].map(([dimension, counts]) => ({ dimension, counts })),
      note:
        reports.length === 0
          ? "No analyses have been run yet, so every count is zero because nothing has happened — not because risk is absent."
          : `Based on the most recent analysis for each of ${reports.length} customers.`,
    };
  },

  /** Which gaps the platform keeps finding. */
  async gapTrends() {
    const reports = await latestRuns();
    const gaps: CoverageGap[] = reports.flatMap((r) => r.gaps);

    const byKind = new Map<string, number>();
    const byDomain = new Map<string, number>();
    let quantifiedExposure = 0;
    let quantifiedCount = 0;

    for (const gap of gaps) {
      byKind.set(gap.kind, (byKind.get(gap.kind) ?? 0) + 1);
      byDomain.set(gap.domain, (byDomain.get(gap.domain) ?? 0) + 1);
      if (gap.exposureValue !== null) {
        quantifiedExposure += gap.exposureValue;
        quantifiedCount += 1;
      }
    }

    return {
      customersAnalysed: reports.length,
      totalGaps: gaps.length,
      averagePerCustomer:
        reports.length === 0 ? 0 : Number((gaps.length / reports.length).toFixed(1)),
      byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, count })),
      byDomain: INSURANCE_DOMAINS.map((domain) => ({
        domain,
        label: DOMAIN_LABEL[domain],
        count: byDomain.get(domain) ?? 0,
      })),
      // Only the gaps whose value could actually be computed. Summing the rest
      // as zero would understate the exposure and look like precision.
      quantifiedExposure: {
        total: Math.round(quantifiedExposure),
        fromGaps: quantifiedCount,
        ofTotalGaps: gaps.length,
      },
      severity: {
        critical: gaps.filter((g) => g.severity === "CRITICAL").length,
        high: gaps.filter((g) => g.severity === "HIGH").length,
        moderate: gaps.filter((g) => g.severity === "MODERATE").length,
        low: gaps.filter((g) => g.severity === "LOW").length,
      },
    };
  },

  /**
   * Renewals ahead.
   *
   * Read from `HeldPolicy` directly rather than from stored runs, because a
   * renewal date is a fact rather than an analysis — and it must be current
   * even for a customer whose report has not been regenerated this week.
   */
  async renewalAnalytics() {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 86_400_000);

    const [upcoming, overdue, total] = await Promise.all([
      prisma.heldPolicy.findMany({
        where: { status: "ACTIVE", renewalDate: { gte: now, lte: in90 } },
        select: { domain: true, renewalDate: true, premium: true },
        orderBy: { renewalDate: "asc" },
        take: 500,
      }),
      prisma.heldPolicy.count({
        where: { status: "ACTIVE", renewalDate: { lt: now } },
      }),
      prisma.heldPolicy.count({ where: { status: "ACTIVE" } }),
    ]);

    const buckets = { within7: 0, within30: 0, within60: 0, within90: 0 };
    const byDomain = new Map<string, number>();
    let premiumAtRisk = 0;

    for (const policy of upcoming) {
      if (!policy.renewalDate) continue;
      const days = Math.round((policy.renewalDate.getTime() - now.getTime()) / 86_400_000);
      if (days <= 7) buckets.within7 += 1;
      else if (days <= 30) buckets.within30 += 1;
      else if (days <= 60) buckets.within60 += 1;
      else buckets.within90 += 1;

      byDomain.set(policy.domain, (byDomain.get(policy.domain) ?? 0) + 1);
      premiumAtRisk += policy.premium ?? 0;
    }

    return {
      activePolicies: total,
      overdue,
      upcoming90Days: upcoming.length,
      buckets,
      byDomain: [...byDomain.entries()].map(([domain, count]) => ({ domain, count })),
      premiumAtRisk: Math.round(premiumAtRisk),
      premiumAtRiskNote:
        "Sums only the policies with a premium recorded. Policies without one contribute nothing rather than an estimate.",
      /** Whether customers actually renew. Needs outcomes nobody writes yet. */
      renewalRate: {
        available: false,
        reason: "Nothing records whether a policy was renewed, lapsed, or moved to another insurer.",
        needs:
          "A renewal outcome written back to HeldPolicy at each renewal date, or a feed from the insurer's policy system.",
      } satisfies Unavailable,
    };
  },
};

/** Re-exported so a caller can label a recommendation without a second import. */
export type { Recommendation };
