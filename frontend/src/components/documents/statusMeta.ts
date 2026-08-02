import type {
  DocumentUpload,
  LocalisedText,
  VerificationStage,
  VerificationStageId,
  VerificationStatus,
} from "@/types/documents";

/**
 * Derived state for the document cards.
 *
 * Kept as pure functions so the honesty rules — a verified badge only ever
 * appears for a check that actually passed, and a simulated result always says
 * so — are unit-testable instead of buried in JSX.
 */

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

// ── Stage copy ───────────────────────────────────────────────────────────────

/** What each stage is doing, in the present tense, while it runs. */
export const STAGE_RUNNING_LABEL: Record<VerificationStageId, LocalisedText> = {
  upload: { en: "Uploading", taEn: "Upload aagudhu" },
  ocr: { en: "Reading the document", taEn: "Document padikkirom" },
  metadata: { en: "Checking metadata", taEn: "Metadata check pandrom" },
  gps: { en: "Checking location", taEn: "Location check pandrom" },
  fraud: { en: "Screening for fraud", taEn: "Fraud check pandrom" },
  blockchain: { en: "Anchoring to the ledger", taEn: "Ledger-la anchor pandrom" },
};

/** What a *passed* stage earns the document. Never shown for any other status. */
export const STAGE_PASSED_BADGE: Record<VerificationStageId, LocalisedText> = {
  upload: { en: "Uploaded", ta: "பதிவேற்றப்பட்டது", taEn: "Uploaded" },
  ocr: { en: "OCR Verified", taEn: "OCR verified" },
  metadata: { en: "Metadata Verified", taEn: "Metadata verified" },
  gps: { en: "Location Verified", taEn: "Location verified" },
  fraud: { en: "Fraud Check Passed", taEn: "Fraud check pass" },
  blockchain: { en: "Ledger Anchored", taEn: "Ledger anchored" },
};

export const STATUS_TONE: Record<VerificationStatus, StatusTone> = {
  pending: "neutral",
  running: "info",
  passed: "success",
  failed: "danger",
  skipped: "neutral",
};

// ── Progress ─────────────────────────────────────────────────────────────────

/**
 * How far through its pipeline a document is, 0–100.
 *
 * Every stage carries an equal share. A settled stage contributes its whole
 * share whatever the outcome — a failed check is still a finished one, and a
 * bar that stalls at 40% tells the customer less than a bar that completes and
 * a status that says why it stopped.
 */
export function pipelineProgress(stages: VerificationStage[]): number {
  if (stages.length === 0) return 0;
  const share = 100 / stages.length;

  const done = stages.reduce((total, stage) => {
    if (stage.status === "running") return total + share * ((stage.progress ?? 0) / 100);
    if (stage.status === "pending") return total;
    return total + share;
  }, 0);

  return Math.round(done);
}

// ── Badges ───────────────────────────────────────────────────────────────────

export interface VerificationBadge {
  id: VerificationStageId;
  label: LocalisedText;
}

/** Badges for the checks that genuinely passed — nothing else earns one. */
export function passedBadges(stages: VerificationStage[]): VerificationBadge[] {
  return stages
    .filter((s) => s.status === "passed")
    .map((s) => ({ id: s.id, label: STAGE_PASSED_BADGE[s.id] }));
}

/** Checks that never ran because no service is connected behind them. */
export function unverifiedCount(stages: VerificationStage[]): number {
  return stages.filter((s) => s.status === "skipped" || s.status === "pending").length;
}

/** True when any result on this document came from the simulator, so the UI can
 *  say so rather than passing a demo off as a real verification. */
export function isSimulated(upload: DocumentUpload): boolean {
  return upload.intelligence?.flags.includes("Simulated") ?? false;
}

// ── Phase ────────────────────────────────────────────────────────────────────

export interface PhaseMeta {
  label: LocalisedText;
  tone: StatusTone;
}

/** The one-line status pill for a document card. */
export function phaseMeta(upload: DocumentUpload): PhaseMeta {
  switch (upload.phase) {
    case "queued":
      return { label: { en: "Queued", taEn: "Queue-la" }, tone: "neutral" };
    case "uploading":
      return { label: { en: "Uploading", taEn: "Upload aagudhu" }, tone: "info" };
    case "verifying":
      return { label: { en: "Verifying", taEn: "Verify pandrom" }, tone: "info" };
    case "failed":
      return { label: { en: "Needs attention", taEn: "Problem iruku" }, tone: "danger" };
    case "completed": {
      if (upload.stages.some((s) => s.status === "failed")) {
        return { label: { en: "Check failed", taEn: "Check fail aachu" }, tone: "danger" };
      }
      // Uploaded safely, but nothing verified it — say that plainly.
      if (passedBadges(upload.stages).every((b) => b.id === "upload")) {
        return { label: { en: "Uploaded", ta: "பதிவேற்றப்பட்டது", taEn: "Uploaded" }, tone: "neutral" };
      }
      return { label: { en: "Verified", ta: "சரிபார்க்கப்பட்டது", taEn: "Verified" }, tone: "success" };
    }
  }
}

// ── Requirement roll-up ──────────────────────────────────────────────────────

export type RequirementState = "pending" | "active" | "complete" | "failed";

/** Where one requirement stands, given the files attached to it so far. */
export function requirementState(uploads: DocumentUpload[]): RequirementState {
  if (uploads.length === 0) return "pending";
  if (uploads.some((u) => u.phase === "uploading" || u.phase === "verifying" || u.phase === "queued")) {
    return "active";
  }
  if (uploads.every((u) => u.phase === "failed")) return "failed";
  return "complete";
}

/** Share of *required* documents that are done, 0–100 — the number the
 *  workflow header and the accordion both report. */
export function completionPercent(
  requirements: { id: string; required: boolean }[],
  uploads: DocumentUpload[],
): number {
  const required = requirements.filter((r) => r.required);
  if (required.length === 0) return 100;

  const satisfied = required.filter(
    (r) => requirementState(uploads.filter((u) => u.requirementId === r.id)) === "complete",
  ).length;

  return Math.round((satisfied / required.length) * 100);
}
