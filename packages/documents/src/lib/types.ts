/**
 * The document platform's shared vocabulary.
 *
 * Every portal that shows a document — the customer's, the employee's, the
 * administrator's — reads these types. Written here rather than in each app so
 * that a status added on the server is a compile error in every consumer at
 * once, instead of a card that silently renders "unknown" in three places.
 *
 * Nothing in this package talks to an API. It renders what it is handed and
 * emits what a person did, which is what lets one component serve four
 * applications with four different data layers.
 */

export const DOCUMENT_STATUSES = [
  "UPLOADED",
  "PROCESSING",
  "PENDING_REVIEW",
  "VERIFIED",
  "REJECTED",
  "REPLACED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * The stages a document passes through, in order.
 *
 * Declared as an ordered list rather than a set, because the progress timeline
 * needs to know what comes next — and deriving that from a switch statement in
 * a component is how two portals end up disagreeing about the order.
 */
export const PIPELINE_STAGES = [
  { key: "UPLOADED", label: "Uploading", description: "Sending the file." },
  { key: "SCANNED", label: "Security scan", description: "Checking the file is safe to open." },
  { key: "EXTRACTED", label: "Reading", description: "Pulling out the text." },
  { key: "VALIDATED", label: "Checking fields", description: "Finding the details we need." },
  { key: "ANALYSED", label: "Risk review", description: "Looking for inconsistencies." },
  { key: "PENDING_REVIEW", label: "Awaiting review", description: "Waiting for a person." },
  { key: "VERIFIED", label: "Verified", description: "Accepted." },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]["key"];

export interface DocumentSummary {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly status: DocumentStatus;
  readonly category: string | null;
  readonly documentKey: string | null;
  readonly domain: string | null;
  readonly uploadedAt: string;
  readonly verifiedAt: string | null;
  readonly rejectionReason: string | null;
  readonly riskScore: number | null;
  readonly riskReason: string | null;
}

export interface DocumentTimelineEvent {
  readonly id: string;
  readonly stage: string;
  /** SYSTEM | ASSISTANT | EMPLOYEE. Rendered differently — a person's decision
   * must be visibly a person's. */
  readonly actorKind: string;
  readonly summary: string;
  readonly createdAt: string;
}

/**
 * A document the platform has asked for.
 *
 * `accepts` and `multiple` travel with the request rather than being looked up
 * client-side, so an upload card offers the right picker without every portal
 * holding its own copy of the catalogue.
 */
export interface DocumentRequirement {
  readonly id: string;
  readonly documentKey: string;
  readonly label: string;
  readonly description: string | null;
  /** Why this document, for this customer. */
  readonly reason: string | null;
  readonly required: boolean;
  readonly status: "PENDING" | "SUPPLIED" | "WAIVED" | "EXPIRED";
  readonly domain: string;
  readonly category: string;
  readonly accepts: readonly string[];
  readonly multiple: boolean;
}

/** A file being uploaded, from selection to completion. */
export interface UploadItem {
  readonly id: string;
  readonly file: File;
  readonly status: "queued" | "uploading" | "processing" | "done" | "failed";
  /** 0–100. Only meaningful while uploading. */
  readonly progress: number;
  readonly stage: PipelineStageKey | null;
  readonly error: string | null;
  /** Set once the server has accepted it. */
  readonly documentId: string | null;
}

// ── Limits ───────────────────────────────────────────────────────────────────

/** 50 MB, matching the server. A client that allowed more would fail late. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
] as const;

/**
 * Whether a file can be uploaded at all.
 *
 * Returns the reason rather than a boolean, because "that file cannot be
 * uploaded" is useless to somebody holding a 60 MB video — they need to know
 * which rule they hit and by how much.
 *
 * This is a courtesy, not a control: the server checks the same things, since
 * a client check is trivially bypassed.
 */
export function rejectionFor(
  file: File,
  accepts: readonly string[] = ACCEPTED_MIME_TYPES
): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${formatBytes(file.size)}. The largest we can take is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (accepts.length > 0 && !accepts.includes(file.type)) {
    return `We cannot read ${file.type || "that file type"} here. Try a PDF or a photograph.`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** What a preview should render as. */
export type PreviewKind = "image" | "pdf" | "video" | "none";

export function previewKindFor(mimeType: string | null): PreviewKind {
  if (!mimeType) return "none";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  // A Word document has no in-browser preview without a converter, and an
  // empty frame is worse than an honest "no preview".
  return "none";
}

export interface StatusMeta {
  readonly label: string;
  readonly tone: "neutral" | "info" | "warning" | "danger" | "success";
  /** What it means for the person reading it, not what the enum says. */
  readonly meaning: string;
}

/**
 * What each status means to a customer.
 *
 * The wording is deliberately about *them*: "we are checking it" rather than
 * "PENDING_REVIEW". A status a customer cannot act on should at least be one
 * they can understand.
 */
export const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  UPLOADED: {
    label: "Received",
    tone: "neutral",
    meaning: "We have it. Checks are about to start.",
  },
  PROCESSING: { label: "Checking", tone: "info", meaning: "We are running our checks on it now." },
  PENDING_REVIEW: {
    label: "Awaiting review",
    tone: "warning",
    meaning: "Someone will look at this shortly. You do not need to do anything.",
  },
  VERIFIED: { label: "Verified", tone: "success", meaning: "Accepted. Nothing further needed." },
  REJECTED: {
    label: "Not accepted",
    tone: "danger",
    meaning: "We could not use this one — the reason is below.",
  },
  REPLACED: { label: "Replaced", tone: "neutral", meaning: "You sent a newer version of this." },
};
