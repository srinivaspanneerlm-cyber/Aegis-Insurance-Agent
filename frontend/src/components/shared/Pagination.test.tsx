import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Pagination } from "./Pagination";
import type { PageInfo } from "@/types/domain";

afterEach(cleanup);

const info = (over: Partial<PageInfo> = {}): PageInfo => ({
  total: 25,
  page: 2,
  limit: 10,
  pages: 3,
  ...over,
});

describe("Pagination", () => {
  it("renders nothing for a single-page list", () => {
    const { container } = render(
      <Pagination pagination={info({ total: 3, page: 1, pages: 1 })} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("summarises the current page and total", () => {
    render(<Pagination pagination={info()} onPageChange={vi.fn()} />);
    expect(screen.getByText(/Page 2 of 3 · 25 total/)).toBeTruthy();
  });

  it("disables Prev on the first page and Next on the last", () => {
    const { rerender } = render(
      <Pagination pagination={info({ page: 1 })} onPageChange={vi.fn()} />,
    );
    expect((screen.getByText("Prev") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Next") as HTMLButtonElement).disabled).toBe(false);

    rerender(<Pagination pagination={info({ page: 3 })} onPageChange={vi.fn()} />);
    expect((screen.getByText("Prev") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText("Next") as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves to the adjacent page on click", () => {
    const onPageChange = vi.fn();
    render(<Pagination pagination={info({ page: 2 })} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText("Prev"));
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it("disables both controls while busy", () => {
    render(<Pagination pagination={info()} onPageChange={vi.fn()} busy />);
    expect((screen.getByText("Prev") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Next") as HTMLButtonElement).disabled).toBe(true);
  });
});
