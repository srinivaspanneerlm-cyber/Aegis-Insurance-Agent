/**
 * Renewal intelligence.
 *
 * Renewal is where insurance quietly fails people. A policy that lapses because
 * a reminder arrived on the wrong day is indistinguishable, at claim time, from
 * never having bought it — and health cover that lapses restarts every waiting
 * period, which is a permanent loss rather than an inconvenience.
 *
 * So reminder timing is computed per domain rather than set to a single global
 * "30 days before". Motor has a legal deadline and a short decision; health has
 * a grace period, possible re-underwriting, and a decision worth thinking about.
 */
import type { RenewalPredictionService } from "./contracts";
import { confidenceFrom, formatRupees } from "./explain";
import {
  DOMAIN_LABEL,
  type InsuranceDomain,
  type InsuranceProfileFacts,
  type RenewalForecast,
  type Severity,
} from "./types";

/**
 * How many days before renewal to first make contact, by domain.
 *
 * Health leads because the decision is the largest: whether to increase cover,
 * whether to add somebody, whether a no-claim bonus has accrued. Motor is
 * shorter because the decision is small but the deadline is legal.
 */
const LEAD_DAYS: Record<InsuranceDomain, { first: number; why: string }> = {
  health: {
    first: 45,
    why: "Health renewals carry the biggest decisions — sum insured, who is covered, and whether a no-claim bonus has accrued. Forty-five days leaves room to think and to be re-underwritten if you increase cover.",
  },
  life: {
    first: 30,
    why: "A term premium rarely changes, so this is mostly about making sure the payment goes through.",
  },
  motor: {
    first: 21,
    why: "Cover must not lapse for even a day — driving uninsured is an offence, and a lapse loses your no-claim bonus. Three weeks is enough to compare and buy.",
  },
  property: {
    first: 30,
    why: "Worth a month to check the rebuilding cost has not drifted from the sum insured.",
  },
  travel: {
    first: 14,
    why: "Usually bought close to a trip, so a long lead time is noise rather than help.",
  },
  commercial: {
    first: 45,
    why: "Business cover often needs updated turnover or stock figures before it can be renewed.",
  },
};

export class RuleBasedRenewalPrediction implements RenewalPredictionService {
  /** Injected so tests are not tied to the wall clock. */
  constructor(private readonly now: () => Date = () => new Date()) {}

