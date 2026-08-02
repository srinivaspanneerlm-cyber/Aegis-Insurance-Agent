import { describe, it, expect } from "vitest";
import type {
  DocumentRequest,
  DocumentRequirement,
  DocumentUpload,
  VerificationStage,
} from "@/types/documents";
import {
  activeStep,
  buildWorkflowSteps,
  overallProgress,
  receivedPercent,
  tallyChecks,
} from "./workflowSteps";

const requirement = (
  over: Partial<DocumentRequirement> & Pick<DocumentRequirement, "id">,
): DocumentRequirement => ({
  kind: "rc_book",
  label: { en: "RC Book" },
  icon: "📄",
  accept: ["application/pdf"],
  maxBytes: 10 * 1024 * 1024,
  multiple: false,
  required: true,
  stages: ["upload", "ocr"],
  ...over,
});

const request = (requirements: DocumentRequirement[]): DocumentRequest => ({
  id: "req-1",
  title: { en: "Motor documents" },
  requirements,
  source: "ai-tag",
});

const stage = (
  over: Partial<VerificationStage> & Pick<VerificationStage, "id" | "status">,
): VerificationStage => over;

const upload = (over: Partial<DocumentUpload> & Pick<DocumentUpload, "requirementId">): DocumentUpload => ({
  id: `u-${over.requirementId}`,
  kind: "rc_book",
  file: { name: "rc.pdf", sizeBytes: 1024, mimeType: "application/pdf" },
  phase: "completed",
  progress: 100,
  stages: [],
  ...over,
});

describe("receivedPercent", () => {
  it("is zero before an agent has asked for anything", () => {
    expect(receivedPercent(null, [])).toBe(0);
  });

  it("counts only required documents", () => {
    const req = request([requirement({ id: "a" }), requirement({ id: "b", required: false })]);
    expect(receivedPercent(req, [upload({ requirementId: "a" })])).toBe(100);
  });

  it("counts a file as received once it is off the wire", () => {
    const req = request([requirement({ id: "a" }), requirement({ id: "b" })]);

    expect(receivedPercent(req, [upload({ requirementId: "a", phase: "uploading" })])).toBe(0);
    expect(receivedPercent(req, [upload({ requirementId: "a", phase: "verifying" })])).toBe(50);
  });

  it("does not count a failed upload as received", () => {
    const req = request([requirement({ id: "a" })]);
    expect(receivedPercent(req, [upload({ requirementId: "a", phase: "failed" })])).toBe(0);
  });

  it("treats an ask with no required documents as satisfied", () => {
    const req = request([requirement({ id: "a", required: false })]);
    expect(receivedPercent(req, [])).toBe(100);
  });
});

describe("tallyChecks", () => {
  it("ignores the transfer — uploading a file is not a check", () => {
    const tally = tallyChecks([
      upload({ requirementId: "a", stages: [stage({ id: "upload", status: "passed" })] }),
    ]);
    expect(tally).toEqual({ passed: 0, failed: 0, running: 0, notRun: 0, total: 0 });
  });

  it("separates checks that passed from checks that never ran", () => {
    const tally = tallyChecks([
      upload({
        requirementId: "a",
        stages: [
          stage({ id: "upload", status: "passed" }),
          stage({ id: "ocr", status: "passed" }),
          stage({ id: "gps", status: "skipped" }),
          stage({ id: "fraud", status: "pending" }),
          stage({ id: "metadata", status: "failed" }),
          stage({ id: "blockchain", status: "running" }),
        ],
      }),
    ]);

    expect(tally).toEqual({ passed: 1, failed: 1, running: 1, notRun: 2, total: 5 });
  });

  it("adds up across every uploaded file", () => {
    const tally = tallyChecks([
      upload({ requirementId: "a", stages: [stage({ id: "ocr", status: "passed" })] }),
      upload({ requirementId: "b", stages: [stage({ id: "ocr", status: "passed" })] }),
    ]);
    expect(tally.passed).toBe(2);
  });
});

