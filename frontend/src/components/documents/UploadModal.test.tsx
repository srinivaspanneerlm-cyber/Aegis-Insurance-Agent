import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { requirementFromKind } from "@/lib/documents/registry";
import { UploadModal } from "./UploadModal";

afterEach(cleanup);

const rcBook = requirementFromKind("rc_book", { id: "rc_book-0" }); // PDF/DOCX/images, 10 MB, single
const photos = requirementFromKind("vehicle_photos", { id: "vehicle_photos-1" }); // media, 50 MB, multiple

const makeFile = (name: string, type: string, size: number) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const pdf = () => makeFile("rc.pdf", "application/pdf", 1024 * 1024);
const jpg = (name = "front.jpg") => makeFile(name, "image/jpeg", 2 * 1024 * 1024);

/** Drive the hidden picker the way a browser would. */
const pick = (files: File[]) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
};

describe("UploadModal", () => {
  it("renders nothing while closed", () => {
    const { container } = render(
      <UploadModal open={false} requirement={rcBook} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("is a labelled modal dialog", () => {
    render(<UploadModal open requirement={rcBook} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "RC Book" })).toBeInTheDocument();
  });

  it("states the accepted formats and the size limit up front", () => {
    render(<UploadModal open requirement={rcBook} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/up to 10 MB/)).toBeInTheDocument();
    expect(screen.getByText(/max 10 MB/)).toBeInTheDocument();
  });

  it("configures the native picker from the requirement", () => {
    render(<UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    expect(input.multiple).toBe(true);
    expect(input.accept).toContain("image/jpeg");
    expect(input.accept).toContain(".heic");
  });

  it("stages a picked file and confirms it upward", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<UploadModal open requirement={rcBook} onClose={onClose} onConfirm={onConfirm} />);

    pick([pdf()]);
    expect(screen.getByText("rc.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ name: "rc.pdf" })]);
    expect(onClose).toHaveBeenCalled();
  });

  it("accepts files dropped onto the zone", () => {
    const onConfirm = vi.fn();
    render(<UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={onConfirm} />);

    const zone = screen.getByTestId("dropzone");
    fireEvent.dragEnter(zone);
    expect(screen.getByText("Drop to attach")).toBeInTheDocument();

    fireEvent.drop(zone, { dataTransfer: { files: [jpg("front.jpg"), jpg("rear.jpg")] } });

    expect(screen.getByText("front.jpg")).toBeInTheDocument();
    expect(screen.getByText("rear.jpg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload 2 files/i })).toBeInTheDocument();
  });

  it("clears the drag highlight when the file leaves again", () => {
    render(<UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const zone = screen.getByTestId("dropzone");

    fireEvent.dragEnter(zone);
    fireEvent.dragLeave(zone);
    expect(screen.getByText("Drag your file here")).toBeInTheDocument();
  });

  it("explains why a file was turned away and refuses to upload it", () => {
    const onConfirm = vi.fn();
    render(<UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={onConfirm} />);

    pick([pdf()]); // paperwork into a photo-only requirement

    expect(screen.getByText(/not a supported format/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^upload$/i })).toBeDisabled();
  });

  it("uploads the good files and leaves the rejected one behind", () => {
    const onConfirm = vi.fn();
    render(<UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={onConfirm} />);

    pick([jpg("good.jpg"), makeFile("huge.mp4", "video/mp4", 60 * 1024 * 1024)]);
    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ name: "good.jpg" })]);
  });

  it("keeps only the newest file for a single-file requirement", () => {
    render(<UploadModal open requirement={rcBook} onClose={vi.fn()} onConfirm={vi.fn()} />);

    pick([pdf()]);
    pick([makeFile("rc-v2.pdf", "application/pdf", 2048)]);

    expect(screen.queryByText("rc.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("rc-v2.pdf")).toBeInTheDocument();
  });

  it("does not stage the same file twice", () => {
    render(<UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={vi.fn()} />);

    const file = jpg("front.jpg");
    pick([file]);
    pick([file]);

    expect(screen.getAllByText("front.jpg")).toHaveLength(1);
  });

  it("lets a staged file be removed again", () => {
    render(<UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={vi.fn()} />);
    pick([jpg("front.jpg")]);

    fireEvent.click(screen.getByRole("button", { name: /remove front\.jpg/i }));
    expect(screen.queryByText("front.jpg")).not.toBeInTheDocument();
  });

  it("closes on Escape, on Cancel and on a backdrop click", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <UploadModal open requirement={rcBook} onClose={onClose} onConfirm={vi.fn()} />,
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<UploadModal open requirement={rcBook} onClose={onClose} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("takes an ad-hoc picker configuration from the attachment menu", () => {
    render(
      <UploadModal
        open
        accept={["video/mp4"]}
        maxBytes={50 * 1024 * 1024}
        multiple
        capture="environment"
        title="Camera"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Camera" })).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.getAttribute("capture")).toBe("environment");
  });

  it("forgets the previous attempt when it is reopened", () => {
    const { rerender } = render(
      <UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    pick([jpg("front.jpg")]);
    expect(screen.getByText("front.jpg")).toBeInTheDocument();

    rerender(<UploadModal open={false} requirement={photos} onClose={vi.fn()} onConfirm={vi.fn()} />);
    rerender(<UploadModal open requirement={photos} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.queryByText("front.jpg")).not.toBeInTheDocument();
  });
});
