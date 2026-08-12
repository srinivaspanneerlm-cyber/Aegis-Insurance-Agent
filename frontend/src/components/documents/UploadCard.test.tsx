import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { requirementFromKind } from "@/lib/documents/registry";
import type { DocumentUpload } from "@/types/documents";
import { UploadCard } from "./UploadCard";

afterEach(cleanup);

const rcBook = requirementFromKind("rc_book", { id: "rc_book-0" });
const photos = requirementFromKind("vehicle_photos", { id: "vehicle_photos-1" });

const upload = (over: Partial<DocumentUpload> = {}): DocumentUpload => ({
  id: "u1",
  requirementId: "rc_book-0",
  kind: "rc_book",
  file: { name: "rc.pdf", sizeBytes: 1024, mimeType: "application/pdf" },
  phase: "completed",
  progress: 100,
  stages: [{ id: "upload", status: "passed" }],
  ...over,
});

describe("UploadCard", () => {
  it("presents the document, its hint and what it accepts", () => {
    render(<UploadCard requirement={rcBook} onPick={vi.fn()} />);

    expect(screen.getByText("RC Book")).toBeInTheDocument();
    // The hint now carries the rule that actually gets applications rejected:
    // an RC in somebody else's name needs that owner's signed permission.
    expect(screen.getByText(/in your own name/i)).toBeInTheDocument();
    expect(screen.getByText(/up to 10 MB/)).toBeInTheDocument();
  });

  it("starts Pending and asks for the upload by name", () => {
    render(<UploadCard requirement={rcBook} onPick={vi.fn()} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Upload RC Book$/i })).toBeInTheDocument();
  });

  it("hands the requirement back when the customer picks a file", () => {
    const onPick = vi.fn();
    render(<UploadCard requirement={rcBook} onPick={onPick} />);

    fireEvent.click(screen.getByRole("button", { name: /^Upload RC Book$/i }));
    expect(onPick).toHaveBeenCalledWith(rcBook);
  });

  it("reports Received once the file has settled", () => {
    render(<UploadCard requirement={rcBook} uploads={[upload()]} onPick={vi.fn()} />);
    expect(screen.getByText("Received")).toBeInTheDocument();
  });

  it("reports progress while a file is still moving", () => {
    render(<UploadCard requirement={rcBook} uploads={[upload({ phase: "verifying" })]} onPick={vi.fn()} />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders a card for every attached file", () => {
    render(
      <UploadCard
        requirement={photos}
        uploads={[
          upload({ id: "a", requirementId: photos.id, kind: "vehicle_photos", file: { name: "front.jpg", sizeBytes: 1, mimeType: "image/jpeg" } }),
          upload({ id: "b", requirementId: photos.id, kind: "vehicle_photos", file: { name: "rear.jpg", sizeBytes: 1, mimeType: "image/jpeg" } }),
        ]}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByText("front.jpg")).toBeInTheDocument();
    expect(screen.getByText("rear.jpg")).toBeInTheDocument();
  });

  it("keeps offering more files for a multi-file document", () => {
    render(<UploadCard requirement={photos} uploads={[upload({ requirementId: photos.id })]} onPick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add another file for vehicle photos/i })).toBeInTheDocument();
  });

  it("stops offering more once a single-file document is satisfied", () => {
    render(<UploadCard requirement={rcBook} uploads={[upload()]} onPick={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /upload rc book/i })).not.toBeInTheDocument();
  });

  it("marks an optional document as optional", () => {
    render(<UploadCard requirement={{ ...rcBook, required: false }} onPick={vi.fn()} />);
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("blocks the picker while the card is disabled", () => {
    render(<UploadCard requirement={rcBook} onPick={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: /^Upload RC Book$/i })).toBeDisabled();
  });

  it("renders the Tamil label when asked for it", () => {
    render(<UploadCard requirement={rcBook} onPick={vi.fn()} locale="ta" />);
    expect(screen.getByText("ஆர்.சி. புத்தகம்")).toBeInTheDocument();
  });
});
