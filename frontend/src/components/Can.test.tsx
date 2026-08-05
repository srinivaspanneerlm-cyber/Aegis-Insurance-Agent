import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Can from "./Can";

/**
 * `Can` decides what a screen offers, never what the API allows. The cases
 * below are about the honesty of the screen: a control that is shown must be
 * one the person can actually use, and when we cannot tell, we show nothing.
 */

const granted = vi.fn<() => readonly string[]>(() => []);

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ permissions: granted() }),
}));

afterEach(() => {
  cleanup();
  granted.mockReturnValue([]);
});

describe("Can", () => {
  it("renders the control for someone who holds the capability", () => {
    granted.mockReturnValue(["lead.delete"]);
    render(
      <Can permission="lead.delete">
        <button>Delete lead</button>
      </Can>
    );
    expect(screen.queryByRole("button", { name: "Delete lead" })).not.toBeNull();
  });

  it("renders nothing for someone who does not", () => {
    granted.mockReturnValue(["lead.read"]);
    render(
      <Can permission="lead.delete">
        <button>Delete lead</button>
      </Can>
    );
    expect(screen.queryByRole("button", { name: "Delete lead" })).toBeNull();
  });

  it("shows nothing by default rather than an explanation", () => {
    // Telling a customer they lack permission describes a part of the product
    // that is not theirs and invites them to wonder why. An absent control
    // asks no questions.
    const { container } = render(
      <Can permission="staff.manage">
        <button>Manage staff</button>
      </Can>
    );
    expect(container.textContent).toBe("");
  });

  it("uses the fallback when one is given", () => {
    render(
      <Can permission="staff.manage" fallback={<p>Ask your branch manager</p>}>
        <button>Manage staff</button>
      </Can>
    );
    expect(screen.queryByText("Ask your branch manager")).not.toBeNull();
  });

  it("requires every capability by default", () => {
    granted.mockReturnValue(["lead.read"]);
    render(
      <Can permissions={["lead.read", "lead.write"]}>
        <button>Edit lead</button>
      </Can>
    );
    expect(screen.queryByRole("button", { name: "Edit lead" })).toBeNull();
  });

  it("accepts one of several in any mode", () => {
    granted.mockReturnValue(["lead.read"]);
    render(
      <Can permissions={["lead.read", "lead.write"]} mode="any">
        <button>Open pipeline</button>
      </Can>
    );
    expect(screen.queryByRole("button", { name: "Open pipeline" })).not.toBeNull();
  });

  it("asking for no capability grants none", () => {
    // An empty <Can> is a mistake at the call site. The safe reading of a
    // mistake is to show less, not to wave everything through.
    granted.mockReturnValue(["lead.read", "staff.manage"]);
    const { container } = render(
      <Can>
        <button>Unguarded</button>
      </Can>
    );
    expect(container.textContent).toBe("");
  });

  it("shows nothing while the session is still unknown", () => {
    // The boot probe has not answered yet: permissions are empty, and that
    // must not be read as "not yet, so probably yes".
    granted.mockReturnValue([]);
    const { container } = render(
      <Can permission="analytics.read">
        <button>View analytics</button>
      </Can>
    );
    expect(container.textContent).toBe("");
  });
});
