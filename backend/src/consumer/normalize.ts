/**
 * Canonical forms for the two identifiers a duplicate check is about.
 *
 * A vehicle registration and a policy number are written differently by every
 * person who writes one. "TN 09 AB 1234", "tn-09-ab-1234" and "TN09AB1234" are
 * one motorcycle; a duplicate check comparing the raw strings sees three, and a
 * customer adding the same bike for the third year running is told it is new.
 *
 * So each is stored twice: exactly as typed, which is what the customer is
 * shown back, and normalised, which is what the database indexes and compares.
 * This module is the only thing permitted to produce the second one — if
 * normalisation happened at each call site, two of them would eventually
 * disagree and the duplicate check would silently stop working, with no error
 * anywhere to say so.
 *
 * Deliberately **not** validation. Nothing here judges whether a registration
 * is real or a policy number is plausible — an unrecognised format is still
 * normalised and still stored. Half the people this product serves hold
 * paperwork that predates the current formats, and refusing their details at
 * the door is how the flow loses the person it was built for. Whether details
 * look consistent is the trust gate's question, and its answer is a prompt to
 * confirm, never a refusal.
 */

/** Everything that is not a letter or a digit. */
const NOISE = /[^A-Z0-9]/g;

/**
 * Uppercase, with spacing and punctuation removed.
 *
 * Returns null for anything with nothing left in it, so an empty string and a
 * string of hyphens both mean "not supplied" rather than becoming an empty
 * canonical value that every other empty value would collide with in a unique
 * index.
 */
function canonicalise(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const canonical = value.toUpperCase().replace(NOISE, "");
  return canonical === "" ? null : canonical;
}

/**
 * The indexed form of a vehicle registration.
 *
 * Feeds `Vehicle.registrationNorm`, which carries a unique constraint per owner.
 */
export const normalizeRegistration = (value: string | null | undefined): string | null =>
  canonicalise(value);

/**
 * The indexed form of a policy number.
 *
 * Feeds `HeldPolicy.policyNumberNorm`. Insurers punctuate these freely — slashes,
 * hyphens, spaces around a branch code — and the same policy re-typed from the
 * same certificate rarely comes out character-identical twice.
 */
export const normalizePolicyNumber = (value: string | null | undefined): string | null =>
  canonicalise(value);
