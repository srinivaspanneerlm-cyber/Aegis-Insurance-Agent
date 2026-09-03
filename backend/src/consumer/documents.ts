/**
 * Which files a customer may attach to their own policy.
 *
 * Narrower than the platform catalogue in `utils/fileTypes.ts`, and narrowed
 * here rather than there. That catalogue serves claims and applications, where a
 * walkaround video and a DOCX questionnaire are legitimate; this flow is one
 * person sending one insurance certificate, which in practice is a PDF from an
 * insurer's email or a photograph of a printed page.
 *
 * Keeping the list short is a security decision as much as a product one. Every
 * format admitted is a parser somebody downstream has to be safe against, and
 * the three below are the ones that actually arrive. A customer holding a HEIC
 * photo is not turned away silently — the message names what to send instead.
 *
 * The formats are *selected from* the platform catalogue rather than redescribed
 * here, so the magic bytes this flow accepts and the magic bytes the scanner
 * knows about cannot drift apart.
 */
import { FILE_FORMATS, extensionOf, type FileFormat } from "../utils/fileTypes";

/** The format ids this flow accepts, in the order a customer meets them. */
export const CONSUMER_FORMAT_IDS = ["pdf", "jpeg", "png"] as const;
export type ConsumerFormatId = (typeof CONSUMER_FORMAT_IDS)[number];

export const CONSUMER_FORMATS: readonly FileFormat[] = FILE_FORMATS.filter((format) =>
  (CONSUMER_FORMAT_IDS as readonly string[]).includes(format.id)
);

/**
 * A guard against the catalogue being renamed out from under this file.
 *
 * Selecting by id is only safe while the ids exist; if one is renamed, this flow
 * would quietly accept two formats instead of three and nothing else would
 * notice. Failing at import is the loudest available moment.
 */
if (CONSUMER_FORMATS.length !== CONSUMER_FORMAT_IDS.length) {
  throw new Error(
    "Aegis Consumer expects pdf, jpeg and png in FILE_FORMATS — the catalogue has changed."
  );
}

/** `.pdf`, `.jpg`, `.jpeg`, `.png`. */
export const CONSUMER_EXTENSIONS: readonly string[] = CONSUMER_FORMATS.flatMap(
  (format) => format.extensions
);

/**
 * Declared MIME types the door tolerates.
 *
 * `application/octet-stream` and an empty string are included for the same
 * reason the platform filter includes them: phone browsers routinely send one or
 * the other for a photograph, and refusing those would turn away real customers
 * on real devices. It is safe only because the declared type is never the check
 * that decides — `scanFile` reads the bytes afterwards, and a file whose content
 * is not one of these three formats is rejected there.
 */
export const CONSUMER_MIMES: ReadonlySet<string> = new Set([
  ...CONSUMER_FORMATS.flatMap((format) => format.mimes),
  "application/octet-stream",
  "",
]);

/** Whether the bytes the scanner recognised are a format this flow accepts. */
export const isConsumerFormat = (formatId: string | undefined | null): boolean =>
  typeof formatId === "string" && (CONSUMER_FORMAT_IDS as readonly string[]).includes(formatId);

/** Whether the *declared* name and type are worth reading the file for. */
export function looksAcceptable(filename: string, mimeType: string | undefined): boolean {
  return (
    CONSUMER_EXTENSIONS.includes(extensionOf(filename)) &&
    CONSUMER_MIMES.has((mimeType || "").toLowerCase())
  );
}

/** "PDF, JPG or PNG" — the list as a customer reads it, not as a MIME set. */
export const CONSUMER_FORMATS_LABEL = "PDF, JPG or PNG";

/**
 * What a stored document is filed as.
 *
 * Reuses the platform's `existing_policy` requirement rather than inventing a
 * consumer-only key: it means precisely this document — the certificate for
 * cover the customer already holds — and reusing it keeps one customer's
 * documents in one list rather than two that disagree.
 */
export const CONSUMER_DOCUMENT_KEY = "existing_policy";
export const CONSUMER_DOCUMENT_CATEGORY = "policy";
export const CONSUMER_DOCUMENT_DOMAIN = "motor";

/**
 * Whether a stored document's canonical type is one this flow accepts.
 *
 * Asked of rows rather than of uploads. A policy may point at a document that
 * reached the platform through the general pipeline — a DOCX, a walkaround
 * video — and the trust gate must not treat that as a readable certificate
 * simply because a file is attached.
 */
export const isConsumerMime = (mime: string | null | undefined): boolean =>
  typeof mime === "string" &&
  CONSUMER_FORMATS.some((format) => format.mimes.includes(mime.toLowerCase()));
