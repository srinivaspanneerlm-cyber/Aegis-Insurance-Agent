/**
 * What a website enquiry is, and what makes one valid.
 *
 * Deliberately shared by the form and the route handler that receives it. The
 * browser's copy exists to be kind — it catches a typo before a round trip. The
 * server's copy exists because the browser's can be skipped entirely, and a
 * validation rule that lives only in the client is not a rule, it is a
 * suggestion.
 */

export const ORGANIZATION_SIZES = [
  "1 – 10 employees",
  "11 – 50 employees",
  "51 – 250 employees",
  "251 – 1,000 employees",
  "More than 1,000 employees",
] as const;

export type EnquiryKind = "contact" | "demo";

export interface EnquiryInput {
  kind: EnquiryKind;
  name: string;
  email: string;
  phone?: string | undefined;
  company?: string | undefined;
  organizationSize?: string | undefined;
  message: string;
  /** Honeypot. A real person never fills this in; a naive bot fills everything. */
  website?: string | undefined;
}

export type FieldErrors = Partial<Record<keyof EnquiryInput, string>>;

/** Bounds, so an oversized body cannot be pushed through the form. */
const LIMITS = {
  name: 120,
  email: 254, // the maximum length of an address per RFC 5321
  phone: 32,
  company: 160,
  message: 4000,
} as const;

/**
 * Good enough, and deliberately not more.
 *
 * A stricter pattern rejects addresses that genuinely work — plus-addressing,
 * new top-level domains, non-Latin domains — and every one of those rejections
 * is a customer told they typed their own address wrong. Whether an address
 * *receives* mail is a question only sending to it can answer.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEnquiry(input: Partial<EnquiryInput>): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const name = trimmed(input.name);
  if (!name) errors.name = "Please tell us your name.";
  else if (name.length > LIMITS.name) errors.name = "That name is too long.";

  const email = trimmed(input.email);
  if (!email) errors.email = "We need an email address to reply to.";
  else if (email.length > LIMITS.email || !EMAIL.test(email))
    errors.email = "That does not look like an email address.";

  const message = trimmed(input.message);
  if (!message) errors.message = "Please tell us what you need.";
  else if (message.length < 10) errors.message = "A sentence or two helps us route this properly.";
  else if (message.length > LIMITS.message)
    errors.message = "Please keep this under 4,000 characters.";

  const phone = trimmed(input.phone);
  if (phone && phone.length > LIMITS.phone) errors.phone = "That phone number is too long.";
  // Digits, spaces and the punctuation real numbers are written with. Not a
  // format check — international numbers are written a dozen valid ways.
  if (phone && !/^[\d\s+()-]{6,}$/.test(phone)) errors.phone = "Please check this phone number.";

  const company = trimmed(input.company);
  if (company.length > LIMITS.company) errors.company = "That company name is too long.";

  if (input.kind === "demo") {
    if (!company) errors.company = "Please tell us which organisation you are with.";
    if (!phone) errors.phone = "A phone number helps us arrange a time.";
    if (!trimmed(input.organizationSize)) {
      errors.organizationSize = "Please choose the closest size.";
    } else if (!ORGANIZATION_SIZES.includes(trimmed(input.organizationSize) as never)) {
      errors.organizationSize = "Please choose one of the listed sizes.";
    }
  }

  return errors;
}

export const hasErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;
