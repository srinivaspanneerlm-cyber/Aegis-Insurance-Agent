import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AttachmentMenu } from "./AttachmentMenu";

afterEach(cleanup);

const openMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: /attach a file/i }));
};

describe("AttachmentMenu", () => {
  it("keeps the menu closed until the paperclip is used", () => {
    render(<AttachmentMenu onSelect={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /attach a file/i });

    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("offers every attachment source", () => {
    render(<AttachmentMenu onSelect={vi.fn()} />);
    openMenu();

    expect(screen.getByRole("menu")).toBeInTheDocument();
    for (const label of ["Documents", "Images", "Videos", "Camera", "Browse Files"]) {
      expect(screen.getByRole("menuitem", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("hands back the picker configuration for the chosen source", async () => {
    const onSelect = vi.fn();
    render(<AttachmentMenu onSelect={onSelect} />);
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: /camera/i }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "camera", capture: "environment", multiple: false }),
    );
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("narrows the accepted types per source", () => {
    const onSelect = vi.fn();
    render(<AttachmentMenu onSelect={onSelect} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /videos/i }));

    expect(onSelect.mock.calls[0][0].accept).toEqual(["video/mp4", "video/quicktime"]);
  });

  it("moves the focused item with the arrow keys and wraps around", () => {
    render(<AttachmentMenu onSelect={vi.fn()} />);
    openMenu();

    const menu = screen.getByRole("menu");
    expect(screen.getByRole("menuitem", { name: /documents/i })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: /images/i })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: /browse files/i })).toHaveFocus();
  });

  it("jumps to the ends with Home and End", () => {
    render(<AttachmentMenu onSelect={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole("menu");

    fireEvent.keyDown(menu, { key: "End" });
    expect(screen.getByRole("menuitem", { name: /browse files/i })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Home" });
    expect(screen.getByRole("menuitem", { name: /documents/i })).toHaveFocus();
  });

  it("opens onto the last item when the trigger is arrowed upward", () => {
    render(<AttachmentMenu onSelect={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /attach a file/i }), { key: "ArrowUp" });

    expect(screen.getByRole("menuitem", { name: /browse files/i })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the paperclip", async () => {
    render(<AttachmentMenu onSelect={vi.fn()} />);
    openMenu();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

    expect(screen.getByRole("button", { name: /attach a file/i })).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("closes when the reader clicks away", async () => {
    render(
      <div>
        <AttachmentMenu onSelect={vi.fn()} />
        <button type="button">elsewhere</button>
      </div>,
    );
    openMenu();

    fireEvent.mouseDown(screen.getByText("elsewhere"));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("cannot be opened while disabled", () => {
    render(<AttachmentMenu onSelect={vi.fn()} disabled />);
    const trigger = screen.getByRole("button", { name: /attach a file/i });

    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("labels the sources in Tamil when asked", () => {
    render(<AttachmentMenu onSelect={vi.fn()} locale="ta" />);
    openMenu();
    expect(screen.getByText("ஆவணங்கள்")).toBeInTheDocument();
  });
});
