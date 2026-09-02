/**
 * Policy DNA and the renewal status pill.
 *
 * Three properties carry real risk if they break, and they are what this file
 * is for: the full policy number never appears, the guidance disclaimer always
 * does, and the urgency is never signalled by colour alone.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PolicyDnaCard } from "./PolicyDnaCard";
import { RenewalStatusPill, daysRemainingLabel } from "./RenewalStatusPill";
import type { ConsumerPolicy, RenewalAssessment } from "@/services/api";
import { policyFixture } from "@/lib/consumer/testing/policyFixture";

const DISCLAIMER =
  "Guidance only. Exact coverage, eligibility and renewal terms depend on official policy wording and insurer/partner confirmation.";

const assessed = (
  status: Extract<RenewalAssessment, { ok: true }>["status"],
  daysRemaining: number,
  displayLabel: string
): RenewalAssessment => ({
  ok: true,
  status,
  daysRemaining,
  urgency: "MEDIUM",
  displayLabel,
  messageKey: "renewal.status.actionSoon",
  nextActionKey: "renewal.action.startRenewal",
  evaluatedOn: "2026-09-01",
  expiresOn: "2026-09-21",
  timeZone: "Asia/Kolkata",
});

const policy = (overrides: Partial<ConsumerPolicy> = {}): ConsumerPolicy =>
  policyFixture({
    id: "p1",
    insurer: "Bharat General Insurance",
    policyNumberMasked: "••••••••0123",
    startDate: "2025-09-21",
    expiryDate: "2026-09-21",
    vehicle: {
      id: "v1",
      registrationNumber: "TN 09 AB 1234",
      vehicleType: "BIKE",
      make: "Hero",
      model: "Splendor",
    },
    renewal: assessed("ACTION_SOON", 20, "Action Soon"),
    copy: {
      status: "Your policy expires within a month. It is worth starting the renewal now.",
      nextAction: "Start your renewal now so you are not rushed later. We can help.",
      disclaimer: DISCLAIMER,
      copyVersion: "consumer-renewal-copy-v1",
    },
    ...overrides,
  });

describe("what a customer sees", () => {
  it("leads with the vehicle they recognise", () => {
    render(<PolicyDnaCard policy={policy()} />);
    expect(screen.getByText("TN 09 AB 1234")).toBeInTheDocument();
  });

  it("shows the status, the days left and what to do", () => {
    render(<PolicyDnaCard policy={policy()} />);
    expect(screen.getByTestId("renewal-status-pill")).toHaveTextContent("Action Soon");
    expect(screen.getByTestId("days-remaining")).toHaveTextContent("20 days left");
    expect(screen.getByText(/Start your renewal now/)).toBeInTheDocument();
  });

  it("explains what the cover type actually means", () => {
    // The part most customers have never been told, and the reason this page
    // exists rather than a row in a table.
    render(<PolicyDnaCard policy={policy()} />);
    expect(screen.getByText(/Covers damage to other people and to your own vehicle/)).toBeInTheDocument();
  });

  it("writes the expiry date out in full rather than as digits to decode", () => {
    render(<PolicyDnaCard policy={policy()} />);
    expect(screen.getByText("21 September 2026")).toBeInTheDocument();
  });
});

describe("the policy number", () => {
  it("shows only what the server sent, which is the masked form", () => {
    render(<PolicyDnaCard policy={policy()} />);
    expect(screen.getByText("••••••••0123")).toBeInTheDocument();
  });

  it("never renders a full policy number, even if one somehow arrives", () => {
    // The API masks it, and the component has no field for the full value —
    // this pins that there is no path by which one could be rendered.
    const withFull = { ...policy(), policyNumber: "POL2026000123" } as ConsumerPolicy;
    render(<PolicyDnaCard policy={withFull} />);
    expect(screen.queryByText(/POL2026000123/)).not.toBeInTheDocument();
  });

  it("says out loud that it is only showing part of it", () => {
    render(<PolicyDnaCard policy={policy()} />);
    expect(screen.getByText(/only show the last few digits/i)).toBeInTheDocument();
  });
});

describe("the guidance disclaimer", () => {
  it("is shown with the result", () => {
    render(<PolicyDnaCard policy={policy()} />);
    expect(screen.getByTestId("guidance-disclaimer")).toHaveTextContent(DISCLAIMER);
  });

  it("is shown on every band, including when the expiry is unknown", () => {
    const bands: RenewalAssessment[] = [
      assessed("ACTIVE", 200, "Active"),
      assessed("RENEWAL_COMING_SOON", 45, "Renewal Coming Soon"),
      assessed("URGENT_RENEWAL", 3, "Urgent Renewal"),
      assessed("POLICY_MAY_BE_EXPIRED", -5, "Policy May Be Expired"),
      { ok: false, reason: "MISSING_EXPIRY", messageKey: "renewal.status.unknown", nextActionKey: "renewal.action.addExpiryDate" },
    ];

    for (const renewal of bands) {
      const { unmount } = render(<PolicyDnaCard policy={policy({ renewal })} />);
      expect(screen.getByTestId("guidance-disclaimer")).toHaveTextContent(/^Guidance only\./);
      unmount();
    }
  });
});

describe("the status pill", () => {
  it("never signals urgency by colour alone", () => {
    // Roughly one man in twelve cannot reliably tell the red pill from the
    // green one, and here that difference is "your cover has lapsed" against
    // "nothing to do". Each band carries its own icon and its own words.
    const bands: [RenewalAssessment, string][] = [
      [assessed("ACTIVE", 200, "Active"), "Active"],
      [assessed("URGENT_RENEWAL", 3, "Urgent Renewal"), "Urgent Renewal"],
      [assessed("POLICY_MAY_BE_EXPIRED", -5, "Policy May Be Expired"), "Policy May Be Expired"],
    ];

    for (const [renewal, label] of bands) {
      const { container, unmount } = render(<RenewalStatusPill renewal={renewal} />);
      expect(screen.getByTestId("renewal-status-pill")).toHaveTextContent(label);
      expect(container.querySelector("svg"), `${label} has no icon`).toBeTruthy();
      unmount();
    }
  });

  it("has something to say when the expiry date is missing", () => {
    render(
      <RenewalStatusPill
        renewal={{ ok: false, reason: "MISSING_EXPIRY", messageKey: "renewal.status.unknown", nextActionKey: "renewal.action.addExpiryDate" }}
      />
    );
    // An empty space would read as "no problem".
    expect(screen.getByTestId("renewal-status-pill")).toHaveTextContent("Expiry date needed");
  });
});

describe("daysRemainingLabel", () => {
  it("spells out the cases a bare number reads wrongly", () => {
    // "0 days" is read as "no problem" about as often as "today".
    expect(daysRemainingLabel(assessed("POLICY_MAY_BE_EXPIRED", 0, "x"))).toBe("Expires today");
    expect(daysRemainingLabel(assessed("URGENT_RENEWAL", 1, "x"))).toBe("1 day left");
    expect(daysRemainingLabel(assessed("ACTION_SOON", 12, "x"))).toBe("12 days left");
    expect(daysRemainingLabel(assessed("POLICY_MAY_BE_EXPIRED", -1, "x"))).toBe("Expired yesterday");
    expect(daysRemainingLabel(assessed("POLICY_MAY_BE_EXPIRED", -30, "x"))).toBe("Expired 30 days ago");
  });

  it("says nothing when there is no date to count from", () => {
    expect(
      daysRemainingLabel({ ok: false, reason: "MISSING_EXPIRY", messageKey: "renewal.status.unknown", nextActionKey: "renewal.action.addExpiryDate" })
    ).toBeNull();
  });
});

describe("policies with gaps in them", () => {
  it("renders without a vehicle, an IDV or a bonus", () => {
    render(
      <PolicyDnaCard
        policy={policy({ vehicle: null, idv: null, ncbPercent: null, startDate: null, insurer: null })}
      />
    );
    expect(screen.getByText("Vehicle not recorded")).toBeInTheDocument();
    expect(screen.getByTestId("guidance-disclaimer")).toBeInTheDocument();
  });

  it("renders the Tamil copy when asked", () => {
    render(<PolicyDnaCard policy={policy()} locale="ta" />);
    // The choice labels come from the frontend catalogue; the status copy comes
    // from the server. Only the former changes with this prop.
    expect(screen.getByText("முழு பாதுகாப்பு")).toBeInTheDocument();
  });
});
