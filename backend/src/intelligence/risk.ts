/**
 * Risk analysis across eight dimensions.
 *
 * Two rules run through all of it.
 *
 * **Unknown is not low.** Every dimension can return `UNKNOWN`, and that band
 * is carried through to the overall score rather than being averaged away as a
 * zero. Treating a blank as "no risk" is how somebody with an undisclosed
 * condition is sold a policy that will not pay when they claim.
 *
 * **Risk describes exposure, never a person.** These scores decide what cover
 * to suggest and what to ask about. They are not an underwriting decision and
 * are never a reason to refuse somebody — that judgement belongs to an insurer,
 * with its own rules and its own appeal route.
 */
import type { RiskAnalysisService } from "./contracts";
import { confidenceFrom } from "./explain";
import type {
  InsuranceProfileFacts,
  RiskBand,
  RiskDimension,
  RiskFactor,
  RiskSummary,
} from "./types";

const bandFor = (score: number): RiskBand => {
  if (score >= 70) return "HIGH";
  if (score >= 50) return "ELEVATED";
  if (score >= 25) return "MODERATE";
  return "LOW";
};

const unknown = (dimension: RiskDimension, needed: string): RiskFactor => ({
  dimension,
  band: "UNKNOWN",
  score: null,
  drivers: [`We do not know ${needed}, so we have not guessed.`],
  mitigations: [`Telling us ${needed} would let us assess this properly.`],
});

/**
 * Occupations with materially different risk, kept as a small explicit list.
 *
 * Deliberately short. A long list of job titles matched by substring produces
 * confident nonsense — "software engineer" matching "engineer" and being rated
 * as site work. Anything unmatched is `UNKNOWN`, not average.
 */
const HAZARDOUS_OCCUPATIONS = [
  "construction",
  "mining",
  "driver",
  "electrician",
  "welder",
  "fisherman",
  "security guard",
  "factory",
  "farmer",
  "agriculture",
];

const SEDENTARY_OCCUPATIONS = ["software", "teacher", "accountant", "clerk", "analyst", "banker"];

export class RuleBasedRiskAnalysis implements RiskAnalysisService {
  async assess(profile: InsuranceProfileFacts): Promise<RiskSummary> {
    const factors: RiskFactor[] = [
      this.health(profile),
      this.vehicle(profile),
      this.travel(profile),
      this.property(profile),
      this.family(profile),
      this.lifestyle(profile),
      this.occupation(profile),
      this.financial(profile),
    ];

    const known = factors.filter((f) => f.score !== null);
    const overallScore =
      known.length === 0
        ? null
        : Math.round(known.reduce((sum, f) => sum + (f.score ?? 0), 0) / known.length);

    // Unknown wins when most of the picture is missing. Reporting "LOW overall"
    // from two known dimensions out of eight would be the most misleading thing
    // this engine could say.
    const overall: RiskBand =
      overallScore === null || known.length < 3 ? "UNKNOWN" : bandFor(overallScore);

    const unknownCount = factors.length - known.length;

    return {
      overall,
      overallScore,
      factors,
      narrative: narrate(overall, factors, unknownCount),
      explanation: {
        why: "Risk decides what cover to suggest and what we still need to ask you. It is not an underwriting decision.",
        how: [
          `We looked at ${factors.length} areas and could assess ${known.length} of them.`,
          overall === "UNKNOWN"
            ? "Too much is unknown for an overall reading, so we have not given one."
            : `The assessed areas averaged ${overallScore}, which is "${overall.toLowerCase()}".`,
          "Areas we could not assess are reported as unknown rather than assumed to be low.",
        ],
        benefits: [
          "You can see which areas raised a flag and what would lower it.",
          "Nothing here is held against you — it shapes advice, not eligibility.",
        ],
        limitations: [
          "Based entirely on what you have told us; we do not verify any of it.",
          "An insurer's underwriting will reach its own conclusion, which may differ.",
          unknownCount > 0
            ? `${unknownCount} of ${factors.length} areas could not be assessed at all.`
            : "All areas had enough information to assess.",
        ],
        risksOfInaction: [
          "Cover bought without an accurate picture is the cover most likely to be disputed at claim time.",
        ],
        alternatives: [
          {
            option: "A single overall risk score with no breakdown",
            whyNotChosen:
              "One number cannot be acted on. Eight can — each names what drives it and what would reduce it.",
          },
        ],
        confidence: confidenceFrom(
          profile,
          ["age", "occupation", "heldPolicies", "vehicles", "properties"],
          [`${known.length} of ${factors.length} risk areas assessed`]
        ),
      },
    };
  }

