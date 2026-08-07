/**
 * The protection score card.
 *
 * The property worth pinning: it never shows a number it does not have. The
 * card previously read a fixed 82% with two invented status pills — a customer
 * acting on that was acting on nothing, and it looked personal enough to be
 * believed.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { IntelligenceReport } from "@aegis/intelligence";
import { ProtectionScoreCard } from "./ProtectionScoreCard";

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark" }) }));

const report = (over: Partial<IntelligenceReport> = {}): IntelligenceReport =>
  ({
    userId: "u1",
    profileHash: "h",
    profileCompleteness: 64,
    generatedAt: new Date(),
    engineVersion: "1.0.0",
    need: {} as IntelligenceReport["need"],
    recommendations: [],
    gaps: [],
    risk: {} as IntelligenceReport["risk"],
    renewals: [],
    documents: null,
    nextBestAction: { summary: "Take out vehicle insurance.", domain: "motor", rationale: "r" },
    ...over,
  }) as IntelligenceReport;

describe("ProtectionScoreCard", () => {
  it("shows the engine's completeness, not a fixed number", () => {
    render(<ProtectionScoreCard report={report()} loading={false} error={null} />);
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.queryByText("82%")).not.toBeInTheDocument();
  });

  it("leads with the platform's next best action", () => {
    render(<ProtectionScoreCard report={report()} loading={false} error={null} />);
    expect(screen.getByText(/take out vehicle insurance/i)).toBeInTheDocument();
  });

  it("shows a dash rather than a plausible number while loading", () => {
    render(<ProtectionScoreCard report={null} loading error={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("says so when the report could not be loaded", () => {
    render(<ProtectionScoreCard report={null} loading={false} error="Could not load." />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/could not load your protection profile/i)).toBeInTheDocument();
  });

  it("renders a pill per real gap, and none when there are none", () => {
    const { rerender } = render(
      <ProtectionScoreCard report={report()} loading={false} error={null} />
    );
    expect(screen.queryByText(/gap/i)).not.toBeInTheDocument();

    rerender(
      <ProtectionScoreCard
        report={report({
          gaps: [
            { domain: "motor", kind: "MISSING", severity: "CRITICAL" },
            { domain: "health", kind: "UNDERINSURED", severity: "HIGH" },
            { domain: "life", kind: "MISSING", severity: "LOW" },
          ] as IntelligenceReport["gaps"],
        })}
        loading={false}
        error={null}
      />
    );
    // Two shown, capped; the LOW one is not a gap worth alarming somebody about.
    expect(screen.getByText(/motor: gap/i)).toBeInTheDocument();
    expect(screen.getByText(/health: gap/i)).toBeInTheDocument();
    expect(screen.queryByText(/life: gap/i)).not.toBeInTheDocument();
  });

  it("announces the figure politely rather than only drawing it", () => {
    render(<ProtectionScoreCard report={report()} loading={false} error={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("64%");
  });
});
