/**
 * Maps a plan name to the advisor bot that should handle it, and builds the
 * advisor deep-link. This routing was previously duplicated inline in two
 * places on the policy-details page (the primary CTA and the "select
 * alternative" button); consolidating it here keeps a single source of truth
 * and makes the mapping unit-testable. Behaviour is identical to the originals.
 */

const BOT_MAP: Record<string, string> = {
  motor: "Alex",
  bumper: "Alex",
  drive: "Alex",
  travel: "Ethan",
  nomad: "Ethan",
  voyage: "Ethan",
  property: "Emma",
  fortress: "Emma",
  home: "Emma",
  cyber: "Emma",
  paws: "Emma",
  health: "Sarah",
};

/** First bot whose keyword appears in the plan name; defaults to Sarah. */
export function resolveAdvisorBot(planName: string): string {
  const name = (planName || "").toLowerCase();
  for (const [key, value] of Object.entries(BOT_MAP)) {
    if (name.includes(key)) return value;
  }
  return "Sarah";
}

/** Advisor deep-link for a plan, preselecting its bot and plan name. */
export function advisorPlanUrl(planName: string): string {
  return `/advisor?bot=${resolveAdvisorBot(planName)}&selectPlan=${encodeURIComponent(planName)}`;
}
