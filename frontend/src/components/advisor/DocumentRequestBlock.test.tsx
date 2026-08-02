import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { buildWorkflowSteps } from "@/lib/documents/workflowSteps";
import { requirementFromKind } from "@/lib/documents/registry";
import type { DocumentRequest, DocumentUpload } from "@/types/documents";
import { DocumentRequestBlock } from "./DocumentRequestBlock";

afterEach(cleanup);

const request: DocumentRequest = {
  id: "r1",
  title: { en: "Documents needed" },
  note: { en: "A clear photo is fine." },
  requirements: [
    requirementFromKind("rc_book", { id: "rc_book-0" }),
    requirementFromKind("aadhaar", { id: "aadhaar-1" }),
  ],
  source: "ai-tag",
};

const upload = (over: Partial<DocumentUpload> & Pick<DocumentUpload, "requirementId">): DocumentUpload => ({
  id: `u-${over.requirementId}`,
  kind: "rc_book",
  file: { name: "rc.pdf", sizeBytes: 2048, mimeType: "application/pdf" },
  phase: "completed",
  progress: 100,
  stages: [],
  ...over,
});

const renderBlock = (uploads: DocumentUpload[] = [], adhocUploads: DocumentUpload[] = []) => {
  const onPick = vi.fn();
  const utils = render(
    <DocumentRequestBlock
      request={request}
      uploads={uploads}
      adhocUploads={adhocUploads}
      steps={buildWorkflowSteps({ request, uploads })}
      onPick={onPick}
      onDelete={vi.fn()}
      onRetry={vi.fn()}
    />,
  );
  return { ...utils, onPick };
};

describe("DocumentRequestBlock", () => {
  it("shows the agent's own title and note", () => {
    renderBlock();

    expect(screen.getByText("Documents needed")).toBeInTheDocument();
    expect(screen.getByText("A clear photo is fine.")).toBeInTheDocument();
  });

  it("puts an upload card inside the workflow for every document asked for", () => {
    renderBlock();

    expect(screen.getByRole("button", { name: /upload rc book/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload aadhaar/i })).toBeInTheDocument();
  });

  it("hands the chosen requirement back when a card is used", () => {
    const { onPick } = renderBlock();

    fireEvent.click(screen.getByRole("button", { name: /upload rc book/i }));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kind: "rc_book" }));
  });

  it("reports progress across the required documents", () => {
    renderBlock([upload({ requirementId: "rc_book-0" })]);

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 received")).toBeInTheDocument();
  });

  it("keeps paperclip files in their own list rather than ticking a requirement", () => {
    renderBlock([], [upload({ requirementId: "__adhoc", id: "adhoc-1" })]);

    expect(screen.getByRole("region", { name: /also attached/i })).toBeInTheDocument();
    expect(screen.getByText("0 of 2 received")).toBeInTheDocument();
  });

  it("says nothing about verification it cannot back up", () => {
    renderBlock([
      upload({
        requirementId: "rc_book-0",
        stages: [
          { id: "upload", status: "passed" },
          { id: "ocr", status: "skipped" },
        ],
      }),
    ]);

    // Both the step summary and the document card say it — neither hides it.
    expect(screen.getAllByText("1 check not run").length).toBeGreaterThan(0);
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });
});
