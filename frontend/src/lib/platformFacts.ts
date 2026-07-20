/**
 * Verified, publishable facts about the Aegis platform.
 *
 * Every value here is derived from something that actually exists in this
 * repository and can be re-checked:
 *   - 4 insurance categories  -> ai-python/app/agents/{health,motor,travel,property}_plans.py
 *   - 9 curated plans each    -> 36 total across those four catalogues
 *   - 5 specialist advisors   -> ai-python/app/agents/*_ai.py
 *
 * Anything that cannot be verified this way does not belong in this file — it
 * belongs in `placeholders.ts` and must be rendered with a visible marker.
 * Insurance performance figures (claim settlement ratios, families covered,
 * claims disbursed) are regulated representations; publishing invented ones is
 * a compliance risk, not a copy decision.
 */

export const INSURANCE_CATEGORIES = 4;
export const PLANS_PER_CATEGORY = 9;
export const CURATED_PLANS = INSURANCE_CATEGORIES * PLANS_PER_CATEGORY;
export const SPECIALIST_ADVISORS = 5;

export interface PlatformFact {
  value: string;
  label: string;
  desc: string;
}

/** Headline product facts, safe to present without qualification. */
export const PLATFORM_FACTS: PlatformFact[] = [
  {
    value: `${CURATED_PLANS}`,
    label: "Curated Plans",
    desc: "Independently reviewed policies across every category we cover",
  },
  {
    value: `${SPECIALIST_ADVISORS}`,
    label: "Specialist AI Advisors",
    desc: "A dedicated advisor per domain, not one general chatbot",
  },
  {
    value: `${INSURANCE_CATEGORIES}`,
    label: "Insurance Categories",
    desc: "Health, Motor, Travel and Home protection",
  },
  {
    value: "24/7",
    label: "Advisor Availability",
    desc: "Guidance whenever you need it, in plain language",
  },
];

/**
 * Shown in place of a per-plan figure the insurer has not supplied.
 *
 * Claim ratios, IDV and network sizes are regulated product data. When the API
 * does not return them we say so rather than substituting a plausible number.
 */
export const NOT_DISCLOSED = "Not disclosed";
