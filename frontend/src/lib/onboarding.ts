import type { AdvisorKey } from "./advisors";

/**
 * What a first-time customer is asked, once.
 *
 * The ids here MUST match `ONBOARDING` in `backend/src/config/constants.ts` —
 * the server allowlists both fields, so an id that exists only on this side is
 * rejected rather than saved. Keeping the copy here and the allowlist there is
 * deliberate: the customer-facing wording is a frontend concern, the set of
 * permitted values is a security one.
 */

export type LanguageId = "en" | "ta" | "taEn";

export interface LanguageOption {
  id: LanguageId;
  /** Written in the language itself — a Tamil reader should recognise their
   *  own option without having to read English first. */
  label: string;
  hint: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: "en", label: "English", hint: "Continue in English" },
  { id: "ta", label: "தமிழ்", hint: "தமிழில் தொடரவும்" },
  { id: "taEn", label: "Thanglish", hint: "Tamil + English kalandhu" },
];

export interface InterestOption {
  /** Doubles as the advisor roster key, so the choice can route them later. */
  id: AdvisorKey;
  label: string;
  hint: string;
  emoji: string;
}

export const INTEREST_OPTIONS: InterestOption[] = [
  { id: "health", label: "Health", hint: "Family & medical cover", emoji: "❤️" },
  { id: "motor", label: "Motor", hint: "Car, bike & vehicle", emoji: "🚗" },
  { id: "travel", label: "Travel", hint: "Trips & journeys", emoji: "✈️" },
  { id: "property", label: "Home", hint: "House & belongings", emoji: "🏠" },
  { id: "miscellaneous", label: "Not sure yet", hint: "Help me decide", emoji: "💼" },
];

export const MAX_INTERESTS = 5;

/** Stored as a JSON array string; never trust it to be well-formed. */
export function parseInterests(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((i) => typeof i === "string") : [];
  } catch {
    return [];
  }
}
