/**
 * The Help Me Renew card.
 *
 * The interesting property is when it does *not* appear. A renewal button on a
 * policy with eight months left is how a guidance product starts reading as a
 * sales funnel — which is the thing this product is defined against — so the
 * rule that hides it is tested as carefully as the one that shows it.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpMeRenew, shouldOfferRenewal } from "./HelpMeRenew";
import { policyFixture } from "@/lib/consumer/testing/policyFixture";
import type { ConsumerPolicy, RenewalAssessment } from "@/services/api";

const inBand = (status: Extract<RenewalAssessment, { ok: true }>["status"]): ConsumerPolicy =>
  policyFixture({
    renewal: {
      ok: true,
      status,
      daysRemaining: 20,
      urgency: "MEDIUM",
      displayLabel: "Renew soon",
      messageKey: "renewal.status.actionSoon",
      nextActionKey: "renewal.action.startRenewal",
      evaluatedOn: "2026-09-02",
      expiresOn: "2026-09-22",
      timeZone: "Asia/Kolkata",
    },
  });

const noExpiry: ConsumerPolicy = policyFixture({
  renewal: {
    ok: false,
    reason: "MISSING_EXPIRY",
    messageKey: "renewal.status.unknown",
    nextActionKey: "renewal.action.addExpiryDate",
  },
});

describe("when it offers to help", () => {
  it("stays out of the way on a policy with plenty of time left", () => {
    expect(shouldOfferRenewal(inBand("ACTIVE"))).toBe(false);
    render(<HelpMeRenew policy={inBand("ACTIVE")} />);
    expect(screen.queryByTestId("help-me-renew")).not.toBeInTheDocument();
  });

  it("appears once the policy is inside its renewal window", () => {
    for (const status of [
      "RENEWAL_COMING_SOON",
      "ACTION_SOON",
      "URGENT_RENEWAL",
      "POLICY_MAY_BE_EXPIRED",
    ] as const) {
      expect(shouldOfferRenewal(inBand(status)), status).toBe(true);
    }
  });

  it("appears when there is no expiry date at all", () => {
    // Somebody who cannot tell us when their cover ends is precisely who most
    // needs a person to talk to.
    expect(shouldOfferRenewal(noExpiry)).toBe(true);
    render(<HelpMeRenew policy={noExpiry} />);
    expect(screen.getByTestId("help-me-renew")).toBeInTheDocument();
  });
});

describe("what it promises", () => {
  it("offers a conversation, not a price", () => {
    // No quote, no payment and no policy is issued anywhere in this flow.
    render(<HelpMeRenew policy={inBand("ACTION_SOON")} />);
    const card = screen.getByTestId("help-me-renew");
    expect(card).toHaveTextContent(/talk it through/i);
    expect(card).toHaveTextContent(/free/i);
    expect(card.textContent ?? "").not.toMatch(/quote|buy now|pay/i);
  });

  it("leads to the policy's own renewal screen", () => {
    render(<HelpMeRenew policy={inBand("URGENT_RENEWAL")} />);
    expect(screen.getByTestId("help-me-renew-cta")).toHaveAttribute(
      "href",
      "/consumer/policy/pol-1/renew"
    );
  });

  it("reports rather than asks when a request is already in", () => {
    render(<HelpMeRenew policy={inBand("ACTION_SOON")} requestOpen />);
    expect(screen.getByTestId("help-me-renew")).toHaveTextContent(/request is with us/i);
    expect(screen.getByTestId("help-me-renew-cta")).toHaveTextContent(/where it has got to/i);
  });

  it("speaks Tamil when asked to", () => {
    render(<HelpMeRenew policy={inBand("ACTION_SOON")} locale="ta" />);
    expect(screen.getByTestId("help-me-renew")).toHaveTextContent("புதுப்பிக்க உதவி வேண்டுமா?");
  });
});
