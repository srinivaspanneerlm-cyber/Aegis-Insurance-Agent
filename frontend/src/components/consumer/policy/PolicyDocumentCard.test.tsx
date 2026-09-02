/**
 * The certificate upload.
 *
 * What is asserted here is mostly what does *not* happen: a file the API would
 * refuse is never sent, a rejection never loses the customer their place, and
 * the control never reads as a requirement. The upload itself is one line; the
 * behaviour around it is the part that decides whether somebody on a phone with
 * a poor connection finishes the flow.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PolicyDocumentCard } from "./PolicyDocumentCard";

const uploadPolicyDocument = vi.fn();

vi.mock("@/services/api", () => ({
  consumerService: {
    uploadPolicyDocument: (...args: unknown[]) => uploadPolicyDocument(...args),
    documentFileUrl: (id: string) => `/api/v1/consumer/documents/${id}/file`,
  },
}));

const fileOf = (name: string, type: string, bytes = 1024): File => {
  const file = new File(["x"], name, { type });
  // jsdom's File has no real content; the validator only reads `size`.
  Object.defineProperty(file, "size", { value: bytes });
  return file;
};

const input = () => document.querySelector('input[name="certificate"]') as HTMLInputElement;
const choose = (file: File) => fireEvent.change(input(), { target: { files: [file] } });

const attached = {
  id: "doc-1",
  filename: "My Certificate.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1.5 * 1024 * 1024,
  uploadedAt: "2026-09-01T00:00:00.000Z",
  policyId: "pol-1",
  fingerprint: "a1b2c3d4",
};

beforeEach(() => {
  vi.clearAllMocks();
  uploadPolicyDocument.mockResolvedValue({ policy: { id: "pol-1" }, disclaimer: "" });
});

describe("before anything is attached", () => {
  it("says the certificate is optional, and what is accepted", () => {
    // A customer with no scanner and a cracked camera is exactly who this was
    // built for. An upload box that reads as a requirement turns them away.
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);

    expect(screen.getByText(/Optional/)).toBeInTheDocument();
    expect(screen.getByText(/PDF, JPG or PNG/)).toBeInTheDocument();
    expect(screen.getByText(/up to 10 MB/)).toBeInTheDocument();
  });

  it("says only the customer can see it", () => {
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);
    expect(screen.getByText(/Only you can see it/)).toBeInTheDocument();
  });

  it("offers the accepted types to the file picker, extensions included", () => {
    // A browser that cannot type-sniff still matches on the extension.
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);
    const accept = input().getAttribute("accept") ?? "";
    for (const token of ["application/pdf", "image/jpeg", "image/png", ".pdf", ".jpg", ".png"]) {
      expect(accept, token).toContain(token);
    }
    expect(accept).not.toContain("video");
  });
});

describe("choosing a file", () => {
  it("uploads an accepted one and hands back what the API returned", async () => {
    const onUploaded = vi.fn();
    render(<PolicyDocumentCard policyId="pol-1" locale="en" onUploaded={onUploaded} />);

    choose(fileOf("cert.pdf", "application/pdf"));

    await waitFor(() => expect(uploadPolicyDocument).toHaveBeenCalledTimes(1));
    expect(uploadPolicyDocument.mock.calls[0][0]).toBe("pol-1");
    expect(uploadPolicyDocument.mock.calls[0][2]).toBe("en");
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ policy: { id: "pol-1" }, disclaimer: "" }));
  });

  it("never sends one the API would refuse", async () => {
    // Not a security boundary — the API checks the bytes — but a customer on a
    // slow connection should not wait to be told something knowable at once.
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);

    choose(fileOf("walkaround.mp4", "video/mp4"));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(uploadPolicyDocument).not.toHaveBeenCalled();
  });

  it("never sends one that is too large", async () => {
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);

    choose(fileOf("huge.pdf", "application/pdf", 11 * 1024 * 1024));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/10 MB/));
    expect(uploadPolicyDocument).not.toHaveBeenCalled();
  });

  it("shows the API's own sentence when it refuses one", async () => {
    // The API says what to send instead. A generic "upload failed" cannot.
    uploadPolicyDocument.mockRejectedValue({
      response: { data: { message: "Please send your certificate as PDF, JPG or PNG." } },
    });
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);

    choose(fileOf("cert.pdf", "application/pdf"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Please send your certificate as PDF, JPG or PNG.")
    );
  });

  it("falls back to a plain sentence when the network fails outright", async () => {
    uploadPolicyDocument.mockRejectedValue(new Error("Network Error"));
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);

    choose(fileOf("cert.pdf", "application/pdf"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not upload/i));
  });

  it("lets the same file be chosen again after a failure", async () => {
    uploadPolicyDocument.mockRejectedValue(new Error("Network Error"));
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);

    choose(fileOf("cert.pdf", "application/pdf"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // The input is cleared, so re-picking the same file fires a change event.
    expect(input().value).toBe("");
  });

  it("says it is working, and will not start a second upload meanwhile", async () => {
    let release: (value: unknown) => void = () => {};
    uploadPolicyDocument.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    render(<PolicyDocumentCard policyId="pol-1" onUploaded={vi.fn()} />);

    choose(fileOf("cert.pdf", "application/pdf"));

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent(/Sending/));
    expect(screen.getByRole("button")).toBeDisabled();
    release({ policy: {}, disclaimer: "" });
  });
});

describe("once a certificate is on file", () => {
  it("shows it, its size, and a way to look at it", () => {
    render(<PolicyDocumentCard policyId="pol-1" document={attached} onUploaded={vi.fn()} />);

    expect(screen.getByTestId("attached-document")).toHaveTextContent("My Certificate.pdf");
    expect(screen.getByTestId("attached-document")).toHaveTextContent("1.5 MB");
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute(
      "href",
      "/api/v1/consumer/documents/doc-1/file"
    );
  });

  it("offers to replace it rather than to add another", async () => {
    render(<PolicyDocumentCard policyId="pol-1" document={attached} onUploaded={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent(/Replace it/);
  });

  it("speaks Tamil when asked to", () => {
    render(<PolicyDocumentCard policyId="pol-1" locale="ta" onUploaded={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("உங்கள் சான்றிதழ்");
  });
});
