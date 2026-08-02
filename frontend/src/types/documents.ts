/**
 * Contracts for the AI-driven document workflow.
 *
 * These shapes are deliberately transport-agnostic: the advisor UI, the local
 * upload service and a future MCP server all speak them, so replacing the
 * verification backend never reaches into a component. Nothing here knows
 * which insurance domain it describes — the catalogue lives in
 * `lib/documents/registry`, and an agent may always override it at runtime.
 */

// ── Copy ─────────────────────────────────────────────────────────────────────

export type DocumentLocale = "en" | "ta" | "taEn";

/** Customer-facing copy. Tamil and Thanglish fall back to English when absent. */
export interface LocalisedText {
  en: string;
  ta?: string;
  taEn?: string;
}

// ── Verification ─────────────────────────────────────────────────────────────

export type VerificationStageId =
  | "upload"
  | "ocr"
  | "metadata"
  | "gps"
  | "fraud"
  | "blockchain";

export type VerificationStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

export interface VerificationStage {
  id: VerificationStageId;
  status: VerificationStatus;
  /** Human-readable outcome, e.g. "Vehicle number matched". */
  detail?: string;
  /** 0–100, only for stages that report granular progress (the transfer). */
  progress?: number;
}

/** What the pipeline understood about a document once it cleared OCR. */
export interface DocumentIntelligence {
  /** Field label → extracted value, e.g. `{ "Vehicle Number": "TN 09 AB 1234" }`. */
  fields: Record<string, string>;
  /** 0–1 confidence in the extraction as a whole. */
  confidence: number;
  /** Non-fatal observations, e.g. "Low-resolution scan", "Simulated result". */
  flags: string[];
}

// ── The ask ──────────────────────────────────────────────────────────────────

/** One document an agent is asking the customer for. */
export interface DocumentRequirement {
  /** Unique within its request. */
  id: string;
  /** Registry key such as `rc_book`. Open on purpose — an agent may name a
   *  document the catalogue has never heard of, and that must still render. */
  kind: string;
  label: LocalisedText;
  hint?: LocalisedText;
  icon: string;
  /** MIME types offered to the native picker's `accept` attribute. */
  accept: string[];
  maxBytes: number;
  multiple: boolean;
  required: boolean;
  /** Verification stages this document must clear, in order. */
  stages: VerificationStageId[];
}

/** A whole ask — rendered as one card block inside the transcript. */
export interface DocumentRequest {
  id: string;
  title: LocalisedText;
  note?: LocalisedText;
  requirements: DocumentRequirement[];
  agentName?: string;
  agentDomain?: string;
  /** How the request was produced. `ai-tag` is authoritative; `inferred` came
   *  from the agent's prose; `registry` is the domain default set. */
  source: "ai-tag" | "inferred" | "registry";
}

// ── The upload ───────────────────────────────────────────────────────────────

export type UploadPhase =
  | "queued"
  | "uploading"
  | "verifying"
  | "completed"
  | "failed";

export interface UploadedFileMeta {
  name: string;
  sizeBytes: number;
  mimeType: string;
  /** Object URL for image previews; revoked when the upload is discarded. */
  previewUrl?: string;
}

/** One file's journey from picker to verified document. */
export interface DocumentUpload {
  id: string;
  requirementId: string;
  kind: string;
  file: UploadedFileMeta;
  phase: UploadPhase;
  /** 0–100 across the whole pipeline, not just the network transfer. */
  progress: number;
  stages: VerificationStage[];
  /** Server-side document id, once persisted. */
  documentId?: string;
  uploadedAt?: string;
  intelligence?: DocumentIntelligence;
  error?: string;
}

// ── The workflow ─────────────────────────────────────────────────────────────

export type WorkflowStepId =
  | "documents"
  | "upload"
  | "verification"
  | "payment"
  | "delivery";

export type WorkflowStepStatus = "locked" | "active" | "done";

export interface WorkflowStep {
  id: WorkflowStepId;
  title: LocalisedText;
  description?: LocalisedText;
  status: WorkflowStepStatus;
  /** 0–100 completion of this step's own work. */
  progress: number;
}
