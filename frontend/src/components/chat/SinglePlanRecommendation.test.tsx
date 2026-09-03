import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SinglePlanRecommendation } from "./SinglePlanRecommendation";
import type { MultiPlan, RecommendationData } from "./types";

/**
 * The recommendation screen shows the plan the backend chose, and nothing
 * around it. What is absent matters as much as what is present: a rank badge,
 * a "1 of 3", or a compare control all reintroduce the choosing that the whole
 * consultation exists to do on the customer's behalf.
 */

const plan: MultiPlan = {
  rank: 1,
  plan_id: "AEG-HLT-005",
  plan_name: "Family Shield",
  segment: "Standard",
  coverage: "₹15,00,000",
  premium: "₹2,100–₹2,900/month",
  claim_ratio: "97.8%",
  risk_level: "Low Risk",
  benefits: ["Cashless at network hospitals", "Restoration benefit", "Annual health check"],
  scores: {
    overall: 91, suitability: 89, budget_match: 94,
    coverage_match: 90, risk_match: 88,
  },
};

const data: RecommendationData = {
  type: "single_plan",
  category: "health",
  planName: plan.plan_name,
  coverage: plan.coverage,
  premium: plan.premium,
  benefits: plan.benefits,
  plans: [plan],
  total_plans: 1,
  recommended: plan.plan_name,
  reason_codes: [
    "Premium sits within the ₹2,500/month they said was comfortable.",
    'Their stated concern — "unexpected medical expenses" — drove the weighting.',
  ],
  alternatives_available: true,
};

afterEach(cleanup);

describe("SinglePlanRecommendation", () => {
  it("shows the one plan the engine chose", () => {
    render(<SinglePlanRecommendation data={data} />);
    expect(screen.getByText("Family Shield")).toBeTruthy();
    expect(screen.getByText("₹2,100–₹2,900/month")).toBeTruthy();
  });

  it("does not rank a plan that has nothing to be ranked against", () => {
    render(<SinglePlanRecommendation data={data} />);
    expect(screen.queryByText("Best Match")).toBeNull();
    expect(screen.queryByText(/#1/)).toBeNull();
  });

  it("offers no compare control alongside a single recommendation", () => {
    render(<SinglePlanRecommendation data={data} />);
    expect(screen.queryByRole("button", { name: /compare/i })).toBeNull();
  });

  it("shows why the plan was chosen", () => {
    render(<SinglePlanRecommendation data={data} />);
    expect(screen.getByText(/unexpected medical expenses/)).toBeTruthy();
  });

  it("says alternatives exist without naming or pricing any of them", () => {
    render(<SinglePlanRecommendation data={data} />);
    expect(screen.getByText(/next-best option compares/)).toBeTruthy();
  });

  it("stays silent about alternatives when the engine reported none", () => {
    render(
      <SinglePlanRecommendation data={{ ...data, alternatives_available: false }} />
    );
    expect(screen.queryByText(/next-best option compares/)).toBeNull();
  });

  it.each([
    ["health", "Recommended Health Plan"],
    ["motor", "Recommended Motor Plan"],
    ["travel", "Recommended Travel Plan"],
    ["property", "Recommended Property Plan"],
    ["home-property", "Recommended Property Plan"],
  ])("names the domain on a %s recommendation", (category, heading) => {
    // All four specialists produce single-plan results now, so none of them
    // may fall through to a generic "Insurance" heading.
    render(<SinglePlanRecommendation data={{ ...data, category }} />);
    expect(screen.getByText(heading)).toBeTruthy();
  });

  it("renders nothing rather than an empty card when no plan came through", () => {
    const { container } = render(
      <SinglePlanRecommendation data={{ ...data, plans: [] }} />
    );
    expect(container.firstChild).toBeNull();
  });
});
