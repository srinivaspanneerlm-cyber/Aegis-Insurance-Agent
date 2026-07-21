import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders title, description, and action", () => {
    render(
      <EmptyState
        title="No policies yet"
        description="Your active policies will appear here."
        action={<button>Explore plans</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No policies yet" })).toBeTruthy();
    expect(screen.getByText("Your active policies will appear here.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explore plans" })).toBeTruthy();
  });

  it("omits the description when not provided", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByRole("heading", { name: "Empty" })).toBeTruthy();
  });
});

describe("Skeleton", () => {
  it("is hidden from the a11y tree and animates", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("h-4");
  });

  it("uses a full radius for circle", () => {
    const { container } = render(<Skeleton circle className="h-8 w-8" />);
    expect((container.firstChild as HTMLElement).className).toContain("rounded-full");
  });
});
