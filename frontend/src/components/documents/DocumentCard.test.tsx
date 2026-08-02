import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { DocumentUpload } from "@/types/documents";
import { DocumentCard } from "./DocumentCard";

afterEach(cleanup);

const upload = (over: Partial<DocumentUpload> = {}): DocumentUpload => ({
  id: "u1",
  requirementId: "rc_book-0",
  kind: "rc_book",
  file: { name: "rc-book.pdf", sizeBytes: 2 * 1024 * 1024, mimeType: "application/pdf" },
  phase: "completed",
  progress: 100,
  stages: [
    { id: "upload", status: "passed" },
    { id: "ocr", status: "passed", detail: "3 fields extracted" },
  ],
  uploadedAt: "10:42",
  ...over,
});

describe("DocumentCard", () => {
  it("names the file, its size and when it arrived", () => {
    render(<DocumentCard upload={upload()} />);
    expect(screen.getByText("rc-book.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 MB · 10:42/)).toBeInTheDocument();
  });

  it("shows a badge for each check that passed", () => {
    render(<DocumentCard upload={upload()} />);
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
    expect(screen.getByText("OCR Verified")).toBeInTheDocument();
  });

  it("counts the checks that never ran instead of hiding them", () => {
    render(<DocumentCard upload={upload({
      stages: [
        { id: "upload", status: "passed" },
        { id: "ocr", status: "skipped" },
        { id: "fraud", status: "skipped" },
      ],
    })} />);

    expect(screen.getByText("2 checks not run")).toBeInTheDocument();
    expect(screen.queryByText("OCR Verified")).not.toBeInTheDocument();
  });

  it("labels a simulated result as simulated", () => {
    render(<DocumentCard upload={upload({
      intelligence: { fields: {}, confidence: 0.9, flags: ["Simulated"] },
    })} />);
    expect(screen.getByText("Simulated")).toBeInTheDocument();
  });

  it("shows a live progress bar while the file is uploading", () => {
    render(<DocumentCard upload={upload({ phase: "uploading", progress: 40 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
  });

  it("surfaces the error on a failed upload", () => {
    render(<DocumentCard upload={upload({ phase: "failed", error: "The scan was unreadable." })} />);
    expect(screen.getByText("The scan was unreadable.")).toBeInTheDocument();
  });

  it("expands to reveal the pipeline and the extracted fields", () => {
    render(<DocumentCard upload={upload({
      intelligence: { fields: { "Vehicle Number": "TN 09 AB 1234" }, confidence: 0.94, flags: [] },
    })} />);

    const toggle = screen.getByRole("button", { name: /expand rc-book\.pdf/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Vehicle Number")).toBeInTheDocument();
    expect(screen.getByText("TN 09 AB 1234")).toBeInTheDocument();
  });

  it("only offers the actions it was given a handler for", () => {
    const onDelete = vi.fn();
    render(<DocumentCard upload={upload()} defaultExpanded onDelete={onDelete} />);

    expect(screen.queryByText("Download")).not.toBeInTheDocument();
    expect(screen.queryByText("View")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
  });

  it("offers Retry only on a failed upload", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DocumentCard upload={upload()} defaultExpanded onRetry={onRetry} />,
    );
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();

    rerender(<DocumentCard upload={upload({ phase: "failed" })} defaultExpanded onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders non-simulated flags as warnings in the detail panel", () => {
    render(<DocumentCard upload={upload({
      intelligence: { fields: {}, confidence: 0.4, flags: ["Low-resolution scan"] },
    })} defaultExpanded />);
    expect(screen.getByText(/Low-resolution scan/)).toBeInTheDocument();
  });
});
