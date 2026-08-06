/**
 * Need analysis — what this household actually has to protect.
 *
 * The centre of it is one number: the income a family would lose if the person
 * earning it stopped. Everything else in the engine leans on that, so it is
 * computed explicitly and shown, rather than folded into a score.
 *
 * The method is the human-life-value approach, deliberately chosen over the
 * "ten times your income" rule of thumb that the industry defaults to. Ten
 * times income tells a 28-year-old with two children and a 55-year-old with
 * none to buy the same cover, which is wrong in both directions.
 */
import type { NeedAnalysisService } from "./contracts";
import { confidenceFrom, formatRupees, roundToReadable } from "./explain";
import {
  DOMAIN_LABEL,
  INCOME_MIDPOINT,
  type InsuranceDomain,
  type InsuranceProfileFacts,
  type LifeStage,
  type NeedReport,
} from "./types";

/**
 * Which stage of life somebody is in.
 *
 * Age alone is not enough — a 30-year-old supporting parents is in a different
 * position from a 30-year-old supporting nobody, and the second one does not
 * need life cover urgently. Dependents are weighed alongside age for exactly
 * that reason.
 */
export function lifeStageOf(profile: InsuranceProfileFacts): LifeStage {
  const age = profile.age ?? null;
  if (age === null) return "UNKNOWN";

  const dependents = profile.dependents ?? (profile.parentsDependent ? 1 : 0);
  const married = profile.maritalStatus === "MARRIED";

  if (age >= 65) return "RETIRED";
  if (age >= 55) return "PRE_RETIREMENT";
  if (age >= 45) return dependents > 0 ? "PEAK_RESPONSIBILITY" : "PRE_RETIREMENT";
  if (age >= 35) return dependents > 0 || married ? "ESTABLISHED_FAMILY" : "YOUNG_INDEPENDENT";
  if (age >= 25) return dependents > 0 || married ? "YOUNG_FAMILY" : "YOUNG_INDEPENDENT";
  return dependents > 0 ? "YOUNG_FAMILY" : "YOUNG_INDEPENDENT";
}

const STAGE_NARRATIVE: Record<LifeStage, string> = {
  YOUNG_INDEPENDENT:
    "Nobody depends on your income yet, so the priority is protecting you rather than replacing you — health cover first, and life cover bought young while it is cheap.",
  YOUNG_FAMILY:
    "People have started to depend on your income. This is the stage where a gap hurts most, because savings have not caught up with responsibilities.",
  ESTABLISHED_FAMILY:
    "Your responsibilities are at their widest — a family, probably a loan, possibly parents. Cover taken out earlier is often now too small.",
  PEAK_RESPONSIBILITY:
    "Earnings and obligations are both near their peak, and there are fewer working years left to recover from a setback.",
  PRE_RETIREMENT:
    "Dependants are becoming independent, but health costs are rising. The balance shifts from replacing income to protecting savings.",
  RETIRED:
    "Income protection matters less; medical cover and the value of what you have built matter more.",
  UNKNOWN:
    "We do not know your age yet, so this reading is general. Telling us would sharpen everything below.",
};

/** How many more years the household would need supporting, by stage. */
function yearsOfSupport(profile: InsuranceProfileFacts, stage: LifeStage): number | null {
  if (profile.age === null || profile.age === undefined) return null;
  // To a working age of 60 — the years the income would have been earned. Floored
  // at 5 rather than 0, because a family does not stop needing money the year
  // somebody would have retired.
  return Math.max(5, 60 - profile.age);
}