  private health(profile: InsuranceProfileFacts): RiskFactor {
    const age = profile.age;
    const conditions = profile.healthConditions ?? [];
    const smoker = profile.smoker;

    if (age === null || age === undefined) return unknown("health", "your age");

    let score = 0;
    const drivers: string[] = [];
    const mitigations: string[] = [];

    if (age >= 60) {
      score += 40;
      drivers.push("Age 60 or above — claim likelihood rises sharply and so do premiums.");
    } else if (age >= 45) {
      score += 25;
      drivers.push("Age 45 or above — the years when conditions are usually first diagnosed.");
    } else if (age >= 35) {
      score += 12;
      drivers.push("Age 35 or above.");
    }

    if (conditions.length > 0) {
      score += Math.min(35, conditions.length * 15);
      drivers.push(
        `${conditions.length} declared health ${conditions.length === 1 ? "condition" : "conditions"}.`
      );
      mitigations.push(
        "Declare every condition at proposal. An undeclared condition is the single most common reason a health claim is refused."
      );
    }

    if (smoker === true) {
      score += 20;
      drivers.push("Smoking, which insurers price separately and substantially.");
      mitigations.push("Premiums usually drop after a documented smoke-free period — often two years.");
    }

    if (drivers.length === 0) drivers.push("Nothing on your profile raises health risk.");
    mitigations.push("Buying health cover earlier means serving waiting periods before you need them.");

    return { dimension: "health", band: bandFor(score), score: Math.min(100, score), drivers, mitigations };
  }

  private vehicle(profile: InsuranceProfileFacts): RiskFactor {
    const vehicles = profile.vehicles ?? [];
    if (vehicles.length === 0) return unknown("vehicle", "whether you own a vehicle");

    let score = 10;
    const drivers: string[] = [];
    const mitigations: string[] = [];
    const year = new Date().getFullYear();

    for (const v of vehicles) {
      if (v.kind === "TWO_WHEELER") {
        score += 25;
        drivers.push("A two-wheeler — the vehicle class with the highest injury rate on Indian roads.");
      }
      if (v.commercial || v.kind === "COMMERCIAL") {
        score += 20;
        drivers.push("Commercial use, which means more hours on the road and third-party liability toward anyone you employ.");
      }
      if (v.year && year - v.year > 10) {
        score += 15;
        drivers.push(`A vehicle around ${year - v.year} years old — older vehicles fail more and are worth less at claim.`);
        mitigations.push("Check the declared value on an older vehicle; insuring it above market value pays nothing extra.");
      }
    }

    mitigations.push("Third-party cover is the legal minimum, not adequate cover. Own-damage is what pays for your vehicle.");
    if (drivers.length === 0) drivers.push(`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} on your profile.`);

    return { dimension: "vehicle", band: bandFor(score), score: Math.min(100, score), drivers, mitigations };
  }

  private travel(profile: InsuranceProfileFacts): RiskFactor {
    const f = profile.travelFrequency;
    if (!f) return unknown("travel", "how often you travel");

    const table: Record<string, { score: number; driver: string }> = {
      NEVER: { score: 0, driver: "You do not travel, so there is no exposure here." },
      RARE: { score: 10, driver: "Occasional domestic travel." },
      OCCASIONAL: { score: 25, driver: "Regular domestic travel." },
      FREQUENT: { score: 45, driver: "Frequent travel — more exposure, and more trips uninsured if bought per trip." },
      INTERNATIONAL: {
        score: 60,
        driver: "International travel, where your Indian health policy does not pay at all.",
      },
    };
    const entry = table[f] ?? { score: 20, driver: "Some travel." };

    return {
      dimension: "travel",
      band: bandFor(entry.score),
      score: entry.score,
      drivers: [entry.driver],
      mitigations:
        f === "FREQUENT" || f === "INTERNATIONAL"
          ? ["An annual multi-trip policy is usually cheaper than four single-trip policies and removes the risk of forgetting."]
          : ["Buy per trip; an annual policy would not pay for itself at your frequency."],
    };
  }

  private property(profile: InsuranceProfileFacts): RiskFactor {
    const properties = profile.properties ?? [];
    if (properties.length === 0) return unknown("property", "whether you own property");

    let score = 15;
    const drivers: string[] = [];
    const mitigations: string[] = [];

    for (const p of properties) {
      if (p.ownership === "MORTGAGED") {
        score += 30;
        drivers.push("A mortgaged property — the debt survives the building, and your family inherits it.");
        mitigations.push("Cover at least the outstanding loan; many lenders require it and few borrowers check the amount.");
      } else if (p.ownership === "OWNED") {
        score += 20;
        drivers.push("Owned property, usually the largest single asset a household holds.");
      }
      if (p.kind === "SHOP") {
        score += 15;
        drivers.push("Commercial premises, which carry stock and public-liability exposure a home policy excludes.");
      }
    }

    mitigations.push("Insure the rebuilding cost, not the market price — land does not burn.");
    return { dimension: "property", band: bandFor(score), score: Math.min(100, score), drivers, mitigations };
  }

