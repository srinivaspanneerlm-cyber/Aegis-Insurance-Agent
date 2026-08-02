import type {
  DocumentRequest,
  DocumentUpload,
  LocalisedText,
  WorkflowStep,
  WorkflowStepId,
  WorkflowStepStatus,
} from "@/types/documents";

/**
 * The customer's application expressed as ordered steps.
 *
 * Pure on purpose: the accordion renders whatever this returns, so "how far
 * along am I" is unit-testable rather than derived inside JSX. This module owns
 * only the three steps the document workflow actually controls — asking,
 * uploading, checking. Payment and delivery belong to the purchase flow and are
 * appended only when that flow passes them in.
 */

/** A step plus the two things the UI needs but {@link WorkflowStep} shouldn't carry. */
export interface WorkflowStepView extends WorkflowStep {
  /**
   * True only when the step's outcome was actually proven. A finished step whose
   * checks never ran is *complete*, not *verified*, and must not earn a tick —
   * same rule the document cards follow.
   */
  verified: boolean;
  /** The count line under the title, e.g. "2 of 3 received". */
  detail?: LocalisedText;
}

export interface WorkflowInput {
  /** The ask currently on screen; `null` before an agent has requested anything. */
  request: DocumentRequest | null;
  uploads: DocumentUpload[];
  /** Steps this feature does not own. Only the ids supplied here are appended. */
  extraSteps?: Partial<Record<"payment" | "delivery", ExtraStep>>;
}

export interface ExtraStep {
  status: WorkflowStepStatus;
  progress: number;
  verified?: boolean;
  detail?: LocalisedText;
}

const STEP_COPY: Record<WorkflowStepId, { title: LocalisedText; description: LocalisedText }> = {
  documents: {
    title: { en: "What we need", ta: "எங்களுக்கு என்ன தேவை", taEn: "Enna venum" },
    description: { en: "The documents your advisor asked for.", taEn: "Advisor ketta documents." },
  },
  upload: {
    title: { en: "Your documents", ta: "உங்கள் ஆவணங்கள்", taEn: "Ungaloda documents" },
    description: { en: "Upload each one — a clear photo is fine.", taEn: "Ovvonnaiyum upload pannunga — photo pothum." },
  },
  verification: {
    title: { en: "Checks", ta: "சரிபார்ப்பு", taEn: "Checks" },
    description: { en: "What we could confirm about each document.", taEn: "Document-a pathi enna confirm panna mudinjadhu." },
  },
  payment: {
    title: { en: "Payment", ta: "கட்டணம்", taEn: "Payment" },
    description: { en: "Pay only after you have seen the final price.", taEn: "Final price paathadhuku aprom dhaan payment." },
  },
  delivery: {
    title: { en: "Your policy", ta: "உங்கள் பாலிசி", taEn: "Ungaloda policy" },
    description: { en: "Issued and sent to you.", taEn: "Issue aagi ungalukku anuppa padum." },
  },
};

// ── Counting ─────────────────────────────────────────────────────────────────

/** A file has cleared the wire once it is being checked or is finished. */
const hasArrived = (upload: DocumentUpload): boolean =>
  upload.phase === "verifying" || upload.phase === "completed";

/** Share of *required* documents that have at least one file on the server, 0–100. */
export function receivedPercent(request: DocumentRequest | null, uploads: DocumentUpload[]): number {
  const required = request?.requirements.filter((r) => r.required) ?? [];
  if (required.length === 0) return request ? 100 : 0;

  const received = required.filter((r) =>
    uploads.some((u) => u.requirementId === r.id && hasArrived(u)),
  ).length;

  return Math.round((received / required.length) * 100);
}

export interface CheckTally {
  passed: number;
  failed: number;
  running: number;
  /** Skipped or never started — the checks with no service behind them. */
  notRun: number;
  total: number;
}

/**
 * Every verification check across every uploaded file.
 *
 * The `upload` stage is excluded: transferring a file is not a check, and
 * counting it would inflate the number of things that "passed".
 */
export function tallyChecks(uploads: DocumentUpload[]): CheckTally {
  const tally: CheckTally = { passed: 0, failed: 0, running: 0, notRun: 0, total: 0 };

  for (const upload of uploads) {
    for (const stage of upload.stages) {
      if (stage.id === "upload") continue;
      tally.total += 1;
      if (stage.status === "passed") tally.passed += 1;
      else if (stage.status === "failed") tally.failed += 1;
      else if (stage.status === "running") tally.running += 1;
      else tally.notRun += 1;
    }
  }

  return tally;
}