export class RuleBasedNeedAnalysis implements NeedAnalysisService {
  async analyse(profile: InsuranceProfileFacts): Promise<NeedReport> {
    const stage = lifeStageOf(profile);
    const annualIncome = profile.incomeRange ? INCOME_MIDPOINT[profile.incomeRange] : null;
    const dependents = profile.dependents ?? (profile.parentsDependent ? 1 : 0);
    const years = yearsOfSupport(profile, stage);

    // Human life value, net of the earner's own consumption. A household of one
    // earner and three dependants does not need 100% of the income replaced —
    // roughly 70% is the share that was supporting other people.
    let lifeCoverNeeded: number | null = null;
    if (annualIncome !== null && years !== null) {
      const replacementShare = dependents > 0 ? 0.7 : 0.35;
      lifeCoverNeeded = roundToReadable(annualIncome * years * replacementShare);
    }

    const existingCoverage = (profile.heldPolicies ?? [])
      .filter((p) => p.status === "ACTIVE")
      .map((p) => ({
        domain: p.domain,
        sumInsured: p.sumInsured ?? null,
        source: p.external ? ("EXTERNAL" as const) : ("AEGIS" as const),
      }));

    const lifeHeld = existingCoverage
      .filter((c) => c.domain === "life")
      .reduce((sum, c) => sum + (c.sumInsured ?? 0), 0);

    const protectionGap =
      lifeCoverNeeded === null ? null : Math.max(0, roundToReadable(lifeCoverNeeded - lifeHeld));

    return {
      lifeStage: stage,
      lifeStageNarrative: STAGE_NARRATIVE[stage],
      financialResponsibility: {
        annualIncome,
        dependentCount: dependents,
        yearsOfSupportNeeded: years,
        estimatedLifeCoverNeeded: lifeCoverNeeded,
      },
      existingCoverage,
      protectionGapValue: protectionGap,
      futureGoals: goalNarratives(profile),
      familyNeeds: familyNarratives(profile, dependents),
      coveragePriority: prioritise(profile, stage, dependents),
      explanation: {
        why: "Every recommendation below is built from this reading of your situation, so it is shown first.",
        how: [
          stage === "UNKNOWN"
            ? "We could not place your life stage without your age."
            : `Your age and dependants put you at the "${stage.toLowerCase().replace(/_/g, " ")}" stage.`,
          annualIncome === null
            ? "We do not know your income, so we could not estimate how much income would need replacing."
            : `We took the midpoint of your income band, about ${formatRupees(annualIncome)} a year.`,
          years === null
            ? "Without your age we could not work out how many earning years are being protected."
            : `We counted ${years} earning years to age 60.`,
          lifeCoverNeeded === null
            ? "Life cover needed could not be estimated without income and age."
            : `Replacing ${dependents > 0 ? "70%" : "35%"} of that income over those years comes to about ${formatRupees(lifeCoverNeeded)}.`,
          lifeHeld > 0
            ? `You already hold ${formatRupees(lifeHeld)} of life cover, which we subtracted.`
            : "We found no life cover on your profile to subtract.",
        ],
        benefits: [
          "You can see the arithmetic rather than being handed a number.",
          "The same figures drive every recommendation, so nothing contradicts anything else.",
        ],
        limitations: [
          "This uses the midpoint of your income band, not your exact income.",
          "It assumes you would have worked to 60.",
          "It does not account for savings, inheritance, or a second earner's income.",
        ],
        risksOfInaction: [
          protectionGap && protectionGap > 0
            ? `Your household would be short about ${formatRupees(protectionGap)} if your income stopped.`
            : "Without more detail we cannot tell you what a shortfall would look like.",
        ],
        alternatives: [
          {
            option: "The common rule of thumb — ten times your annual income",
            whyNotChosen:
              "It gives the same answer to a 28-year-old with two children and a 55-year-old with none. We used your actual years and dependants instead.",
          },
        ],
        confidence: confidenceFrom(
          profile,
          ["age", "incomeRange", "dependents", "heldPolicies"],
          [
            profile.age ? "your age" : "age not yet known",
            profile.incomeRange ? "your income band" : "income not yet known",
            `${dependents} dependant${dependents === 1 ? "" : "s"}`,
          ]
        ),
      },
    };
  }
}

function goalNarratives(profile: InsuranceProfileFacts): string[] {
  const goals = profile.financialGoals ?? [];
  const out: string[] = [];
  if (goals.includes("CHILD_EDUCATION"))
    out.push("Education costs continue even if your income stops — that is what life cover is for.");
  if (goals.includes("CHILD_MARRIAGE"))
    out.push("A planned family expense is safer funded by a maturing plan than by a loan.");
  if (goals.includes("RETIREMENT"))
    out.push("A single uninsured hospital stay can undo years of retirement saving.");
  if (goals.includes("HOME_PURCHASE"))
    out.push("A home loan is a debt your family inherits; cover it for at least the outstanding amount.");
  if (goals.includes("DEBT_FREEDOM"))
    out.push("Term cover for the loan balance costs a fraction of the loan and clears it outright.");
  if (goals.includes("INCOME_PROTECTION"))
    out.push("Income protection is the goal this engine is built around — the numbers above are exactly that.");
  if (goals.includes("WEALTH"))
    out.push("Insurance protects wealth; it is a poor way to build it. Keep the two separate.");
  return out;
}

