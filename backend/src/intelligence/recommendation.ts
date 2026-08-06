/**
 * Recommendations, and the seam to plan-level matching.
 *
 * This service answers "what protection does this person need, and in what
 * order". It does not answer "which insurer's product should they buy" — that
 * is `PolicyMatchingService`, and for the domains it covers it is already
 * answered by the decision engine under `Aegis-AI/layer4`, which does
 * eligibility, budget matching and plan scoring against real product data.
 *
 * Keeping those two apart is the single most important decision in this module.
 * Collapsing them would mean a second scoring engine, in a second language,
 * disagreeing with the first about which health plan suits a customer — and the
 * customer would have no way to know which answer they were getting.
 */
import type { InsuranceRecommendationService, PolicyMatchingService } from "./contracts";
import { confidenceFrom, formatRupees, roundToReadable } from "./explain";
import {
  DOMAIN_LABEL,
  INCOME_MIDPOINT,
  type CoverageGap,
  type InsuranceDomain,
  type InsuranceProfileFacts,
  type NeedReport,
  type Recommendation,
  type RiskSummary,
  type Urgency,
} from "./types";

/** What each kind of cover actually pays for, in plain words. */
const COVERAGE_NOTES: Record<InsuranceDomain, readonly string[]> = {
  motor: [
    "Injury or damage you cause to other people and their property — the part required by law",
    "Damage to your own vehicle from accident, fire or theft",
    "Cover for you as the driver, through a personal accident section",
  ],
  health: [
    "Hospital admission, including room, treatment and surgery",
    "Day-care procedures that no longer need an overnight stay",
    "Treatment before and after admission, usually 30 and 60 days",
    "Ambulance charges, up to a limit",
  ],
  life: [
    "A lump sum to your family if you die during the policy term",
    "Optional: a payout on being diagnosed with a listed critical illness",
    "Optional: waiver of future premiums if you become disabled",
  ],
  travel: [
    "Medical treatment abroad, which your Indian health policy does not cover",
    "Trip cancellation and delay",
    "Lost baggage and lost passport",
    "Emergency evacuation home",
  ],
  property: [
    "Rebuilding after fire, flood, storm or earthquake",
    "Your belongings inside the property",
    "Burglary",
    "Alternative accommodation while the property is uninhabitable",
  ],
  commercial: [
    "Your liability toward employees and the public",
    "Stock, equipment and premises",
    "Business interruption while you cannot trade",
  ],
};

const IDEAL_FOR: Record<InsuranceDomain, string> = {
  motor: "Anyone who owns a vehicle. It is not optional — third-party cover is required by law.",
  health:
    "Everyone, and most urgently households without the savings to absorb a hospital bill.",
  life: "Anyone whose income other people depend on. Not needed if nobody does.",
  travel: "Anyone travelling abroad, and anyone travelling often enough to forget to buy it per trip.",
  property: "Anyone who owns a home, and especially anyone still repaying a loan on one.",
  commercial: "Anyone earning from a vehicle, premises or stock, and anyone who employs people.",
};

/**
 * Rough annual premium bands, expressed as a range and labelled as an estimate.
 *
 * These are order-of-magnitude figures for guidance, not quotes. The engine
 * never presents them as a price, and `PolicyMatchingService` replaces them
 * with real numbers the moment an insurer integration exists. Showing nothing
 * would be worse: a customer deciding whether term cover is affordable needs to
 * know whether it costs a thousand rupees or fifty thousand.
 */
