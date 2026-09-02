/**
 * Aegis Consumer home — the session guard.
 *
 * The page itself is thin; what matters is that it shows a customer's name to
 * nobody until the session is actually known. The edge middleware turns away
 * anonymous visitors before the page is ever sent, so this covers the second
 * case: a session that ended while the tab sat open.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireAuth = vi.fn();

vi.mock("@/hooks/useRequireAuth", () => ({ useRequireAuth: () => requireAuth() }));
vi.mock("@/components/Navbar", () => ({ default: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ default: () => <footer /> }));

const { default: ConsumerHomePage } = await import("./page");

describe("while the session is still unknown", () => {
  it("renders nothing about the customer", () => {
    requireAuth.mockReturnValue({ user: null, isReady: false });
    render(<ConsumerHomePage />);

    expect(screen.queryByText(/Vanakkam, /)).not.toBeInTheDocument();
    // No quick actions either — a card is a promise that the page is usable.
    expect(screen.queryByText("Check My Policy")).not.toBeInTheDocument();
  });

  it("still gives the page an accessible title and says it is loading", () => {
    requireAuth.mockReturnValue({ user: null, isReady: false });
    render(<ConsumerHomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Aegis Consumer");
    expect(screen.getByText(/loading your page/i)).toBeInTheDocument();
  });
});

describe("once the session is known", () => {
  const signedIn = { user: { name: "Meera Nair" }, isReady: true };

  it("greets the customer and shows every quick action", () => {
    requireAuth.mockReturnValue(signedIn);
    render(<ConsumerHomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vanakkam, Meera.");
    for (const label of [
      "Check My Policy",
      "Renew My Insurance",
      "Understand My Coverage",
      "Claim Help",
      "My Policies",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows the trust note without being asked", () => {
    requireAuth.mockReturnValue(signedIn);
    render(<ConsumerHomePage />);
    expect(screen.getByText(/never ask for payment here/i)).toBeInTheDocument();
  });

  it("copes with a session that has no name on it", () => {
    requireAuth.mockReturnValue({ user: { name: null }, isReady: true });
    render(<ConsumerHomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vanakkam.");
  });
});
