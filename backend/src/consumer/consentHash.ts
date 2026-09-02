import crypto from "crypto";
import { CONSENT_TEXT, type LocalisedText } from "./messages";
import type { ConsentPurpose } from "./renewalLead";

/**
 * The proof half of a consent record.
 *
 * A stored `textVersion` says which wording we *believe* somebody agreed to.
 * That is a claim about our own bookkeeping, and it survives an edit: change a
 * sentence without bumping the version and every consent row still says "v1"
 * while v1 now means something else. The hash is the part that cannot be
 * quietly wrong.
 *
 * Hashed over every language, in a fixed order, rather than over the English
 * alone. A customer who agreed in Tamil agreed to the Tamil sentence, and a
 * hash that ignored it would prove the wrong thing for exactly the people this
 * product is built for.
 */
export function consentTextHash(purpose: ConsentPurpose): string {
  const text: LocalisedText = CONSENT_TEXT[purpose];
  // Fixed order and an explicit separator. Concatenating without one would let
  // two different catalogues hash the same by moving a character across a
  // boundary.
  const canonical = [purpose, text.en, text.ta ?? "", text.taEn ?? ""].join("\u001f");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}
