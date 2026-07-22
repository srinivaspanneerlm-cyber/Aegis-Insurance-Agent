import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

const base = {
  title: "Log out of Aegis?",
  description: "You'll need to sign in again.",
  confirmLabel: "Log out",
  cancelLabel: "Stay signed in",
};

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(<ConfirmDialog open={false} {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exposes an accessible modal dialog labelled by its title", () => {
    render(<ConfirmDialog open {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: base.title });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("reports a confirm via onConfirm", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open {...base} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: base.confirmLabel }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("reports a cancel via onCancel", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open {...base} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: base.cancelLabel }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cancels on Escape", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open {...base} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("moves focus to the safe (cancel) action on open", async () => {
    render(<ConfirmDialog open {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: base.cancelLabel })),
    );
  });
});
