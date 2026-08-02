import { describe, it, expect } from "vitest";
import type { DocumentUpload, VerificationStage } from "@/types/documents";
import {
  completionPercent,
  isSimulated,
  passedBadges,
  phaseMeta,
  pipelineProgress,
  requirementState,
  unverifiedCount,
} from "./statusMeta";

const stage = (over: Partial<VerificationStage> & Pick<VerificationStage, "id" | "status">): VerificationStage => over;

const upload = (over: Partial<DocumentUpload> = {}): DocumentUpload => ({
  id: "u1",
  requirementId: "rc_book-0",
  kind: "rc_book",
  file: { name: "rc.pdf", sizeBytes: 1024, mimeType: "application/pdf" },
  phase: "completed",
  progress: 100,
  stages: [],
  ...over,
});

describe("pipelineProgress", () => {
  it("is zero for a document with no stages", () => {
    expect(pipelineProgress([])).toBe(0);
  });

  it("counts each settled stage as an equal share", () => {
    expect(pipelineProgress([
      stage({ id: "upload", status: "passed" }),
      stage({ id: "ocr", status: "pending" }),
    ])).toBe(50);
  });

  it("counts a running stage's own partial progress", () => {
    expect(pipelineProgress([
      stage({ id: "upload", status: "running", progress: 50 }),
      stage({ id: "ocr", status: "pending" }),
    ])).toBe(25);
  });

  it("treats a settled stage as finished whatever the outcome", () => {
    // A failed check is still a completed one; the status text says why it stopped.
    expect(pipelineProgress([
      stage({ id: "upload", status: "passed" }),
      stage({ id: "ocr", status: "failed" }),
      stage({ id: "fraud", status: "skipped" }),
    ])).toBe(100);
  });
});

describe("passedBadges", () => {
  it("only awards a badge to a check that actually passed", () => {
    const badges = passedBadges([
      stage({ id: "upload", status: "passed" }),
      stage({ id: "ocr", status: "skipped" }),
      stage({ id: "fraud", status: "failed" }),
      stage({ id: "metadata", status: "pending" }),
    ]);

    expect(badges.map((b) => b.id)).toEqual(["upload"]);
    expect(badges[0].label.en).toBe("Uploaded");
  });

  it("names each stage the way the customer sees it", () => {
    const badges = passedBadges([
      stage({ id: "ocr", status: "passed" }),
      stage({ id: "fraud", status: "passed" }),
    ]);
    expect(badges.map((b) => b.label.en)).toEqual(["OCR Verified", "Fraud Check Passed"]);
  });
});

describe("unverifiedCount", () => {
  it("counts the checks that never ran", () => {
    expect(unverifiedCount([
      stage({ id: "upload", status: "passed" }),
      stage({ id: "ocr", status: "skipped" }),
      stage({ id: "fraud", status: "pending" }),
    ])).toBe(2);
  });
});

describe("isSimulated", () => {
  it("is true only when the pipeline flagged the result as simulated", () => {
    expect(isSimulated(upload())).toBe(false);
    expect(isSimulated(upload({ intelligence: { fields: {}, confidence: 1, flags: ["Simulated"] } }))).toBe(true);
    expect(isSimulated(upload({ intelligence: { fields: {}, confidence: 1, flags: ["Low resolution"] } }))).toBe(false);
  });
});

describe("phaseMeta", () => {
  it("reports the in-flight phases", () => {
    expect(phaseMeta(upload({ phase: "uploading" })).tone).toBe("info");
    expect(phaseMeta(upload({ phase: "queued" })).tone).toBe("neutral");
  });

  it("says Verified only when something beyond the upload passed", () => {
    const verified = upload({
      stages: [stage({ id: "upload", status: "passed" }), stage({ id: "ocr", status: "passed" })],
    });
    expect(phaseMeta(verified).label.en).toBe("Verified");
    expect(phaseMeta(verified).tone).toBe("success");
  });

  it("says only Uploaded when every real check was skipped", () => {
    // No verification service is connected — the card must not imply otherwise.
    const stored = upload({
      stages: [stage({ id: "upload", status: "passed" }), stage({ id: "ocr", status: "skipped" })],
    });
    expect(phaseMeta(stored).label.en).toBe("Uploaded");
    expect(phaseMeta(stored).tone).toBe("neutral");
  });

  it("surfaces a failed check even on a completed upload", () => {
    const bad = upload({
      stages: [stage({ id: "upload", status: "passed" }), stage({ id: "fraud", status: "failed" })],
    });
    expect(phaseMeta(bad).tone).toBe("danger");
  });
});

describe("requirementState", () => {
  it("is pending with nothing attached", () => {
    expect(requirementState([])).toBe("pending");
  });

  it("is active while any file is still moving", () => {
    expect(requirementState([upload(), upload({ id: "u2", phase: "verifying" })])).toBe("active");
  });

  it("is complete once every file has settled successfully", () => {
    expect(requirementState([upload(), upload({ id: "u2" })])).toBe("complete");
  });

  it("is failed only when every attempt failed", () => {
    expect(requirementState([upload({ phase: "failed" })])).toBe("failed");
    // One good file is enough to satisfy the requirement.
    expect(requirementState([upload({ phase: "failed" }), upload({ id: "u2" })])).toBe("complete");
  });
});

describe("completionPercent", () => {
  const reqs = [
    { id: "a", required: true },
    { id: "b", required: true },
    { id: "c", required: false },
  ];

  it("is zero before anything is attached", () => {
    expect(completionPercent(reqs, [])).toBe(0);
  });

  it("counts only the required documents", () => {
    expect(completionPercent(reqs, [upload({ requirementId: "a" })])).toBe(50);
    expect(completionPercent(reqs, [
      upload({ requirementId: "a" }),
      upload({ id: "u2", requirementId: "b" }),
    ])).toBe(100);
  });

  it("ignores an optional document that was never supplied", () => {
    expect(completionPercent(reqs, [
      upload({ requirementId: "a" }),
      upload({ id: "u2", requirementId: "b" }),
      upload({ id: "u3", requirementId: "c" }),
    ])).toBe(100);
  });

  it("is complete when nothing is required", () => {
    expect(completionPercent([{ id: "c", required: false }], [])).toBe(100);
  });
});
