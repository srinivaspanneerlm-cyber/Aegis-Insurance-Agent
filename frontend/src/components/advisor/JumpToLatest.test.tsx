import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { JumpToLatest } from "./JumpToLatest";

afterEach(cleanup);

describe("JumpToLatest", () => {
  it("renders nothing when show is false", () => {
    render(<JumpToLatest show={false} onClick={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /jump to latest/i })).toBeNull();
  });

  it("renders an accessible button when show is true", () => {
    render(<JumpToLatest show onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /jump to latest/i })).toBeTruthy();
  });

  it("reports a click via onClick", () => {
    const onClick = vi.fn();
    render(<JumpToLatest show onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /jump to latest/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
