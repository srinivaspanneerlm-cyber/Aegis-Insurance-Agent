/**
 * Coverage gap detection.
 *
 * Finds six things: cover that is missing, cover that is too small, cover paid
 * for twice, cover that overlaps, cover that has lapsed, and risks that are
 * coming rather than present.
 *
 * Duplicate detection is here for a reason that is easy to miss: it *loses the
 * platform revenue*. Telling a customer they are paying for two health policies
 * and should cancel one is the clearest possible demonstration that the advice
 * is theirs rather than the seller's, and a platform that only ever finds
 * reasons to buy more is one nobody should trust.
 */
import type { CoverageGapService } from "./contracts";
import { confidenceFrom, formatRupees, roundToReadable } from "./explain";
import {
  DOMAIN_LABEL,
  INCOME_MIDPOINT,
  type CoverageGap,
  type InsuranceDomain,
  type InsuranceProfileFacts,
  type NeedReport,
  type Severity,
} from "./types";

export class RuleBasedCoverageGap implements CoverageGapService {
  async detect(
    profile: InsuranceProfileFacts,
    need: NeedReport
  ): Promise<readonly CoverageGap[]> {
    const held = profile.heldPolicies ?? [];
    const active = held.filter((p) => p.status === "ACTIVE");
    const byDomain = new Map<InsuranceDomain, typeof active>();
    for (const p of active) {
      byDomain.set(p.domain, [...(byDomain.get(p.domain) ?? []), p]);
    }

    const gaps: CoverageGap[] = [
      ...this.missing(profile, need, byDomain),
      ...this.underinsured(profile, need, byDomain),
      ...this.duplicates(profile, byDomain),
      ...this.overlaps(profile, byDomain),
      ...this.lapsed(profile, held),
      ...this.futureRisks(profile, need),
    ];

    const order: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
    return gaps.sort((a, b) => order[a.severity] - order[b.severity]);
  }

  /** Cover the priority list says they need and do not have. */
  private missing(
    profile: InsuranceProfileFacts,
    need: NeedReport,
    byDomain: Map<InsuranceDomain, unknown[]>
  ): CoverageGap[] {
    const out: CoverageGap[] = [];

    for (const priority of need.coveragePriority) {
      if (byDomain.has(priority.domain)) continue;

      // Motor is the one case where the gap is a legal problem, not only a
      // financial one, so it outranks everything regardless of rank order.
      const legallyRequired = priority.domain === "motor";
      const severity: Severity = legallyRequired
        ? "CRITICAL"
        : priority.rank === 1
          ? "HIGH"
          : priority.rank <= 3
            ? "MODERATE"
            : "LOW";

      out.push({
        kind: "MISSING",
        domain: priority.domain,
        severity,
        summary: `You have no ${DOMAIN_LABEL[priority.domain].toLowerCase()}.`,
        exposureValue: this.exposureFor(profile, need, priority.domain),
        explanation: {
          why: priority.rationale,
          how: [
            `We ranked ${DOMAIN_LABEL[priority.domain].toLowerCase()} at position ${priority.rank} for your situation.`,
            "We found no active policy in this area on your profile.",
            legallyRequired
              ? "Third-party motor cover is a legal requirement, so this is flagged at the highest severity."
              : `That combination makes this a ${severity.toLowerCase()} gap.`,
          ],
          benefits: [`Closing this covers the risk described above.`],
          limitations: [
            "We only know about cover you have told us about. If you hold this elsewhere, add it and this will disappear.",
          ],
          risksOfInaction: [
            legallyRequired
              ? "Driving uninsured risks prosecution, and third-party liability in India is unlimited."
              : `The full cost of this risk currently falls on your household.`,
          ],
          alternatives: [
            {
              option: "Do nothing for now",
              whyNotChosen:
                priority.rank <= 2
                  ? "This is one of the top two priorities for your situation, so delaying it carries the most exposure."
                  : "Reasonable if budget is tight — the items above this one matter more.",
            },
          ],
          confidence: confidenceFrom(profile, ["heldPolicies", "age", "dependents"], [
            `no ${priority.domain} policy found on your profile`,
          ]),
        },
      });
    }
    return out;
  }