function estimatePremium(
  domain: InsuranceDomain,
  sumInsured: number | null,
  profile: InsuranceProfileFacts
): { low: number; high: number } | null {
  const age = profile.age;

  if (domain === "life") {
    if (sumInsured === null || age === null || age === undefined) return null;

    // Rates per lakh of cover per year, for term insurance in India. Term is
    // the cheapest insurance sold — most people outlive it — and getting this
    // an order of magnitude wrong is not a harmless approximation: somebody
    // reading "two lakh a year" concludes they cannot afford cover that would
    // actually cost them a few thousand rupees a month.
    const perLakh = age < 30 ? 120 : age < 40 ? 180 : age < 50 ? 380 : 850;
    const lakhs = sumInsured / 100_000;

    // Large sums cost less per lakh — the insurer's fixed costs are spread over
    // more cover. Without this the estimate for a crore-plus policy, which is
    // exactly what a family earner needs, comes out far too high.
    const volumeFactor = sumInsured > 10_000_000 ? 0.75 : sumInsured > 5_000_000 ? 0.85 : 1;
    const smokerFactor = profile.smoker ? 1.5 : 1;

    const mid = lakhs * perLakh * volumeFactor * smokerFactor;
    return { low: roundToReadable(mid * 0.8), high: roundToReadable(mid * 1.35) };
  }

  if (domain === "health") {
    if (sumInsured === null || age === null || age === undefined) return null;
    const family = profile.familyMembers ?? 1;

    // One adult, ₹5 lakh cover, per year.
    const base = age < 35 ? 6_000 : age < 45 ? 8_000 : age < 60 ? 14_000 : 26_000;

    // Premium rises far more slowly than the sum insured — doubling cover adds
    // roughly a third, not double, because the expensive part is the first
    // rupee of risk rather than the last. A linear factor here overstated a
    // ₹20 lakh family floater by about three times.
    const sumFactor = Math.pow(Math.max(sumInsured, 500_000) / 500_000, 0.45);

    // A floater is shared cover, so it is cheaper than one policy per person.
    // Capped at four: insurers price the fifth member and beyond as marginal.
    const familyFactor = 1 + Math.min(Math.max(family - 1, 0), 3) * 0.4;

    const mid = base * sumFactor * familyFactor;
    return { low: roundToReadable(mid * 0.8), high: roundToReadable(mid * 1.4) };
  }

  if (domain === "motor") {
    const vehicle = (profile.vehicles ?? [])[0];
    if (!vehicle) return null;
    const bands: Record<string, { low: number; high: number }> = {
      TWO_WHEELER: { low: 1_500, high: 4_000 },
      CAR: { low: 8_000, high: 25_000 },
      COMMERCIAL: { low: 15_000, high: 45_000 },
      OTHER: { low: 5_000, high: 20_000 },
    };
    return bands[vehicle.kind] ?? bands.OTHER ?? null;
  }

  if (domain === "travel") {
    const f = profile.travelFrequency;
    if (f === "INTERNATIONAL" || f === "FREQUENT") return { low: 4_000, high: 12_000 };
    return { low: 500, high: 2_500 };
  }

  if (domain === "property") return { low: 3_000, high: 15_000 };
  if (domain === "commercial") return { low: 10_000, high: 60_000 };
  return null;
}

