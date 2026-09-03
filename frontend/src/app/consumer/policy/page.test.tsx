/**
 * My Policies.
 *
 * Three states, and the one that matters most is the empty one: it is what a
 * new customer sees first, and it has to offer them the way in rather than
 * leaving them on a blank page that reads as a broken product.
 *
 * The list itself is only asked two things — that every policy carries its
 * renewal status where it can be read without opening anything, and that the
 * guidance disclaimer is on the page beside them.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ConsumerPolicy } from "@/services/api";
import { policyFixture } from "@/lib/consumer/testing/policyFixture";
import MyPoliciesPage from "./page";

const getPolicies = vi.fn();

vi.mock("@/services/api", () => ({
  consumerService: { getPolicies: (...args: unknown[]) => getPolicies(...args) },
}));
vi.mock("@/hooks/useRequireAuth", () => ({
  useRequireAuth: () => ({ user: { name: "Meena", preferredLanguage: "en" }, isReady: true }),
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const DISCLAIMER =
  "Guidance only. Exact coverage, eligibility and renewal terms depend on official policy wording and insurer/partner confirmation.";

const policy = (over: Partial<ConsumerPolicy> = {}): ConsumerPolicy =>
  policyFixture({
    renewal: {
      ok: true,
      status: "URGENT_RENEWAL",
      daysRemaining: 6,
      urgency: "CRITICAL",
      displayLabel: "Renew now",
      messageKey: "renewal.status.urgent",
      nextActionKey: "renewal.action.renewNow",
      evaluatedOn: "2026-09-02",
      expiresOn: "2026-09-08",
      timeZone: "Asia/Kolkata",
    },
    ...over,
  });

beforeEach(() => vi.clearAllMocks());

describe("a customer with nothing added yet", () => {
  it("is offered the way in rather than left on a blank page", async () => {
    getPolicies.mockResolvedValue({ policies: [], disclaimer: DISCLAIMER, locale: "en" });
    render(<MyPoliciesPage />);

    await waitFor(() => expect(screen.getByText("No policies yet")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /add my policy/i })).toHaveAttribute(
      "href",
      "/consumer/policy/new"
    );
  });
});

describe("a customer with policies", () => {
  it("shows each one with its renewal status, without anything being opened", async () => {
    getPolicies.mockResolvedValue({
      policies: [policy(), policy({ id: "pol-2", vehicle: null })],
      disclaimer: DISCLAIMER,
      locale: "en",
    });
    render(<MyPoliciesPage />);

    await waitFor(() => expect(screen.getByTestId("policy-row-pol-1")).toBeInTheDocument());
    expect(screen.getByTestId("policy-row-pol-1")).toHaveAttribute(
      "href",
      "/consumer/policy/pol-1"
    );
    // The status is words, not a colour — see RenewalStatusPill.
    expect(screen.getAllByText("Renew now").length).toBe(2);
    // A policy with no vehicle on it still gets a row rather than breaking the list.
    expect(screen.getByText("Vehicle not recorded")).toBeInTheDocument();
  });

  it("keeps the guidance disclaimer on the page beside them", async () => {
    getPolicies.mockResolvedValue({ policies: [policy()], disclaimer: DISCLAIMER, locale: "en" });
    render(<MyPoliciesPage />);

    await waitFor(() => expect(screen.getByText(DISCLAIMER)).toBeInTheDocument());
  });

  it("asks in the customer's language", async () => {
    getPolicies.mockResolvedValue({ policies: [], disclaimer: DISCLAIMER, locale: "en" });
    render(<MyPoliciesPage />);

    await waitFor(() => expect(getPolicies).toHaveBeenCalledWith("en"));
  });
});

describe("when the list cannot be loaded", () => {
  it("says so and offers to try again, rather than showing an empty list", async () => {
    // An empty list would tell a customer their policies are gone.
    getPolicies.mockRejectedValue(new Error("The network dropped."));
    render(<MyPoliciesPage />);

    await waitFor(() =>
      expect(screen.getByText("We could not load your policies")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText("No policies yet")).not.toBeInTheDocument();
  });
});
