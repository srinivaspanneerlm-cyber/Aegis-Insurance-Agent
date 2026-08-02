import type { DocumentLocale, LocalisedText } from "@/types/documents";

/**
 * Resolve customer-facing copy for a locale.
 *
 * Tamil and Thanglish are optional on every string, so a partly-translated
 * catalogue degrades to English rather than rendering an empty label. Thanglish
 * also falls back to Tamil before English — a Thanglish reader understands the
 * Tamil line, which is closer than the English one.
 */
export function localise(text: LocalisedText, locale: DocumentLocale = "en"): string {
  if (locale === "ta") return text.ta || text.en;
  if (locale === "taEn") return text.taEn || text.ta || text.en;
  return text.en;
}
