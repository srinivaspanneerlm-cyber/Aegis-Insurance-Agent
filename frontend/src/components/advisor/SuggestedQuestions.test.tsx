import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SuggestedQuestions } from "./SuggestedQuestions";

afterEach(cleanup);

const qs = ["What does health insurance cover?", "How much cover do I need?"];

describe("SuggestedQuestions", () => {
  it("renders nothing when there are no questions", () => {
    const { container } = render(<SuggestedQuestions questions={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each question as a button", () => {
    render(<SuggestedQuestions questions={qs} onSelect={vi.fn()} />);
    qs.forEach((q) => expect(screen.getByRole("button", { name: q })).toBeTruthy());
  });

  it("reports the chosen question via onSelect", () => {
    const onSelect = vi.fn();
    render(<SuggestedQuestions questions={qs} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: qs[1] }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(qs[1]);
  });

  it("disables the chips when disabled", () => {
    render(<SuggestedQuestions questions={qs} onSelect={vi.fn()} disabled />);
    expect((screen.getByRole("button", { name: qs[0] }) as HTMLButtonElement).disabled).toBe(true);
  });
});
