/**
 * Where a request has got to, and stopping it.
 *
 * Two things carry real weight. The status has to be explained rather than
 * named — "Partner handoff" is an operations word and tells a customer nothing
 * — and stopping has to be reachable from the screen showing the thing that
 * will contact them, with the reassurance that it costs them nothing.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RequestStatusCard } from "./RequestStatusCard";
import type { ConsentRecord, RenewalRequest } from "@/services/api";

const onWithdraw = vi.fn();

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

beforeEach(() => {
  vi.clearAllMocks();
  onWithdraw.mockResolvedValue(undefined);
});

describe("the status", () => {
  it("explains the stage rather than only naming it", () => {
    render(
      <RequestStatusCard
        request={request({ status: "PARTNER_HANDOFF", statusLabel: "Partner handoff" })}
        consents={[consent()]}
        onWithdraw={onWithdraw}
      />
    );

    expect(screen.getByTestId("request-status")).toHaveAttribute("data-status", "PARTNER_HANDOFF");
    expect(screen.getByText(/A partner is handling your renewal/i)).toBeInTheDocument();
  });

  it("says plainly that the partner issues the policy, not Aegis", () => {
    render(
      <RequestStatusCard
        request={request({ status: "PARTNER_HANDOFF", statusLabel: "Partner handoff" })}
        consents={[consent()]}
        onWithdraw={onWithdraw}
      />
    );
    expect(screen.getByTestId("request-status")).toHaveTextContent(/not us/i);
  });

  it("shows when they asked and how they asked to be reached", () => {
    render(
      <RequestStatusCard request={request()} consents={[consent()]} onWithdraw={onWithdraw} />
    );
    expect(screen.getByTestId("request-status")).toHaveTextContent("1 September 2026");
    expect(screen.getByTestId("request-status")).toHaveTextContent("Phone call");
  });
});

describe("stopping it", () => {
  it("lists each permission separately, so one can be stopped without the other", () => {
    render(
      <RequestStatusCard
        request={request()}
        consents={[consent(), consent({ id: "con-2", purpose: "RENEWAL_REMINDER" })]}
        onWithdraw={onWithdraw}
      />
    );
    expect(screen.getByTestId("consent-RENEWAL_ASSISTANCE")).toBeInTheDocument();
    expect(screen.getByTestId("consent-RENEWAL_REMINDER")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /stop this/i })).toHaveLength(2);
  });

  it("withdraws the one that was chosen", async () => {
    render(
      <RequestStatusCard
        request={request()}
        consents={[consent(), consent({ id: "con-2", purpose: "RENEWAL_REMINDER" })]}
        onWithdraw={onWithdraw}
      />
    );

    const reminder = screen.getByTestId("consent-RENEWAL_REMINDER");
    fireEvent.click(reminder.querySelector("button") as HTMLButtonElement);

    await waitFor(() => expect(onWithdraw).toHaveBeenCalledWith("con-2"));
  });

  it("promises that stopping changes nothing about the policy", () => {
    // The fear is real and common: that saying "stop calling me" costs them the
    // cover they already have.
    render(
      <RequestStatusCard request={request()} consents={[consent()]} onWithdraw={onWithdraw} />
    );
    expect(screen.getByText(/changes nothing about your policy/i)).toBeInTheDocument();
  });

  it("shows a stopped permission as stopped rather than hiding it", () => {
    render(
      <RequestStatusCard
        request={request()}
        consents={[consent({ active: false, withdrawnAt: "2026-09-05T00:00:00.000Z" })]}
        onWithdraw={onWithdraw}
      />
    );
    const row = screen.getByTestId("consent-RENEWAL_ASSISTANCE");
    expect(row).toHaveTextContent("Stopped");
    expect(row).toHaveTextContent("5 September 2026");
    expect(row.querySelector("button")).toBeNull();
  });

  it("says so when stopping fails, rather than appearing to have worked", async () => {
    onWithdraw.mockRejectedValue(new Error("The network dropped."));
    render(
      <RequestStatusCard request={request()} consents={[consent()]} onWithdraw={onWithdraw} />
    );

    fireEvent.click(screen.getByRole("button", { name: /stop this/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not stop/i));
  });

  it("speaks Tamil when asked to", () => {
    render(
      <RequestStatusCard
        request={request()}
        consents={[consent()]}
        locale="ta"
        onWithdraw={onWithdraw}
      />
    );
    expect(screen.getByText("உங்கள் கோரிக்கை எங்களிடம் உள்ளது. ஒருவர் அதை எடுத்துக்கொள்வார்.")).toBeInTheDocument();
  });
});
