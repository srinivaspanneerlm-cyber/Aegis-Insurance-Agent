import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { VerificationStatus } from "./VerificationStatus";
import { UploadProgress } from "./UploadProgress";

afterEach(cleanup);

describe("VerificationStatus", () => {
  it("renders nothing when there are no stages", () => {
    const { container } = render(<VerificationStatus stages={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("announces stage changes to assistive tech", () => {
    render(<VerificationStatus stages={[{ id: "ocr", status: "running" }]} />);
    expect(screen.getByRole("list")).toHaveAttribute("aria-live", "polite");
  });

  it("describes each stage by what it has actually done", () => {
    render(<VerificationStatus stages={[
      { id: "upload", status: "passed" },
      { id: "ocr", status: "running" },
      { id: "gps", status: "pending" },
      { id: "fraud", status: "skipped" },
      { id: "metadata", status: "failed" },
    ]} />);

    expect(screen.getByText(/^Uploaded$/)).toBeInTheDocument();
    expect(screen.getByText("Reading the document")).toBeInTheDocument();
    expect(screen.getByText(/Location Verified — waiting/)).toBeInTheDocument();
    expect(screen.getByText(/Fraud Check Passed — not checked/)).toBeInTheDocument();
    expect(screen.getByText(/Screening for fraud|Checking metadata — failed/)).toBeInTheDocument();
  });

  it("appends the stage's own detail line", () => {
    render(<VerificationStatus stages={[{ id: "ocr", status: "passed", detail: "3 fields extracted" }]} />);
    expect(screen.getByText(/3 fields extracted/)).toBeInTheDocument();
  });

  it("uses the requested language", () => {
    render(<VerificationStatus stages={[{ id: "upload", status: "passed" }]} locale="ta" />);
    expect(screen.getByText("பதிவேற்றப்பட்டது")).toBeInTheDocument();
  });
});

describe("UploadProgress", () => {
  it("exposes the percentage as a progressbar", () => {
    render(<UploadProgress value={42} label="Uploading rc.pdf" />);
    const bar = screen.getByRole("progressbar", { name: "Uploading rc.pdf" });

    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps a value outside the range", () => {
    const { rerender } = render(<UploadProgress value={-10} label="x" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    rerender(<UploadProgress value={140} label="x" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows the caption alongside the label", () => {
    render(<UploadProgress value={60} label="Verifying rc.pdf" caption="60%" />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Verifying rc.pdf")).toBeInTheDocument();
  });
});
