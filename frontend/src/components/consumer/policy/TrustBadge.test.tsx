/**
 * The trust badge.
 *
 * Two properties are asserted because both are easy to break with a change that
 * looks like styling: the state is always readable as words rather than as a
 * colour, and the scope note never leaves the badge. The second is the one that
 * matters most — "Details check out" on its own could be read as the insurer
 * having confirmed the cover, which is a promise this milestone cannot keep.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustBadge, TrustPill } from "./TrustBadge";
import { policyFixture, trustFixture, SCOPE_NOTE } from "@/lib/consumer/testing/policyFixture";
import type { TrustState } from "@/services/api";

const STATES: TrustState[] = [
  "UPLOADED",
  "NEEDS_CONFIRMATION",
  "CONSISTENCY_VERIFIED",
  "VERIFICATION_REQUIRED",
];

const inState = (state: TrustState) => policyFixture({ ...trustFixture(state) });

describe("the full badge", () => {
  it("shows what the state is, why, and what happens next", () => {
    render(<TrustBadge policy={inState("NEEDS_CONFIRMATION")} />);

    expect(screen.getByText("One thing to confirm")).toBeInTheDocument();
    expect(screen.getByText(/perfectly normal answer/i)).toBeInTheDocument();
    expect(screen.getByText(/Ask our advisor/i)).toBeInTheDocument();
  });

  it("carries the scope note in every state", () => {
    for (const state of STATES) {
      const { unmount } = render(<TrustBadge policy={inState(state)} />);
      expect(screen.getByTestId("trust-scope-note"), state).toHaveTextContent(
        "not a confirmation from your insurer"
      );
      unmount();
    }
  });

  it("says the state in words, not only in colour", () => {
    // A badge that means something different in amber than in green is
    // unreadable to somebody who cannot tell them apart — on a screen about
    // whether they are insured.
    for (const state of STATES) {
      const { unmount } = render(<TrustBadge policy={inState(state)} />);
      const badge = screen.getByTestId("trust-badge");
      expect(badge).toHaveAttribute("data-state", state);
      expect(badge.textContent?.trim().length ?? 0, state).toBeGreaterThan(20);
      unmount();
    }
  });

  it("never accuses anybody, whatever the state", () => {
    for (const state of STATES) {
      const { unmount } = render(<TrustBadge policy={inState(state)} />);
      const text = screen.getByTestId("trust-badge").textContent ?? "";
      expect(text, state).not.toMatch(/fraud|fake|suspicious|invalid|rejected/i);
      unmount();
    }
  });

  it("renders the API's words rather than words of its own", () => {
    // The copy is resolved server-side, in the customer's language. A component
    // holding its own sentences would be a second, English-only source of them.
    const policy = policyFixture({
      ...trustFixture("CONSISTENCY_VERIFIED"),
      trustCopy: {
        label: "விவரங்கள் பொருந்துகின்றன",
        reason: "தமிழ் காரணம்",
        action: "தமிழ் நடவடிக்கை",
        scopeNote: SCOPE_NOTE,
        copyVersion: "v1",
      },
    });
    render(<TrustBadge policy={policy} />);
    expect(screen.getByText("விவரங்கள் பொருந்துகின்றன")).toBeInTheDocument();
  });
});

describe("the compact pill", () => {
  it("names the state for a list row", () => {
    render(<TrustPill state="VERIFICATION_REQUIRED" />);
    const pill = screen.getByTestId("trust-pill");
    expect(pill).toHaveAttribute("data-state", "VERIFICATION_REQUIRED");
    expect(pill).toHaveTextContent("We will check this with you");
  });

  it("speaks Tamil when asked to", () => {
    render(<TrustPill state="CONSISTENCY_VERIFIED" locale="ta" />);
    expect(screen.getByTestId("trust-pill")).toHaveTextContent("விவரங்கள் பொருந்துகின்றன");
  });
});