describe("buildWorkflowSteps", () => {
  it("owns exactly the three document steps by default", () => {
    const steps = buildWorkflowSteps({ request: null, uploads: [] });
    expect(steps.map((s) => s.id)).toEqual(["documents", "upload", "verification"]);
  });

  it("puts the customer on the first step before anything is asked", () => {
    const steps = buildWorkflowSteps({ request: null, uploads: [] });

    expect(steps[0].status).toBe("active");
    expect(steps[1].status).toBe("locked");
    expect(steps[2].status).toBe("locked");
  });

  it("marks the ask done and moves on once an agent has requested documents", () => {
    const steps = buildWorkflowSteps({ request: request([requirement({ id: "a" })]), uploads: [] });

    expect(steps[0]).toMatchObject({ status: "done", progress: 100, verified: true });
    expect(steps[1].status).toBe("active");
  });

  it("never shows two current steps", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" }), requirement({ id: "b" })]),
      uploads: [upload({ requirementId: "a" })],
    });

    expect(steps.filter((s) => s.status === "active")).toHaveLength(1);
  });

  it("reports how many of the required documents arrived", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" }), requirement({ id: "b" })]),
      uploads: [upload({ requirementId: "a" })],
    });

    expect(steps[1].progress).toBe(50);
    expect(steps[1].detail?.en).toBe("1 of 2 received");
    expect(steps[1].verified).toBe(false);
  });

  it("verifies the upload step only when every required document is in", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" })]),
      uploads: [upload({ requirementId: "a" })],
    });

    expect(steps[1]).toMatchObject({ status: "done", verified: true });
  });

  // ── The honesty rule ───────────────────────────────────────────────────────

  it("refuses to verify a finished step whose checks never ran", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" })]),
      uploads: [
        upload({
          requirementId: "a",
          stages: [stage({ id: "upload", status: "passed" }), stage({ id: "ocr", status: "skipped" })],
        }),
      ],
    });

    const verification = steps[2];
    expect(verification.progress).toBe(100);
    expect(verification.status).toBe("done");
    expect(verification.verified).toBe(false);
    expect(verification.detail?.en).toBe("1 check not run");
  });

  it("says plainly when nothing has been checked at all", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" })]),
      uploads: [upload({ requirementId: "a" })],
    });
    expect(steps[2].detail?.en).toBe("No checks yet");
  });

  it("verifies the checks step when a real check passed and none failed", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" })]),
      uploads: [upload({ requirementId: "a", stages: [stage({ id: "ocr", status: "passed" })] })],
    });

    expect(steps[2]).toMatchObject({ verified: true, detail: { en: "1 check passed" } });
  });

  it("withholds verification while any check has failed", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" })]),
      uploads: [
        upload({
          requirementId: "a",
          stages: [stage({ id: "ocr", status: "passed" }), stage({ id: "fraud", status: "failed" })],
        }),
      ],
    });

    expect(steps[2].verified).toBe(false);
    expect(steps[2].detail?.en).toBe("1 check passed · 1 needs attention");
  });

  it("surfaces skipped checks alongside the ones that passed", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" })]),
      uploads: [
        upload({
          requirementId: "a",
          stages: [
            stage({ id: "ocr", status: "passed" }),
            stage({ id: "gps", status: "skipped" }),
            stage({ id: "fraud", status: "skipped" }),
          ],
        }),
      ],
    });

    expect(steps[2].detail?.en).toBe("1 check passed · 2 not run");
  });

  // ── Borrowed steps ─────────────────────────────────────────────────────────

  it("appends only the extra steps the purchase flow supplies", () => {
    const steps = buildWorkflowSteps({
      request: null,
      uploads: [],
      extraSteps: { payment: { status: "locked", progress: 0 } },
    });

    expect(steps.map((s) => s.id)).toEqual(["documents", "upload", "verification", "payment"]);
  });

  it("takes the caller's word for a borrowed step's status", () => {
    const steps = buildWorkflowSteps({
      request: null,
      uploads: [],
      extraSteps: { delivery: { status: "done", progress: 100, detail: { en: "Emailed to you" } } },
    });

    expect(steps[3]).toMatchObject({ id: "delivery", status: "done", verified: true });
    expect(steps[3].detail?.en).toBe("Emailed to you");
  });
});

describe("overallProgress", () => {
  it("is zero for an empty workflow", () => {
    expect(overallProgress([])).toBe(0);
  });

  it("averages the steps in play", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" }), requirement({ id: "b" })]),
      uploads: [upload({ requirementId: "a" })],
    });
    // documents 100, upload 50, verification 0
    expect(overallProgress(steps)).toBe(50);
  });
});

describe("activeStep", () => {
  it("returns the one step in play", () => {
    const steps = buildWorkflowSteps({ request: request([requirement({ id: "a" })]), uploads: [] });
    expect(activeStep(steps)?.id).toBe("upload");
  });

  it("returns nothing once every step is finished", () => {
    const steps = buildWorkflowSteps({
      request: request([requirement({ id: "a" })]),
      uploads: [upload({ requirementId: "a", stages: [stage({ id: "ocr", status: "passed" })] })],
    });
    expect(activeStep(steps)).toBeUndefined();
  });
});