  /** Cover they hold, but not enough of. */
  private underinsured(
    profile: InsuranceProfileFacts,
    need: NeedReport,
    byDomain: Map<InsuranceDomain, ReadonlyArray<{ sumInsured?: number | null }>>
  ): CoverageGap[] {
    const out: CoverageGap[] = [];

    // Life — measured against the human-life-value figure from need analysis.
    const lifeNeeded = need.financialResponsibility.estimatedLifeCoverNeeded;
    const lifeHeld = (byDomain.get("life") ?? []).reduce((s, p) => s + (p.sumInsured ?? 0), 0);
    if (lifeNeeded !== null && lifeHeld > 0 && lifeHeld < lifeNeeded * 0.8) {
      const shortfall = roundToReadable(lifeNeeded - lifeHeld);
      out.push({
        kind: "UNDERINSURED",
        domain: "life",
        severity: lifeHeld < lifeNeeded * 0.4 ? "HIGH" : "MODERATE",
        summary: `Your life cover of ${formatRupees(lifeHeld)} is short of the ${formatRupees(lifeNeeded)} your household would need.`,
        exposureValue: shortfall,
        explanation: {
          why: "Cover taken out years ago rarely keeps pace with income and responsibilities.",
          how: [
            `Need analysis put the requirement at about ${formatRupees(lifeNeeded)}.`,
            `You hold ${formatRupees(lifeHeld)} across your life policies.`,
            `That leaves ${formatRupees(shortfall)} uncovered.`,
          ],
          benefits: ["A top-up term plan is usually cheaper than replacing the existing policy."],
          limitations: [
            "The requirement uses your income band's midpoint, not your exact income.",
            "It does not count savings or a second earner.",
          ],
          risksOfInaction: [`Your household would be about ${formatRupees(shortfall)} short.`],
          alternatives: [
            {
              option: "Replace the existing policy with one larger one",
              whyNotChosen:
                "Usually costs more — you would be re-rated at your current age, and lose any waiting periods already served.",
            },
          ],
          confidence: confidenceFrom(profile, ["age", "incomeRange", "dependents", "heldPolicies"], [
            `${formatRupees(lifeHeld)} held against ${formatRupees(lifeNeeded)} needed`,
          ]),
        },
      });
    }

    // Health — measured against income, since a serious admission scales with
    // the standard of care a household is used to. Five lakh is the floor
    // below which a single ICU stay in a private hospital exhausts the cover.
    const income = profile.incomeRange ? INCOME_MIDPOINT[profile.incomeRange] : null;
    const healthHeld = (byDomain.get("health") ?? []).reduce((s, p) => s + (p.sumInsured ?? 0), 0);
    if (healthHeld > 0) {
      const familySize = profile.familyMembers ?? 1;
      const suggested = roundToReadable(Math.max(500_000, (income ?? 500_000) * 0.6 * Math.min(familySize, 4)));
      if (healthHeld < suggested * 0.7) {
        out.push({
          kind: "UNDERINSURED",
          domain: "health",
          severity: healthHeld < 300_000 ? "HIGH" : "MODERATE",
          summary: `Your health cover of ${formatRupees(healthHeld)} is likely too small for ${familySize === 1 ? "you" : `a household of ${familySize}`}.`,
          exposureValue: roundToReadable(suggested - healthHeld),
          explanation: {
            why: "A single ICU admission in a private hospital can exhaust a small floater in under two weeks.",
            how: [
              `We sized cover for a household of ${familySize}${income ? ` at your income band` : ""}.`,
              `That comes to about ${formatRupees(suggested)}.`,
              `You hold ${formatRupees(healthHeld)}.`,
            ],
            benefits: [
              "A super top-up costs a fraction of a full policy and sits above what you already have.",
            ],
            limitations: [
              "Hospital costs vary widely by city; this is a general estimate.",
              "A floater is shared — two claims in one year draw on the same amount.",
            ],
            risksOfInaction: ["The balance of a large hospital bill is paid from savings or borrowing."],
            alternatives: [
              {
                option: "Increase the existing policy at renewal",
                whyNotChosen:
                  "Often possible and worth asking about, but insurers may re-underwrite and fresh waiting periods can apply to the increase.",
              },
            ],
            confidence: confidenceFrom(profile, ["incomeRange", "heldPolicies"], [
              `${formatRupees(healthHeld)} held for ${familySize} ${familySize === 1 ? "person" : "people"}`,
            ]),
          },
        });
      }
    }

    return out;
  }

