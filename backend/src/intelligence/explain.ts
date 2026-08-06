/**
 * Building explanations, and computing honest confidence.
 *
 * Confidence here is a function of *how much the engine actually knows*, not of
 * how strongly a rule fired. A rule can fire with total certainty on a profile
 * consisting of one answered question, and reporting that as high confidence
 * would be a lie told precisely to the customers this platform exists for.
 */
import type { Confidence, InsuranceProfileFacts } from "./types";

/** Fields that materially change advice, and how much each is worth. */
const FIELD_WEIGHTS: ReadonlyArray<{
  readonly field: string;
  readonly label: string;
  readonly weight: number;
  readonly known: (p: InsuranceProfileFacts) => boolean;
}> = [
  { field: "age", label: "your age", weight: 18, known: (p) => typeof p.age === "number" },
  {
    field: "incomeRange",
    label: "your income range",
    weight: 18,
    known: (p) => Boolean(p.incomeRange),
  },
  {
    field: "dependents",
    label: "how many people depend on you",
    weight: 16,
    known: (p) => typeof p.dependents === "number",
  },
  {
    field: "heldPolicies",
    label: "the cover you already hold",
    weight: 16,
    known: (p) => (p.heldPolicies?.length ?? 0) > 0,
  },
  {
    field: "occupation",
    label: "your occupation",
    weight: 8,
    known: (p) => Boolean(p.occupation),
  },
  {
    field: "maritalStatus",
    label: "your marital status",
    weight: 6,
    known: (p) => Boolean(p.maritalStatus),
  },
  { field: "city", label: "where you live", weight: 6, known: (p) => Boolean(p.city) },
  {
    field: "vehicles",
    label: "any vehicles you own",
    weight: 4,
    known: (p) => (p.vehicles?.length ?? 0) > 0,
  },
  {
    field: "properties",
    label: "any property you own",
    weight: 4,
    known: (p) => (p.properties?.length ?? 0) > 0,
  },
  {
    field: "riskPreference",
    label: "how much risk you are comfortable with",
    weight: 4,
    known: (p) => Boolean(p.riskPreference),
  },
];

/**
 * How complete a profile is, 0–100.
 *
 * Weighted rather than a plain field count, because knowing somebody's age and
 * dependents supports far more reasoning than knowing their city.
 */
export function profileCompleteness(profile: InsuranceProfileFacts): number {
  const total = FIELD_WEIGHTS.reduce((sum, f) => sum + f.weight, 0);
  const have = FIELD_WEIGHTS.filter((f) => f.known(profile)).reduce((sum, f) => sum + f.weight, 0);
  return Math.round((have / total) * 100);
}

/** Which facts are missing, in plain words, most valuable first. */
export function missingFacts(profile: InsuranceProfileFacts): string[] {
  return FIELD_WEIGHTS.filter((f) => !f.known(profile))
    .sort((a, b) => b.weight - a.weight)
    .map((f) => f.label);
}

/**
 * Confidence for one piece of advice.
 *
 * `required` names the fields this particular conclusion rests on. Advice that
 * needs only age and dependents can be confident on a sparse profile; advice
 * that needs income and existing cover cannot. Capping at profile completeness
 * would be too blunt — it would punish a well-founded conclusion for unrelated
 * blanks.
 */
export function confidenceFrom(
  profile: InsuranceProfileFacts,
  required: readonly string[],
  basis: readonly string[]
): Confidence {
  const relevant = FIELD_WEIGHTS.filter((f) => required.includes(f.field));
  const pool = relevant.length > 0 ? relevant : FIELD_WEIGHTS;

  const totalWeight = pool.reduce((sum, f) => sum + f.weight, 0);
  const knownWeight = pool.filter((f) => f.known(profile)).reduce((sum, f) => sum + f.weight, 0);
  const ratio = totalWeight === 0 ? 0 : knownWeight / totalWeight;

  // Floor of 0.15 rather than 0: the engine reached a conclusion by *some*
  // route, and a zero would read as "this is meaningless" when it is closer to
  // "this is a starting point". Ceiling of 0.95: this is advice from a rule
  // engine on self-reported facts, and certainty is not available to it.
  const score = Math.min(0.95, Math.max(0.15, Number(ratio.toFixed(2))));

  return {
    score,
    basis,
    improvedBy: pool.filter((f) => !f.known(profile)).map((f) => f.label),
  };
}

/** Rounds a rupee figure to something a person would actually say out loud. */
export function roundToReadable(value: number): number {
  if (value <= 0) return 0;
  if (value >= 10_000_000) return Math.round(value / 5_000_000) * 5_000_000;
  if (value >= 1_000_000) return Math.round(value / 500_000) * 500_000;
  if (value >= 100_000) return Math.round(value / 50_000) * 50_000;
  return Math.round(value / 10_000) * 10_000;
}

/** ₹80,00,000 → "₹80 lakh"; the way the number is said in India. */
export function formatRupees(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "an amount we cannot estimate yet";
  if (value >= 10_000_000) {
    const cr = value / 10_000_000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} crore`;
  }
  if (value >= 100_000) {
    const l = value / 100_000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)} lakh`;
  }
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
