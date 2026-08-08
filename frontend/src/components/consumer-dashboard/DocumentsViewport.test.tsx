/**
 * The document list.
 *
 * Two properties matter. It shows the customer's real documents — it used to
 * seed three invented files, a policy certificate, an Aadhaar KYC and a premium
 * receipt, presented as though they had been uploaded. And it shows where each
 * one has reached: a filename and a date tell somebody nothing about whether
 * their claim is blocked, which is the only reason most people open this
 * screen.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentsViewport } from "./DocumentsViewport";
import type { DashboardDoc } from "./types";

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark" }) }));

const doc = (over: Partial<DashboardDoc> = {}): DashboardDoc => ({
  id: "d1",
  name: "rc-book.pdf",
  size: "1.2 MB",
  type: "rc_book",
  date: "7 Aug 2026",
  ...over,
});

const props = {
  uploadingDoc: false,
  uploadSuccess: false,
  handleFileUpload: vi.fn(),
};

describe("DocumentsViewport", () => {
  it("says where a document has reached, in words", () => {
    render(<DocumentsViewport uploadedFiles={[doc({ status: "PENDING_REVIEW" })]} {...props} />);
    expect(screen.getByText(/waiting for a person/i)).toBeInTheDocument();
    // Not the raw enum.
    expect(screen.queryByText("PENDING_REVIEW")).not.toBeInTheDocument();
  });

  it("shows a rejection reason, because that is what says what to do next", () => {
    render(
      <DocumentsViewport
        uploadedFiles={[
          doc({
            status: "REJECTED",
            rejectionReason: "The registration number is not legible — please re-photograph it.",
          }),
        ]}
        {...props}
      />
    );
    expect(screen.getByText(/not accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/not legible/i)).toBeInTheDocument();
  });

  it("renders an accepted document without a reason", () => {
    render(
      <DocumentsViewport uploadedFiles={[doc({ status: "VERIFIED", rejectionReason: null })]} {...props} />
    );
    expect(screen.getByText(/accepted/i)).toBeInTheDocument();
  });

  it("shows nothing rather than invented files when there are none", () => {
    render(<DocumentsViewport uploadedFiles={[]} {...props} />);
    expect(screen.queryByText(/Aadhaar_KYC/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Premium_Receipt/i)).not.toBeInTheDocument();
  });
});