  private family(profile: InsuranceProfileFacts): RiskFactor {
    const dependents = profile.dependents;
    if (dependents === null || dependents === undefined) {
      return unknown("family", "how many people depend on your income");
    }

    let score = 0;
    const drivers: string[] = [];

    if (dependents >= 4) {
      score = 65;
      drivers.push(`${dependents} dependants — a large share of one income supporting several people.`);
    } else if (dependents >= 2) {
      score = 45;
      drivers.push(`${dependents} dependants.`);
    } else if (dependents === 1) {
      score = 25;
      drivers.push("One dependant.");
    } else {
      score = 5;
      drivers.push("No dependants, so a loss of income would not leave anyone else short.");
    }

    if (profile.parentsDependent) {
      score += 15;
      drivers.push("Dependent parents, who usually need health cover of their own rather than a place on a family floater.");
    }

    return {
      dimension: "family",
      band: bandFor(score),
      score: Math.min(100, score),
      drivers,
      mitigations:
        dependents > 0
          ? ["Term life cover sized to your income is the cheapest way to hold this risk."]
          : ["Revisit this if anyone becomes dependent on your income."],
    };
  }

  private lifestyle(profile: InsuranceProfileFacts): RiskFactor {
    const smoker = profile.smoker;
    const travel = profile.travelFrequency;
    if (smoker === null || smoker === undefined) {
      return unknown("lifestyle", "whether you smoke");
    }

    let score = smoker ? 45 : 10;
    const drivers = smoker
      ? ["Smoking, which affects both life and health premiums and some claim outcomes."]
      : ["Nothing on your profile raises lifestyle risk."];

    if (travel === "FREQUENT" || travel === "INTERNATIONAL") {
      score += 10;
      drivers.push("Frequent travel, which adds time spent away from your usual medical care.");
    }

    return {
      dimension: "lifestyle",
      band: bandFor(score),
      score: Math.min(100, score),
      drivers,
      mitigations: smoker
        ? ["Insurers re-rate after a documented smoke-free period. It is worth asking for a review."]
        : ["Keep declarations current — a change here changes your premium."],
    };
  }

  private occupation(profile: InsuranceProfileFacts): RiskFactor {
    const occupation = profile.occupation?.toLowerCase().trim();
    if (!occupation) return unknown("occupation", "what you do for a living");

    const hazardous = HAZARDOUS_OCCUPATIONS.find((h) => occupation.includes(h));
    const sedentary = SEDENTARY_OCCUPATIONS.find((s) => occupation.includes(s));

    if (hazardous) {
      return {
        dimension: "occupation",
        band: "ELEVATED",
        score: 55,
        drivers: [`Work involving ${hazardous}, which insurers rate for injury risk.`],
        mitigations: [
          "Personal accident cover is usually the cheapest meaningful protection for this kind of work, and is often overlooked in favour of life cover.",
        ],
      };
    }

    if (sedentary) {
      return {
        dimension: "occupation",
        band: "LOW",
        score: 15,
        drivers: ["Desk-based work, which insurers rate as low occupational risk."],
        mitigations: ["Sedentary work carries its own long-term health risks that insurers do not price but you should."],
      };
    }

    // Not on either list. Saying so beats guessing an average.
    return {
      dimension: "occupation",
      band: "UNKNOWN",
      score: null,
      drivers: [`We do not have a risk rating for "${profile.occupation}".`],
      mitigations: ["An advisor can rate this properly during your application."],
    };
  }

  private financial(profile: InsuranceProfileFacts): RiskFactor {
    const income = profile.incomeRange;
    if (!income) return unknown("financial", "your income range");

    const history = profile.insuranceHistory;
    let score = 0;
    const drivers: string[] = [];
    const mitigations: string[] = [];

    if (income === "BELOW_3L") {
      score += 45;
      drivers.push("A lower income band, where an uninsured setback is hardest to absorb — which makes cover more important here, not less.");
      mitigations.push("Government-backed schemes and low-cost term plans cover a great deal for very little.");
    } else if (income === "3L_6L") {
      score += 30;
      drivers.push("A modest income band with limited slack for an unplanned expense.");
    } else {
      score += 10;
      drivers.push("An income band with some capacity to absorb a shock.");
    }

    if (history?.lapses && history.lapses > 0) {
      score += 20;
      drivers.push(`${history.lapses} previous ${history.lapses === 1 ? "lapse" : "lapses"} — cover that stopped when it was needed.`);
      mitigations.push("Auto-debit on renewal removes the most common cause of a lapse.");
    }

    if (history?.priorClaims && history.priorClaims > 2) {
      score += 10;
      drivers.push(`${history.priorClaims} prior claims, which affects renewal pricing.`);
    }

    return { dimension: "financial", band: bandFor(score), score: Math.min(100, score), drivers, mitigations };
  }
}

function narrate(overall: RiskBand, factors: readonly RiskFactor[], unknownCount: number): string {
  if (overall === "UNKNOWN") {
    return `We could not form an overall picture — ${unknownCount} of ${factors.length} areas are still unknown. What we do know is set out area by area below.`;
  }
  const raised = factors
    .filter((f) => f.band === "HIGH" || f.band === "ELEVATED")
    .map((f) => f.dimension);

  if (raised.length === 0) {
    return `Nothing stands out as elevated. ${unknownCount > 0 ? `${unknownCount} areas are still unknown.` : "Every area could be assessed."}`;
  }
  return `${raised.join(", ")} ${raised.length === 1 ? "stands" : "stand"} out and shaped the recommendations below.${unknownCount > 0 ? ` ${unknownCount} areas are still unknown.` : ""}`;
}
