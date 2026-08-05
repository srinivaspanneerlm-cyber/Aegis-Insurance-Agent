/**
 * Presentation helpers, centralised so five apps cannot disagree about what a
 * rupee or a date looks like.
 *
 * `en-IN` is the default because this is an Indian insurance platform: the
 * lakh/crore grouping is what customers read fluently, and `en-US` grouping on
 * a premium figure is a small, constant signal that the product was not built
 * for them.
 */

const DEFAULT_LOCALE = "en-IN";

export function formatCurrency(
  amountInPaise: number,
  { locale = DEFAULT_LOCALE, currency = "INR" } = {}
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountInPaise / 100);
}

/**
 * Money is held in the smallest unit — paise — everywhere in this platform.
 *
 * Floating point cannot represent 0.1 exactly, so premiums accumulated as
 * rupees drift by fractions that eventually show up on a statement. Integers do
 * not drift.
 */
export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);
export const paiseToRupees = (paise: number): number => paise / 100;

export function formatDate(
  value: string | Date,
  { locale = DEFAULT_LOCALE, style = "medium" as const } = {}
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(date);
}

/** Truncate for display without cutting a word in half mid-render. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped}…`;
}