  async forecast(profile: InsuranceProfileFacts): Promise<readonly RenewalForecast[]> {
    const today = this.now();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();

    const forecasts: RenewalForecast[] = [];

    for (const policy of profile.heldPolicies ?? []) {
      if (policy.status !== "ACTIVE" || !policy.renewalDate) continue;

      const renewal = policy.renewalDate;
      const daysAway = Math.round(
        (new Date(renewal.getFullYear(), renewal.getMonth(), renewal.getDate()).getTime() -
          startOfToday) /
          86_400_000
      );

      // Past renewals are still reported, and at the highest priority. A policy
      // whose renewal date has passed is the single most urgent thing on a
      // customer's file, and dropping it from the list is how it stays missed.
      const overdue = daysAway < 0;
      const lead = LEAD_DAYS[policy.domain];

      const priority: Severity = overdue
        ? "CRITICAL"
        : daysAway <= 7
          ? "CRITICAL"
          : daysAway <= lead.first
            ? "HIGH"
            : daysAway <= 90
              ? "MODERATE"
              : "LOW";

      const reminderOn = new Date(renewal.getTime() - lead.first * 86_400_000);
      const improvements = this.improvementsFor(profile, policy);

      forecasts.push({
        policyId: policy.id,
        domain: policy.domain,
        renewalDate: renewal,
        daysAway,
        priority,
        reminderOn,
        reminderRationale: overdue
          ? "This date has passed. If the policy has lapsed, reinstating it quickly matters more than anything else on this list."
          : lead.why,
        coverageReviewSuggested: improvements.length > 0,
        improvements,
        explanation: {
          why: overdue
            ? `Your ${DOMAIN_LABEL[policy.domain].toLowerCase()} renewal date has passed.`
            : `Your ${DOMAIN_LABEL[policy.domain].toLowerCase()} renews in ${daysAway} days.`,
          how: [
            `Renewal date on your profile: ${renewal.toISOString().slice(0, 10)}.`,
            overdue
              ? `That was ${Math.abs(daysAway)} days ago.`
              : `That is ${daysAway} days away.`,
            `For ${DOMAIN_LABEL[policy.domain].toLowerCase()} we start ${lead.first} days ahead — ${lead.why.toLowerCase()}`,
          ],
          benefits: [
            "Renewing on time keeps waiting periods served and any no-claim bonus intact.",
            improvements.length > 0
              ? "Renewal is the one moment each year when changing your cover costs nothing extra."
              : "Nothing needs changing — the renewal is straightforward.",
          ],
          limitations: [
            "We do not know whether your insurer has already sent a notice.",
            "Premiums at renewal are set by the insurer and may differ from last year.",
          ],
          risksOfInaction: [
            policy.domain === "health"
              ? "A lapsed health policy usually restarts every waiting period, and anything diagnosed in the gap may be excluded permanently."
              : policy.domain === "motor"
                ? "Driving on a lapsed policy is an offence, and the no-claim bonus is lost after 90 days."
                : "Cover stops on the renewal date. Nothing after it is paid.",
          ],
          alternatives: [
            {
              option: "Switch insurer at renewal",
              whyNotChosen:
                policy.domain === "health"
                  ? "Portability is your right and worth checking, but it must be started 45 days before renewal or the option closes for the year."
                  : "Worth comparing — renewal is the only moment when switching costs nothing.",
            },
          ],
          confidence: confidenceFrom(profile, ["heldPolicies"], [
            `renewal date recorded as ${renewal.toISOString().slice(0, 10)}`,
          ]),
        },
      });
    }

    return forecasts.sort((a, b) => a.daysAway - b.daysAway);
  }

  /** What is worth changing at this renewal, if anything. */
  private improvementsFor(
    profile: InsuranceProfileFacts,
    policy: NonNullable<InsuranceProfileFacts["heldPolicies"]>[number]
  ): string[] {
    const out: string[] = [];
    const sum = policy.sumInsured ?? null;

    if (policy.domain === "health") {
      const family = profile.familyMembers ?? 1;
      if (sum !== null && sum < 500_000) {
        out.push(
          `Increase the sum insured. ${formatRupees(sum)} does not go far in a private hospital — renewal is when an increase is easiest.`
        );
      }
      if (family > 1 && sum !== null && sum < 1_000_000) {
        out.push(
          `A floater is shared across ${family} people. Two claims in one year would draw on the same ${formatRupees(sum)}.`
        );
      }
      if (profile.parentsDependent) {
        out.push(
          "Ask about a separate policy for your parents. Adding them to a floater usually raises the premium for everyone by more than a separate policy costs."
        );
      }
      out.push("Ask whether a no-claim bonus has increased your cover for free.");
    }

    if (policy.domain === "motor") {
      const vehicle = (profile.vehicles ?? [])[0];
      const age = vehicle?.year ? new Date().getFullYear() - vehicle.year : null;
      if (age !== null && age > 8) {
        out.push(
          `Check the declared value. On a vehicle around ${age} years old, insuring above market value costs more and pays no more.`
        );
      }
      out.push("Confirm your no-claim bonus has carried over — it is the largest discount on a motor policy and it is often lost in a switch.");
    }

    if (policy.domain === "property") {
      out.push("Check the sum insured against what rebuilding would cost today, not what you paid.");
    }

    if (policy.domain === "life" && (profile.dependents ?? 0) > 0 && sum !== null) {
      out.push("If your income or family has changed since you bought this, the cover may no longer be the right size.");
    }

    return out;
  }
}