function familyNarratives(profile: InsuranceProfileFacts, dependents: number): string[] {
  const out: string[] = [];
  if (dependents > 0)
    out.push(`${dependents} ${dependents === 1 ? "person depends" : "people depend"} on your income.`);
  if (profile.parentsDependent)
    out.push("Ageing parents usually need health cover of their own — a family floater rarely stretches to them affordably.");
  if ((profile.familyMembers ?? 0) > 3)
    out.push("With a larger household, a family floater is usually cheaper than separate policies, but the sum insured has to be sized for more than one claim in a year.");
  if (dependents === 0 && (profile.familyMembers ?? 0) <= 1)
    out.push("Nobody currently depends on your income, so health cover matters more than life cover right now.");
  return out;
}

/**
 * The order in which cover matters for this person.
 *
 * Legally required cover comes first regardless of anything else. Then health,
 * because a hospital bill is the single most common cause of financial ruin
 * among the households this platform serves. Life cover ranks by dependants,
 * not by age.
 */
function prioritise(
  profile: InsuranceProfileFacts,
  stage: LifeStage,
  dependents: number
): NeedReport["coveragePriority"] {
  const scored: Array<{ domain: InsuranceDomain; weight: number; rationale: string }> = [];

  const vehicles = profile.vehicles ?? [];
  if (vehicles.length > 0) {
    scored.push({
      domain: "motor",
      weight: 100,
      rationale:
        "Third-party motor cover is required by law in India. Driving without it risks prosecution as well as an unlimited liability claim.",
    });
  }

  scored.push({
    domain: "health",
    weight: 90,
    rationale:
      dependents > 0
        ? "A hospital admission is the most common cause of sudden debt for a family, and it does not wait for a convenient year."
        : "Even with nobody depending on you, a single admission can wipe out savings built over years.",
  });

  if (dependents > 0 || stage === "YOUNG_FAMILY" || stage === "ESTABLISHED_FAMILY") {
    scored.push({
      domain: "life",
      weight: 85,
      rationale: `Term cover replaces your income for the ${dependents} ${dependents === 1 ? "person who depends" : "people who depend"} on it. It is the cheapest insurance sold, because most people outlive it.`,
    });
  } else {
    scored.push({
      domain: "life",
      weight: 40,
      rationale:
        "Nobody currently depends on your income, so this is about locking in a low premium early rather than urgent need.",
    });
  }

  const properties = profile.properties ?? [];
  if (properties.some((p) => p.ownership !== "RENTED")) {
    scored.push({
      domain: "property",
      weight: 70,
      rationale:
        "Property is usually the largest thing a household owns and the least likely to be insured. Rebuilding is rarely affordable out of savings.",
    });
  } else if (properties.length > 0) {
    scored.push({
      domain: "property",
      weight: 35,
      rationale:
        "As a tenant you do not insure the building, but your belongings inside it are yours to replace.",
    });
  }

  const travel = profile.travelFrequency;
  if (travel === "INTERNATIONAL" || travel === "FREQUENT") {
    scored.push({
      domain: "travel",
      weight: 60,
      rationale:
        "Medical treatment abroad is not covered by an Indian health policy, and a single overseas admission can cost more than a year's income.",
    });
  } else if (travel === "OCCASIONAL") {
    scored.push({
      domain: "travel",
      weight: 25,
      rationale: "Worth buying per trip rather than annually at your travel frequency.",
    });
  }

  if (vehicles.some((v) => v.commercial || v.kind === "COMMERCIAL")) {
    scored.push({
      domain: "commercial",
      weight: 65,
      rationale:
        "A vehicle used for business carries liabilities a personal policy will not pay, including to anyone you employ to drive it.",
    });
  }

  return scored
    .sort((a, b) => b.weight - a.weight)
    .map((s, index) => ({ domain: s.domain, rank: index + 1, rationale: s.rationale }));
}

/** Convenience for callers that want the label without importing both modules. */
export const domainLabel = (domain: InsuranceDomain): string => DOMAIN_LABEL[domain];
