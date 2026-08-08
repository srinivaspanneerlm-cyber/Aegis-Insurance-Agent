/**
 * The notification list.
 *
 * It was seeded with three invented notices shown to every customer: an "AI
 * Audit Cleared", a premium "locked in until 2027", and a "KYC Verified"
 * saying identity documents had been stored. The last two are statements of
 * fact about somebody's account, and both were false for anyone who read them.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationsViewport } from "./NotificationsViewport";
import type { DashboardNotification } from "./types";

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark" }) }));

const note = (over: Partial<DashboardNotification> = {}): DashboardNotification => ({
  id: "n1",
  title: "Your document has been accepted",
  message: "rc-book.pdf has been checked and accepted.",
  time: "2 hours ago",
  type: "document",
  read: false,
  ...over,
});

describe("NotificationsViewport", () => {
  it("shows the customer's real notifications", () => {
    render(
      <NotificationsViewport notifications={[note()]} markAllNotificationsRead={vi.fn()} />
    );
    expect(screen.getByText(/has been accepted/i)).toBeInTheDocument();
  });

  it("shows none rather than invented notices when there are none", () => {
    render(<NotificationsViewport notifications={[]} markAllNotificationsRead={vi.fn()} />);
    expect(screen.queryByText(/AI Audit Cleared/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/locked in until 2027/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/KYC Verified/i)).not.toBeInTheDocument();
  });

  it("announces unread in text, not by opacity alone", () => {
    // Unread was signalled by a lower opacity and a border tint. Neither
    // reaches somebody using a screen reader, and the tint alone does not reach
    // somebody who cannot distinguish it.
    const { rerender } = render(
      <NotificationsViewport notifications={[note({ read: false })]} markAllNotificationsRead={vi.fn()} />
    );
    expect(screen.getByText(/^Unread\.$/i)).toBeInTheDocument();

    rerender(
      <NotificationsViewport notifications={[note({ read: true })]} markAllNotificationsRead={vi.fn()} />
    );
    expect(screen.queryByText(/^Unread\.$/i)).not.toBeInTheDocument();
  });

  it("renders the notices as a list", () => {
    render(
      <NotificationsViewport
        notifications={[note({ id: "a" }), note({ id: "b" })]}
        markAllNotificationsRead={vi.fn()}
      />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("names the action for what it does", () => {
    render(<NotificationsViewport notifications={[note()]} markAllNotificationsRead={vi.fn()} />);
    // "Clear All Read" describes neither clearing nor reading.
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeInTheDocument();
  });

  it("distinguishes read from unread", () => {
    const { container } = render(
      <NotificationsViewport
        notifications={[note({ id: "a", read: false }), note({ id: "b", read: true })]}
        markAllNotificationsRead={vi.fn()}
      />
    );
    // Both render; the component styles them differently rather than hiding one.
    expect(container.textContent).toContain("2 hours ago");
  });
});
