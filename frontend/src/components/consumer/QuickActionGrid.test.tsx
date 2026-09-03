/**
 * How the quick actions render.
 *
 * The interesting assertions are about the difference between a card that works
 * and one that does not yet: the first has to be a real link, and the second
 * has to not be — a disabled anchor still announces a destination that is not
 * there, which is the failure mode this file guards.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QuickActionGrid } from "./QuickActionGrid";
import { QUICK_ACTIONS } from "@/lib/consumer/quickActions";

describe("QuickActionGrid", () => {
  it("renders all five actions", () => {
    render(<QuickActionGrid />);
    for (const action of QUICK_ACTIONS) {
      expect(screen.getByText(action.label)).toBeInTheDocument();
    }
  });

  it("renders a list, so a screen reader announces how many choices there are", () => {
    render(<QuickActionGrid />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(QUICK_ACTIONS.length);
  });

  it("makes every ready action a real link to its destination", () => {
    render(<QuickActionGrid />);
    for (const action of QUICK_ACTIONS.filter((a) => a.state === "ready")) {
      const card = screen.getByTestId(`quick-action-${action.id}`);
      expect(card.tagName).toBe("A");
      expect(card).toHaveAttribute("href", action.href);
    }
  });

  it("does not render a pending action as a link at all", () => {
    render(<QuickActionGrid />);
    for (const action of QUICK_ACTIONS.filter((a) => a.state === "next")) {
      const card = screen.getByTestId(`quick-action-${action.id}`);
      // Not a disabled anchor: a disabled <a> is still focusable in some
      // browsers and still announced as a link, promising a page that is not
      // there. A div with an explicit aria-disabled is what it says it is.
      expect(card.tagName).not.toBe("A");
      expect(card).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("tells the reader when a pending action will arrive", () => {
    render(<QuickActionGrid />);
    for (const action of QUICK_ACTIONS.filter((a) => a.state === "next")) {
      const card = screen.getByTestId(`quick-action-${action.id}`);
      expect(within(card).getByText(action.pending!)).toBeInTheDocument();
    }
  });

  it("shows every description, so nothing is a bare label", () => {
    render(<QuickActionGrid />);
    for (const action of QUICK_ACTIONS) {
      expect(screen.getByText(action.description)).toBeInTheDocument();
    }
  });

  it("keeps a tap target large enough for a thumb", () => {
    // jsdom has no layout engine, so this asserts the class that sets the
    // height rather than a measured box — a measurement here would pass
    // whatever the CSS said, which is worse than no test. 112px clears the
    // 44px minimum on every axis with room for unsteady hands.
    render(<QuickActionGrid />);
    for (const action of QUICK_ACTIONS) {
      const card = screen.getByTestId(`quick-action-${action.id}`);
      expect(card.className).toMatch(/min-h-\[112px\]/);
    }
  });
});