export class RuleBasedRecommendation implements InsuranceRecommendationService {
  async recommend(
    profile: InsuranceProfileFacts,
    context: { need: NeedReport; risk: RiskSummary; gaps: readonly CoverageGap[] }
  ): Promise<readonly Recommendation[]> {
    const { need, risk, gaps } = context;
    const out: Recommendation[] = [];

    // Driven by the gaps rather than by the priority list, so the engine only
    // ever recommends something the customer does not already have enough of.
    // Recommending health cover to somebody who holds plenty is the fastest way
    // to be dismissed as a sales funnel.
    const actionable = gaps.filter(
      (g) => g.kind === "MISSING" || g.kind === "UNDERINSURED" || g.kind === "LAPSED"
    );

    for (const gap of actionable) {
      const sumInsured = this.sumInsuredFor(profile, need, gap);
      const priorityRank =
        need.coveragePriority.find((p) => p.domain === gap.domain)?.rank ?? 99;

      const priorityScore = this.score(gap, priorityRank, risk);
      const urgency = this.urgencyFor(gap, priorityScore);

      out.push({
        domain: gap.domain,
        headline: this.headline(gap, sumInsured),
        urgency,
        priorityScore,
        suggestedSumInsured: sumInsured,
        estimatedAnnualPremium: estimatePremium(gap.domain, sumInsured, profile),
        coverage: COVERAGE_NOTES[gap.domain],
        idealFor: IDEAL_FOR[gap.domain],
        explanation: {
          why: gap.explanation.why,
          how: [
            ...gap.explanation.how,
            `We ranked this ${priorityScore}/100 for you, which makes it ${urgency.toLowerCase().replace("_", " ")}.`,
            ...this.riskInfluence(gap.domain, risk),
          ],
          benefits: [...COVERAGE_NOTES[gap.domain].slice(0, 3).map((c) => `Pays for: ${c.toLowerCase()}`)],
          limitations: [
            ...gap.explanation.limitations,
            "The premium range is an estimate for guidance, not a quote. Your actual premium depends on the insurer's underwriting.",
            "No policy pays for everything. Read the exclusions before you buy — that is where a claim is usually lost.",
          ],
          risksOfInaction: gap.explanation.risksOfInaction,
          alternatives: [
            ...gap.explanation.alternatives,
            ...this.domainAlternatives(gap.domain),
          ],
          confidence: confidenceFrom(
            profile,
            ["age", "incomeRange", "dependents", "heldPolicies"],
            [
              `identified as a ${gap.severity.toLowerCase()} ${gap.kind.toLowerCase().replace("_", " ")} gap`,
              `priority rank ${priorityRank} for your situation`,
            ]
          ),
        },
      });
    }

    return out.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  private sumInsuredFor(
    profile: InsuranceProfileFacts,
    need: NeedReport,
    gap: CoverageGap
  ): number | null {
    if (gap.domain === "life") {
      return need.protectionGapValue ?? need.financialResponsibility.estimatedLifeCoverNeeded;
    }
    if (gap.domain === "health") {
      const income = profile.incomeRange ? INCOME_MIDPOINT[profile.incomeRange] : null;
      const family = profile.familyMembers ?? 1;
      return roundToReadable(Math.max(500_000, (income ?? 500_000) * 0.6 * Math.min(family, 4)));
    }
    return gap.exposureValue;
  }

  /**
   * Priority, 0–100.
   *
   * Severity dominates, rank adjusts, and risk nudges. A CRITICAL gap always
   * outranks a MODERATE one regardless of where the domain sits in the priority
   * list, because severity already accounts for legal requirements.
   */
  private score(gap: CoverageGap, rank: number, risk: RiskSummary): number {
    const severityBase = { CRITICAL: 90, HIGH: 70, MODERATE: 45, LOW: 20 }[gap.severity];

    // Rank carries more weight than risk, and deliberately so. The priority
    // list is a considered judgement that already weighs dependants, legal
    // requirements and what actually ruins households — health above life,
    // because a hospital bill arrives without warning while a term plan
    // protects against something less likely. Letting a risk score overturn
    // that ordering produced exactly the wrong answer for a sole earner: it
    // pushed life cover above the health cover they needed first.
    const rankAdjust = Math.max(0, 20 - rank * 4);

    const related = risk.factors.find((f) => this.riskDimensionFor(gap.domain) === f.dimension);
    const riskAdjust =
      related && related.score !== null ? Math.round((related.score / 100) * 5) : 0;

    return Math.max(0, Math.min(100, severityBase + rankAdjust + riskAdjust));
  }

  private riskDimensionFor(domain: InsuranceDomain) {
    const map = {
      motor: "vehicle",
      health: "health",
      life: "family",
      travel: "travel",
      property: "property",
      commercial: "occupation",
    } as const;
    return map[domain];
  }

  private riskInfluence(domain: InsuranceDomain, risk: RiskSummary): string[] {
    const dimension = this.riskDimensionFor(domain);
    const factor = risk.factors.find((f) => f.dimension === dimension);
    if (!factor) return [];
    if (factor.band === "UNKNOWN") {
      return [`We could not assess your ${dimension} risk, so it did not raise or lower this.`];
    }
    if (factor.band === "HIGH" || factor.band === "ELEVATED") {
      return [`Your ${dimension} risk is ${factor.band.toLowerCase()}, which raised this: ${factor.drivers[0] ?? ""}`];
    }
    return [`Your ${dimension} risk is ${factor.band.toLowerCase()}.`];
  }

  private urgencyFor(gap: CoverageGap, score: number): Urgency {
    if (gap.severity === "CRITICAL") return "IMMEDIATE";
    if (score >= 70) return "SOON";
    if (score >= 40) return "PLANNED";
    return "OPTIONAL";
  }

  private headline(gap: CoverageGap, sumInsured: number | null): string {
    const label = DOMAIN_LABEL[gap.domain].toLowerCase();
    if (gap.kind === "LAPSED") return `Reinstate your ${label} before the grace period closes`;
    if (gap.kind === "UNDERINSURED")
      return `Increase your ${label}${sumInsured ? ` to about ${formatRupees(sumInsured)}` : ""}`;
    return `Take out ${label}${sumInsured ? ` of about ${formatRupees(sumInsured)}` : ""}`;
  }

  private domainAlternatives(domain: InsuranceDomain) {
    if (domain === "life") {
      return [
        {
          option: "An endowment or money-back policy instead of term cover",
          whyNotChosen:
            "It mixes insurance with saving and does both expensively. The same premium buys several times more cover as term, and the savings part usually returns less than a deposit.",
        },
      ];
    }
    if (domain === "health") {
      return [
        {
          option: "Rely on your employer's group cover",
          whyNotChosen:
            "It ends with the job, usually excludes your parents, and is rarely large enough on its own. Useful alongside a personal policy, not instead of one.",
        },
      ];
    }
    if (domain === "motor") {
      return [
        {
          option: "Third-party cover only",
          whyNotChosen:
            "It is the legal minimum and the cheapest option, but it pays nothing toward your own vehicle. Reasonable on an old vehicle worth little; poor value on a newer one.",
        },
      ];
    }
    return [];
  }
}

/**
 * Plan-level matching, unimplemented on purpose.
 *
 * Returns `available: false` with the reason, in the same pattern this codebase
 * uses everywhere data does not exist. It does not invent product names,
 * insurers or premiums — a fabricated quotation is the one output of an
 * insurance platform that could cost somebody real money.
 *
 * Wiring this to the decision engine in `Aegis-AI/layer4` is the natural next
 * step and requires sign-off, because that engine is protected code.
 */
export class UnavailablePolicyMatching implements PolicyMatchingService {
  async match(): Promise<{
    available: boolean;
    matches: [];
    reason: string;
  }> {
    return {
      available: false,
      matches: [],
      reason:
        "Named product matching is not connected. The recommendation above says what cover is needed and roughly what it costs; choosing between specific insurer products requires the plan-scoring engine (Aegis-AI/layer4) or a live insurer API, neither of which is wired to this service yet.",
    };
  }
}
