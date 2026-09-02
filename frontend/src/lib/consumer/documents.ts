import { MIME } from "@/lib/documents/registry";
import { validateFile, type FileRejection, type ValidatableFile } from "@/lib/documents/validation";
import type { LocalisedText } from "@/types/documents";
import type { TrustState } from "@/services/api";

/**
 * What a customer may attach to their own policy, and what the badge says.
 *
 * The file rules mirror the API's — three formats, ten megabytes — and mirror
 * them *deliberately* rather than sharing a module: this is a Next app and that
 * is a Node service, and the coupling is not worth a shared package. A test in
 * this folder pins the two together so they cannot drift silently.
 *
 * Checking here is a courtesy that fails fast and explains itself in the
 * customer's language. It is not a boundary: the API re-checks everything and
 * reads the file's actual magic bytes, because everything in a browser can be
 * bypassed by anyone talking to the API directly.
 */

/** PDF, JPG and PNG. Nothing else — see the API's `consumer/documents.ts`. */
export const CONSUMER_ACCEPT = [MIME.pdf, MIME.jpeg, MIME.png];

/**
 * Ten megabytes, matching `CONSUMER_DOCUMENT_MAX_BYTES` on the API.
 *
 * A deployment may configure the API lower. This number being the higher of the
 * two is safe — the file is refused at the door with a sentence saying the real
 * limit — while the reverse would turn away a file the API would have taken.
 */
export const CONSUMER_MAX_BYTES = 10 * 1024 * 1024;

/** "PDF, JPG or PNG", the way the API says it too. */
export const CONSUMER_FORMATS_LABEL = "PDF, JPG or PNG";

/** Null when the file is fine; otherwise why, in three languages. */
export function validatePolicyDocument(file: ValidatableFile): FileRejection | null {
  return validateFile(file, {
    accept: CONSUMER_ACCEPT,
    maxBytes: CONSUMER_MAX_BYTES,
    label: { en: "Insurance certificate" },
  });
}

// ── The trust badge ──────────────────────────────────────────────────────────

/**
 * How a state is drawn.
 *
 * `tone` is never the only signal — every badge renders its label as words, and
 * a component that showed colour alone would be unreadable to somebody who
 * cannot distinguish amber from green, which on a screen about whether they are
 * insured is not an acceptable failure.
 *
 * There is deliberately no red. Red is for something the customer did wrong,
 * and none of these four states is that: two are questions we are asking, one
 * is a settled record, and one is simply that nothing has been checked.
 */
export type TrustTone = "neutral" | "attention" | "settled" | "review";

export interface TrustStateMeta {
  readonly tone: TrustTone;
  /** A short line for a list row, where the API's fuller copy will not fit. */
  readonly short: LocalisedText;
}

export const TRUST_STATE_META: Record<TrustState, TrustStateMeta> = {
  UPLOADED: {
    tone: "neutral",
    short: {
      en: "As you entered it",
      ta: "நீங்கள் பதிவு செய்தபடி",
      taEn: "Neenga podadhu padiye",
    },
  },
  NEEDS_CONFIRMATION: {
    tone: "attention",
    short: {
      en: "One thing to confirm",
      ta: "ஒன்றை உறுதிப்படுத்த வேண்டும்",
      taEn: "Onnu confirm panna venum",
    },
  },
  CONSISTENCY_VERIFIED: {
    tone: "settled",
    short: {
      en: "Details check out",
      ta: "விவரங்கள் பொருந்துகின்றன",
      taEn: "Details sariyaa porundhudhu",
    },
  },
  VERIFICATION_REQUIRED: {
    tone: "review",
    short: {
      en: "We will check this with you",
      ta: "இதை உங்களுடன் சேர்ந்து பார்ப்போம்",
      taEn: "Idha ungaloda serndhu paapom",
    },
  },
};

/** Tailwind classes per tone. Kept beside the tones so a new one cannot be added without styling it. */
export const TRUST_TONE_CLASS: Record<TrustTone, string> = {
  neutral: "border-line bg-surface-sunken text-content-muted",
  attention: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  settled: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  review: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
};

/** `1.4 MB`, for a document row. */
export function formatSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}
