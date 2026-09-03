/**
 * The Help Me Renew page.
 *
 * It is really a question of which of three states it is in: no request yet,
 * a request already open, or a policy that is not this customer's. The last is
 * the one worth being careful about — a 404 has to read as "we could not find
 * it", the same wording a deleted policy gets, because from this customer's
 * side both are true.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { policyFixture } from "@/lib/consumer/testing/policyFixture";
import type { ConsentRecord, RenewalRequest } from "@/services/api";
import RenewPolicyPage from "./page";

const getPolicy = vi.fn();
const getRenewalRequests = vi.fn();
const getConsents = vi.fn();
const requestRenewalHelp = vi.fn();
const withdrawConsent = vi.fn();
const push = vi.fn();

vi.mock("@/services/api", () => ({
  consumerService: {
    getPolicy: (...a: unknown[]) => getPolicy(...a),
    getRenewalRequests: (...a: unknown[]) => getRenewalRequests(...a),
    getConsents: (...a: unknown[]) => getConsents(...a),
    requestRenewalHelp: (...a: unknown[]) => requestRenewalHelp(...a),
    withdrawConsent: (...a: unknown[]) => withdrawConsent(...a),
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

const policy = policyFixture();

const request = (over: Partial<RenewalRequest> = {}): RenewalRequest => ({
  id: "req-1",
  status: "NEW",
  statusLabel: "New",
  preferredChannel: "CALL",
  policyId: "pol-1",
  urgencyAtCreation: "HIGH",
  expiryAtCreation: "2026-09-22",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  closedReason: null,
  ...over,
});

const consent = (over: Partial<ConsentRecord> = {}): ConsentRecord => ({
  id: "con-1",
  channel: "CALL",
  purpose: "RENEWAL_ASSISTANCE",
  grantedAt: "2026-09-01T00:00:00.000Z",
  withdrawnAt: null,
  active: true,
  textVersion: "consumer-consent-v1",
  policyId: "pol-1",
  ...over,
});

const click = (element: Element) => fireEvent.click(element);
const box = (name: string) => document.querySelector(`input[name="${name}"]`) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  getPolicy.mockResolvedValue({ policy, disclaimer: "", locale: "en" });
  getRenewalRequests.mockResolvedValue({ requests: [] });
  getConsents.mockResolvedValue({ consents: [] });
});

describe("a policy that is not this customer's", () => {
  it("reads as missing rather than as a refusal", async () => {
    getPolicy.mockRejectedValue(new Error("Request failed with status code 404"));
    render(<RenewPolicyPage />);

    await waitFor(() =>
      expect(screen.getByText("We could not find that policy")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("consent-submit")).not.toBeInTheDocument();
  });
});

describe("with no request yet", () => {
  it("shows the consent screen against the right policy", async () => {
    render(<RenewPolicyPage />);

    await waitFor(() => expect(screen.getByTestId("consent-submit")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Help me renew");
    expect(screen.getByText(/TN 09 AB 1234/)).toBeInTheDocument();
  });

  it("sends the request and then shows where it has got to", async () => {
    requestRenewalHelp.mockResolvedValue({
      request: request(),
      alreadyOpen: false,
      message: "Your request is in. Someone will get in touch the way you asked.",
      disclaimer: "",
    });
    getConsents.mockResolvedValue({ consents: [consent()] });

    render(<RenewPolicyPage />);
    await waitFor(() => expect(screen.getByTestId("consent-submit")).toBeInTheDocument());

    click(screen.getByTestId("channel-EMAIL"));
    fireEvent.click(box("agreed"));
    click(screen.getByTestId("consent-submit"));

    await waitFor(() => expect(requestRenewalHelp).toHaveBeenCalledTimes(1));
    expect(requestRenewalHelp.mock.calls[0][0]).toBe("pol-1");
    expect(requestRenewalHelp.mock.calls[0][1]).toMatchObject({
      preferredChannel: "EMAIL",
      agreed: true,
    });

    await waitFor(() => expect(screen.getByTestId("renew-confirmation")).toBeInTheDocument());
    expect(screen.getByTestId("request-status")).toBeInTheDocument();
  });
});

describe("with a request already open", () => {
  beforeEach(() => {
    getRenewalRequests.mockResolvedValue({ requests: [request()] });
    getConsents.mockResolvedValue({ consents: [consent()] });
  });

  it("shows where it has got to instead of a second form", async () => {
    // A second request would put two rows in front of two operators, and the
    // API refuses it anyway.
    render(<RenewPolicyPage />);

    await waitFor(() => expect(screen.getByTestId("request-status")).toBeInTheDocument());
    expect(screen.queryByTestId("consent-submit")).not.toBeInTheDocument();
  });

  it("ignores a closed request on this policy and offers the form again", async () => {
    getRenewalRequests.mockResolvedValue({ requests: [request({ status: "CLOSED" })] });
    render(<RenewPolicyPage />);

    await waitFor(() => expect(screen.getByTestId("consent-submit")).toBeInTheDocument());
  });

  it("ignores an open request on a different policy", async () => {
    getRenewalRequests.mockResolvedValue({ requests: [request({ policyId: "pol-2" })] });
    render(<RenewPolicyPage />);

    await waitFor(() => expect(screen.getByTestId("consent-submit")).toBeInTheDocument());
  });

  it("withdraws a permission and says so", async () => {
    withdrawConsent.mockResolvedValue({
      consent: consent({ active: false, withdrawnAt: "2026-09-05T00:00:00.000Z" }),
      message: "That is stopped. Your policy details are untouched.",
    });
    render(<RenewPolicyPage />);
    await waitFor(() => expect(screen.getByTestId("request-status")).toBeInTheDocument());

    click(screen.getByRole("button", { name: /stop this/i }));

    await waitFor(() => expect(withdrawConsent).toHaveBeenCalledWith("con-1", "en"));
    await waitFor(() =>
      expect(screen.getByTestId("renew-confirmation")).toHaveTextContent(/policy details are untouched/i)
    );
  });

  it("only shows the permissions given for this policy", async () => {
    getConsents.mockResolvedValue({
      consents: [consent(), consent({ id: "con-9", policyId: "pol-2", purpose: "RENEWAL_REMINDER" })],
    });
    render(<RenewPolicyPage />);

    await waitFor(() => expect(screen.getByTestId("consent-RENEWAL_ASSISTANCE")).toBeInTheDocument());
    expect(screen.queryByTestId("consent-RENEWAL_REMINDER")).not.toBeInTheDocument();
  });
});