  /** Two active policies covering the same thing. */
  private duplicates(
    profile: InsuranceProfileFacts,
    byDomain: Map<InsuranceDomain, ReadonlyArray<{ premium?: number | null; insurer?: string | null }>>
  ): CoverageGap[] {
    const out: CoverageGap[] = [];

    for (const [domain, policies] of byDomain) {
      // Life is excluded: holding several term plans is a normal and often
      // deliberate way to build cover in layers, not a duplicate.
      if (domain === "life" || policies.length < 2) continue;

      const wastedPremium = policies
        .slice(1)
        .reduce((sum, p) => sum + (p.premium ?? 0), 0);

      out.push({
        kind: "DUPLICATE",
        domain,
        severity: "MODERATE",
        summary: `You hold ${policies.length} ${DOMAIN_LABEL[domain].toLowerCase()} policies. You may be paying twice for the same cover.`,
        exposureValue: wastedPremium > 0 ? Math.round(wastedPremium) : null,
        explanation: {
          why: "We would rather tell you to cancel something than sell you more. Two policies covering the same risk rarely pay twice.",
          how: [
            `We found ${policies.length} active policies in this area${policies[0]?.insurer ? ` (${policies.map((p) => p.insurer ?? "unnamed insurer").join(", ")})` : ""}.`,
            domain === "motor"
              ? "Two motor policies on one vehicle is a clear duplicate — only one will respond to a claim."
              : "Indemnity policies pay actual costs, not a fixed sum, so a second policy usually adds nothing.",
            wastedPremium > 0
              ? `The additional premium comes to about ${formatRupees(wastedPremium)} a year.`
              : "We do not have premium figures to quantify the waste.",
          ],
          benefits: [
            wastedPremium > 0
              ? `Cancelling the redundant cover could return about ${formatRupees(wastedPremium)} a year.`
              : "Consolidating reduces cost and makes a claim simpler.",
          ],
          limitations: [
            "Check before cancelling: the policies may differ in what they cover, and the older one usually has waiting periods already served.",
            domain === "health"
              ? "Keeping the older policy is usually right, even if it is smaller — its waiting periods are behind you."
              : "Confirm no lender or employer requires the policy you plan to cancel.",
          ],
          risksOfInaction: [
            wastedPremium > 0
              ? `About ${formatRupees(wastedPremium)} a year buys no additional protection.`
              : "You are paying for cover that will not pay out twice.",
          ],
          alternatives: [
            {
              option: "Keep both",
              whyNotChosen:
                domain === "health"
                  ? "Sometimes right — a second policy can act as a top-up above the first. Worth reviewing with an advisor rather than assumed."
                  : "Rarely justified for this kind of cover.",
            },
          ],
          confidence: confidenceFrom(profile, ["heldPolicies"], [
            `${policies.length} active ${domain} policies on your profile`,
          ]),
        },
      });
    }
    return out;
  }

  /** Different domains whose cover partly repeats. */
  private overlaps(
    profile: InsuranceProfileFacts,
    byDomain: Map<InsuranceDomain, unknown[]>
  ): CoverageGap[] {
    const out: CoverageGap[] = [];

    if (byDomain.has("health") && byDomain.has("travel")) {
      out.push({
        kind: "OVERLAP",
        domain: "travel",
        severity: "LOW",
        summary: "Your travel policy's medical section overlaps with your health policy for domestic trips.",
        exposureValue: null,
        explanation: {
          why: "Worth knowing so you claim from the right one rather than being turned down by both.",
          how: [
            "You hold both health and travel cover.",
            "Travel medical cover is designed for treatment abroad, where your health policy does not pay.",
            "Within India the two overlap, and the health policy is normally the one to claim on.",
          ],
          benefits: ["Knowing which policy to claim from avoids a rejected claim and a delay."],
          limitations: ["This is informational — the overlap costs little and removing it is rarely worthwhile."],
          risksOfInaction: ["Claiming from the wrong policy first can delay settlement."],
          alternatives: [
            {
              option: "Drop the medical section of the travel policy",
              whyNotChosen:
                "Not recommended. It is the part that matters abroad, which is where the real exposure is.",
            },
          ],
          confidence: confidenceFrom(profile, ["heldPolicies"], ["both health and travel cover held"]),
        },
      });
    }

    return out;
  }

  private lapsed(
    profile: InsuranceProfileFacts,
    held: InsuranceProfileFacts["heldPolicies"]
  ): CoverageGap[] {
    const lapsed = (held ?? []).filter((p) => p.status === "LAPSED" || p.status === "EXPIRED");
    return lapsed.map((p) => ({
      kind: "LAPSED" as const,
      domain: p.domain,
      severity: (p.domain === "health" ? "HIGH" : "MODERATE") as Severity,
      summary: `Your ${DOMAIN_LABEL[p.domain].toLowerCase()}${p.productName ? ` (${p.productName})` : ""} has ${p.status === "LAPSED" ? "lapsed" : "expired"}.`,
      exposureValue: p.sumInsured ?? null,
      explanation: {
        why: "Lapsed cover pays nothing, and the risk it was bought for has not gone away.",
        how: [
          `The policy is marked ${p.status.toLowerCase()} on your profile.`,
          "We treat it as no cover at all when working out your gaps.",
        ],
        benefits: ["Reinstating within the grace period usually avoids fresh waiting periods and fresh underwriting."],
        limitations: [
          p.domain === "health"
            ? "Past the grace period a health policy is usually treated as new — waiting periods restart, and anything diagnosed meanwhile may be excluded."
            : "Reinstatement terms vary by insurer.",
        ],
        risksOfInaction: [
          p.domain === "health"
            ? "Every month uninsured is a month where an admission is paid entirely from savings, and where a new diagnosis becomes a permanent exclusion."
            : `The risk of ${formatRupees(p.sumInsured ?? 0)} sits with you.`,
        ],
        alternatives: [
          {
            option: "Buy a fresh policy instead",
            whyNotChosen:
              "Almost always worse if reinstatement is still open — a new policy restarts every waiting period.",
          },
        ],
        confidence: confidenceFrom(profile, ["heldPolicies"], [`policy marked ${p.status}`]),
      },
    }));
  }

