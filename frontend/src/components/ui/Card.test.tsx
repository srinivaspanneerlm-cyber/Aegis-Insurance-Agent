import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Card } from "./Card";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("Card", () => {
  it("renders children with the solid surface + card radius by default", () => {
    render(<Card>Body</Card>);
    const el = screen.getByText("Body");
    expect(el.className).toContain("bg-surface-raised");
    expect(el.className).toContain("rounded-4xl");
  });

  it("applies the glass variant utilities", () => {
    render(<Card variant="glass">G</Card>);
    expect(screen.getByText("G").className).toContain("glass-card-premium");
  });

  it("caller padding overrides the default (twMerge)", () => {
    render(
      <Card padding="md" className="p-0">
        P
      </Card>,
    );
    const cls = screen.getByText("P").className;
    expect(cls).toContain("p-0");
    expect(cls).not.toContain("p-6");
  });
});

describe("Badge", () => {
  it("renders the tone utilities and content", () => {
    render(<Badge tone="success">Active</Badge>);
    const el = screen.getByText("Active");
    expect(el.className).toContain("text-emerald-700");
  });
});