// ── Copy for the count lines ─────────────────────────────────────────────────

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function documentsDetail(request: DocumentRequest | null): LocalisedText | undefined {
  if (!request) return undefined;
  const n = request.requirements.length;
  return { en: `${plural(n, "document")} requested`, taEn: `${plural(n, "document")} kekkuranga` };
}

function uploadDetail(request: DocumentRequest | null, uploads: DocumentUpload[]): LocalisedText | undefined {
  const required = request?.requirements.filter((r) => r.required) ?? [];
  if (required.length === 0) return undefined;

  const received = required.filter((r) =>
    uploads.some((u) => u.requirementId === r.id && hasArrived(u)),
  ).length;

  return {
    en: `${received} of ${required.length} received`,
    taEn: `${required.length}-la ${received} vandhuruku`,
  };
}

/**
 * The verification line, which never hides what did not happen.
 *
 * Checks that never ran are reported as such instead of being folded into the
 * passed count — the customer is told the difference between "we confirmed it"
 * and "nothing confirmed it".
 */
function verificationDetail(tally: CheckTally): LocalisedText {
  if (tally.total === 0) {
    return { en: "No checks yet", taEn: "Innum check aagala" };
  }

  const fragments: [count: number, text: string][] = [];
  if (tally.passed > 0) fragments.push([tally.passed, "passed"]);
  if (tally.failed > 0) fragments.push([tally.failed, tally.failed === 1 ? "needs attention" : "need attention"]);
  if (tally.running > 0) fragments.push([tally.running, "running"]);
  if (tally.notRun > 0) fragments.push([tally.notRun, "not run"]);

  // Only the leading fragment names the noun, so the line reads as one sentence:
  // "1 check passed · 2 not run".
  const line = fragments
    .map(([n, text], i) => (i === 0 ? `${plural(n, "check")} ${text}` : `${n} ${text}`))
    .join(" · ");

  return { en: line, taEn: line };
}

// ── The workflow ─────────────────────────────────────────────────────────────

function ownedSteps(request: DocumentRequest | null, uploads: DocumentUpload[]): WorkflowStepView[] {
  const asked = (request?.requirements.length ?? 0) > 0;
  const received = receivedPercent(request, uploads);
  const tally = tallyChecks(uploads);

  const settled = tally.total === 0 ? 0 : tally.passed + tally.failed + tally.notRun;
  const checked = tally.total === 0 ? 0 : Math.round((settled / tally.total) * 100);

  return [
    {
      id: "documents",
      ...STEP_COPY.documents,
      status: "locked",
      progress: asked ? 100 : 0,
      verified: asked,
      detail: documentsDetail(request),
    },
    {
      id: "upload",
      ...STEP_COPY.upload,
      status: "locked",
      progress: asked ? received : 0,
      // A file either arrived or it didn't — that is observable, not a claim.
      verified: asked && received === 100,
      detail: uploadDetail(request, uploads),
    },
    {
      id: "verification",
      ...STEP_COPY.verification,
      status: "locked",
      progress: checked,
      // Something must have genuinely passed, and nothing may have failed.
      verified: tally.passed > 0 && tally.failed === 0,
      detail: verificationDetail(tally),
    },
  ];
}

/**
 * Walk the owned steps in order: everything before the first unfinished step is
 * done, that step is active, and the rest stay locked. A customer should never
 * see two "current" steps.
 */
function applyLockChain(steps: WorkflowStepView[]): WorkflowStepView[] {
  let reachedActive = false;

  return steps.map((step) => {
    if (reachedActive) return { ...step, status: "locked" as const };
    if (step.progress >= 100) return { ...step, status: "done" as const };
    reachedActive = true;
    return { ...step, status: "active" as const };
  });
}

export function buildWorkflowSteps({ request, uploads, extraSteps }: WorkflowInput): WorkflowStepView[] {
  const steps = applyLockChain(ownedSteps(request, uploads));

  for (const id of ["payment", "delivery"] as const) {
    const extra = extraSteps?.[id];
    if (!extra) continue;
    steps.push({
      id,
      ...STEP_COPY[id],
      status: extra.status,
      progress: extra.progress,
      verified: extra.verified ?? extra.progress >= 100,
      detail: extra.detail,
    });
  }

  return steps;
}

/** How far through the whole application the customer is, 0–100. */
export function overallProgress(steps: WorkflowStepView[]): number {
  if (steps.length === 0) return 0;
  const total = steps.reduce((sum, step) => sum + step.progress, 0);
  return Math.round(total / steps.length);
}

/** The step the customer should be looking at, if any is in play. */
export function activeStep(steps: WorkflowStepView[]): WorkflowStepView | undefined {
  return steps.find((step) => step.status === "active");
}
