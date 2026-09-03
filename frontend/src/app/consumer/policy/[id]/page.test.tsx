/**
 * Policy DNA — the page around the card.
 *
 * The card itself is covered in `PolicyDnaCard.test.tsx`. What is left here is
 * what the page does with it: that a policy which is not this customer's reads
 * as missing rather than as a refusal, that correcting comes before removing,
 * and that removing asks first and then actually removes.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ConsumerPolicy } from "@/services/api";
import { policyFixture, trustFixture } from "@/lib/consumer/testing/policyFixture";
import PolicyDetailPage from "./page";

const getPolicy = vi.fn();
const deletePolicy = vi.fn();
const getDocuments = vi.fn();
const uploadPolicyDocument = vi.fn();
const getRenewalRequests = vi.fn();
const push = vi.fn();

vi.mock("@/services/api", () => ({
  consumerService: {
    getPolicy: (...args: unknown[]) => getPolicy(...args),
    deletePolicy: (...args: unknown[]) => deletePolicy(...args),
    getDocuments: (...args: unknown[]) => getDocuments(...args),
    getRenewalRequests: (...args: unknown[]) => getRenewalRequests(...args),
    uploadPolicyDocument: (...args: unknown[]) => uploadPolicyDocument(...args),
    documentFileUrl: (id: string) => `/api/v1/consumer/documents/${id}/file`,
  },
}));
vi.mock("@/hooks/useRequireAuth", () => ({
  useRequireAuth: () => ({ user: { name: "Meena", preferredLanguage: "en" }, isReady: true }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: "pol-1" }),
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const policy: ConsumerPolicy = policyFixture();

const click = (element: Element) => fireEvent.click(element);

beforeEach(() => {
  vi.clearAllMocks();
  deletePolicy.mockResolvedValue({ deleted: true });
  getDocuments.mockResolvedValue({ documents: [] });
  getRenewalRequests.mockResolvedValue({ requests: [] });
});

describe("a policy that is not this customer's", () => {
  it("reads as missing rather than as a refusal", async () => {
    getPolicy.mockRejectedValue(new Error("Request failed with status code 404"));
    render(<PolicyDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("We could not find that policy")).toBeInTheDocument()
    );
    expect(screen.queryByText("Remove this policy")).not.toBeInTheDocument();
  });
});

describe("a policy the customer holds", () => {
  beforeEach(() =>
    getPolicy.mockResolvedValue({ policy, disclaimer: policy.copy.disclaimer, locale: "en" })
  );

  it("shows the status and the disclaimer that must travel with it", async () => {
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByText("TN 09 AB 1234")).toBeInTheDocument());
    expect(screen.getByText("Your cover is active.")).toBeInTheDocument();
    expect(screen.getByTestId("guidance-disclaimer")).toHaveTextContent("Guidance only.");
  });

  it("offers the correction before the removal", async () => {
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByText("Correct these details")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /correct these details/i })).toHaveAttribute(
      "href",
      "/consumer/policy/pol-1/edit"
    );
  });

  it("asks before removing anything", async () => {
    render(<PolicyDetailPage />);
    await waitFor(() => expect(screen.getByText("Remove this policy")).toBeInTheDocument());

    click(screen.getByText("Remove this policy"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(deletePolicy).not.toHaveBeenCalled();
  });

  it("removes it once confirmed, then goes back to the list", async () => {
    render(<PolicyDetailPage />);
    await waitFor(() => expect(screen.getByText("Remove this policy")).toBeInTheDocument());

    click(screen.getByText("Remove this policy"));
    click(screen.getByRole("button", { name: "Remove it" }));

    await waitFor(() => expect(deletePolicy).toHaveBeenCalledWith("pol-1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/consumer/policy"));
  });

  it("keeps the policy on screen when removing it fails", async () => {
    deletePolicy.mockRejectedValue(new Error("The network dropped."));
    render(<PolicyDetailPage />);
    await waitFor(() => expect(screen.getByText("Remove this policy")).toBeInTheDocument());

    click(screen.getByText("Remove this policy"));
    click(screen.getByRole("button", { name: "Remove it" }));

    await waitFor(() => expect(push).not.toHaveBeenCalled());
    expect(screen.getByText("TN 09 AB 1234")).toBeInTheDocument();
  });
});

describe("what the policy says about itself", () => {
  const attached = {
    id: "doc-1",
    filename: "certificate.pdf",
    mimeType: "application/pdf",
    sizeBytes: 120_000,
    uploadedAt: "2026-09-01T00:00:00.000Z",
    policyId: "pol-1",
    fingerprint: "a1b2c3d4",
  };

  it("shows the trust badge with the note saying what was checked", async () => {
    getPolicy.mockResolvedValue({ policy, disclaimer: policy.copy.disclaimer, locale: "en" });
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByTestId("trust-badge")).toBeInTheDocument());
    expect(screen.getByTestId("trust-badge")).toHaveAttribute("data-state", "UPLOADED");
    expect(screen.getByTestId("trust-scope-note")).toHaveTextContent(
      "not a confirmation from your insurer"
    );
  });

  it("offers the certificate upload as an optional extra", async () => {
    getPolicy.mockResolvedValue({ policy, disclaimer: policy.copy.disclaimer, locale: "en" });
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByText(/Optional/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /choose a file/i })).toBeInTheDocument();
  });

  it("does not ask for documents when the policy has none", async () => {
    // One fewer request on a phone connection, on the common case.
    getPolicy.mockResolvedValue({ policy, disclaimer: policy.copy.disclaimer, locale: "en" });
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByTestId("trust-badge")).toBeInTheDocument());
    expect(getDocuments).not.toHaveBeenCalled();
  });

  it("shows the certificate when one is attached", async () => {
    const verified = policyFixture({ ...trustFixture("CONSISTENCY_VERIFIED") });
    getPolicy.mockResolvedValue({ policy: verified, disclaimer: "", locale: "en" });
    getDocuments.mockResolvedValue({ documents: [attached] });
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByTestId("attached-document")).toBeInTheDocument());
    expect(getDocuments).toHaveBeenCalledWith("pol-1");
    expect(screen.getByTestId("attached-document")).toHaveTextContent("certificate.pdf");
    expect(screen.getByTestId("trust-badge")).toHaveAttribute("data-state", "CONSISTENCY_VERIFIED");
  });

  it("still shows the policy when the document list cannot be loaded", async () => {
    // A certificate that will not list is not a reason to hide somebody's cover.
    const verified = policyFixture({ ...trustFixture("CONSISTENCY_VERIFIED") });
    getPolicy.mockResolvedValue({ policy: verified, disclaimer: "", locale: "en" });
    getDocuments.mockRejectedValue(new Error("The network dropped."));
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByText("TN 09 AB 1234")).toBeInTheDocument());
    expect(screen.queryByTestId("attached-document")).not.toBeInTheDocument();
  });

  it("updates the badge from the upload's own answer", async () => {
    // The API returns the policy, so the badge changes as the upload finishes
    // rather than after a second round trip during which it says the old thing.
    getPolicy.mockResolvedValue({ policy, disclaimer: policy.copy.disclaimer, locale: "en" });
    const verified = policyFixture({ ...trustFixture("CONSISTENCY_VERIFIED") });
    uploadPolicyDocument.mockResolvedValue({ policy: verified, disclaimer: "" });
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByTestId("trust-badge")).toBeInTheDocument());

    const file = new File(["x"], "cert.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 2048 });
    const input = window.document.querySelector('input[name="certificate"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByTestId("trust-badge")).toHaveAttribute("data-state", "CONSISTENCY_VERIFIED")
    );
  });
});

describe("help me renew", () => {
  /** A policy inside its renewal window, which is when the card appears. */
  const expiring = policyFixture({
    renewal: {
      ok: true,
      status: "URGENT_RENEWAL",
      daysRemaining: 5,
      urgency: "HIGH",
      displayLabel: "Renew now",
      messageKey: "renewal.status.urgent",
      nextActionKey: "renewal.action.renewNow",
      evaluatedOn: "2026-09-02",
      expiresOn: "2026-09-07",
      timeZone: "Asia/Kolkata",
    },
  });

  it("offers help when the policy is close to running out", async () => {
    getPolicy.mockResolvedValue({ policy: expiring, disclaimer: "", locale: "en" });
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByTestId("help-me-renew")).toBeInTheDocument());
    expect(screen.getByTestId("help-me-renew-cta")).toHaveAttribute(
      "href",
      "/consumer/policy/pol-1/renew"
    );
  });

  it("stays out of the way on a policy with plenty of time left", async () => {
    // The fixture's default is ACTIVE. A renewal button on a policy with months
    // left is how a guidance product starts reading as a sales funnel.
    getPolicy.mockResolvedValue({ policy, disclaimer: policy.copy.disclaimer, locale: "en" });
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByTestId("trust-badge")).toBeInTheDocument());
    expect(screen.queryByTestId("help-me-renew")).not.toBeInTheDocument();
  });

  it("reports the request rather than asking again when one is open", async () => {
    getPolicy.mockResolvedValue({ policy: expiring, disclaimer: "", locale: "en" });
    getRenewalRequests.mockResolvedValue({
      requests: [{ id: "req-1", policyId: "pol-1", status: "NEW" }],
    });
    render(<PolicyDetailPage />);

    await waitFor(() =>
      expect(screen.getByTestId("help-me-renew")).toHaveTextContent(/request is with us/i)
    );
  });

  it("still shows the policy when the request list cannot be loaded", async () => {
    getPolicy.mockResolvedValue({ policy: expiring, disclaimer: "", locale: "en" });
    getRenewalRequests.mockRejectedValue(new Error("The network dropped."));
    render(<PolicyDetailPage />);

    await waitFor(() => expect(screen.getByText("TN 09 AB 1234")).toBeInTheDocument());
    expect(screen.getByTestId("help-me-renew")).toBeInTheDocument();
  });
});