  /** Risks that are not present yet but are coming. */
  private futureRisks(profile: InsuranceProfileFacts, need: NeedReport): CoverageGap[] {
    const out: CoverageGap[] = [];
    const age = profile.age;

    if (age !== null && age !== undefined && age >= 40 && age < 60) {
      const hasHealth = (profile.heldPolicies ?? []).some(
        (p) => p.domain === "health" && p.status === "ACTIVE"
      );
      out.push({
        kind: "FUTURE_RISK",
        domain: "health",
        severity: hasHealth ? "LOW" : "HIGH",
        summary: hasHealth
          ? "Health premiums rise steeply after 45. Reviewing your sum insured now costs less than raising it later."
          : "Buying health cover after 45 costs substantially more, and anything diagnosed first is excluded permanently.",
        exposureValue: null,
        explanation: {
          why: "The cost of this cover is decided by when you buy it, not by when you need it.",
          how: [
            `You are ${age}.`,
            "Insurers step premiums up sharply from 45, and again at 60.",
            hasHealth
              ? "You already hold cover, so this is about size rather than starting."
              : "You hold none, so every year of delay raises both the premium and the chance of a permanent exclusion.",
          ],
          benefits: ["Buying earlier locks in an age band and gets waiting periods behind you."],
          limitations: ["This is about future cost, not a present shortfall."],
          risksOfInaction: [
            "A condition diagnosed before you buy is usually excluded for good, not just during a waiting period.",
          ],
          alternatives: [
            { option: "Wait until you need it", whyNotChosen: "By then it is more expensive, and what you need it for may be excluded." },
          ],
          confidence: confidenceFrom(profile, ["age", "heldPolicies"], [`age ${age}`]),
        },
      });
    }

    if (need.lifeStage === "PRE_RETIREMENT" || need.lifeStage === "PEAK_RESPONSIBILITY") {
      out.push({
        kind: "FUTURE_RISK",
        domain: "health",
        severity: "MODERATE",
        summary: "Employer health cover usually ends when you stop working, often at the age it is hardest to replace.",
        exposureValue: null,
        explanation: {
          why: "It is the most common uninsured moment in an Indian household, and it is entirely predictable.",
          how: [
            `Your life stage is ${need.lifeStage.toLowerCase().replace(/_/g, " ")}.`,
            "Group cover ends with employment.",
            "A personal policy bought now serves its waiting periods while the group cover is still paying.",
          ],
          benefits: ["Holding a personal policy alongside group cover means no gap on the day you retire."],
          limitations: ["Only relevant if your current cover is through an employer — tell us and we can be precise."],
          risksOfInaction: ["Buying at 58 costs far more than buying at 50, if it is available at all."],
          alternatives: [
            { option: "Rely on the employer policy until retirement", whyNotChosen: "It ends exactly when you can no longer replace it cheaply." },
          ],
          confidence: confidenceFrom(profile, ["age", "occupation"], [`life stage ${need.lifeStage}`]),
        },
      });
    }

    return out;
  }

  /** What this gap would cost, where it can be computed honestly. */
  private exposureFor(
    profile: InsuranceProfileFacts,
    need: NeedReport,
    domain: InsuranceDomain
  ): number | null {
    if (domain === "life") return need.protectionGapValue;
    if (domain === "health") {
      const income = profile.incomeRange ? INCOME_MIDPOINT[profile.incomeRange] : null;
      return income === null ? null : roundToReadable(Math.max(500_000, income * 0.6));
    }
    if (domain === "property") {
      const owned = (profile.properties ?? []).filter((p) => p.ownership !== "RENTED");
      return owned.length > 0 ? null : null; // no value range captured yet — see limitations
    }
    return null;
  }
}
