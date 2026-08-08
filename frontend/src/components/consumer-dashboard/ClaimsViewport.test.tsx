/**
 * Claim tracking.
 *
 * This screen used to show one invented claim to every customer — number
 * "#AEG-CLM-901", a settlement of "₹1,45,000 (Fully Approved)", and a four-step
 * bar with three steps marked complete. A customer who had never claimed saw
 * it, and a customer with a real claim pending saw somebody else's progress
 * presented as their own.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClaimsViewport } from "./ClaimsViewport";
import type { TimelineEntry } from "@/services/api";

const entry = (over: Partial<TimelineEntry> = {}): TimelineEntry => ({
  at: new Date().toISOString(),
  source: "work",
  kind: "OPENED",
  summary: "CLAIM opened — Windscreen damage (CLM-2026-000123)",
  actorId: null,
  actorKind: "SYSTEM",
  subjectKind: "workItem",
  subjectId: "wi-1",
  deepLink: "/work/wi-1",
  ...over,
});

describe("ClaimsViewport", () => {
  it("shows nothing rather than an invented claim when there are none", () => {
    render(<ClaimsViewport claims={[]} loading={false} />);
    expect(screen.getByText(/no claims open/i)).toBeInTheDocument();
    expect(screen.queryByText(/AEG-CLM-901/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1,45,000/)).not.toBeInTheDocument();
  });

  it("shows the customer's real case", () => {
    render(<ClaimsViewport claims={[entry()]} loading={false} />);
    expect(screen.getByText(/CLM-2026-000123/)).toBeInTheDocument();
  });

  it("says what happened in words, not as an enum", () => {
    render(<ClaimsViewport claims={[entry({ kind: "ESCALATED" })]} loading={false} />);
    expect(screen.getByText(/escalated/i)).toBeInTheDocument();
    expect(screen.queryByText("STATUS_CHANGED")).not.toBeInTheDocument();
  });

  it("distinguishes loading from having no claims", () => {
    render(<ClaimsViewport claims={[]} loading />);
    expect(screen.getByText(/loading your cases/i)).toBeInTheDocument();
    expect(screen.queryByText(/no claims open/i)).not.toBeInTheDocument();
  });

  it("links through to the case", () => {
    render(<ClaimsViewport claims={[entry()]} loading={false} />);
    expect(screen.getByRole("link", { name: /open this case/i })).toHaveAttribute(
      "href",
      "/work/wi-1"
    );
  });
});
