/**
 * The greeting.
 *
 * Small, but it is the first thing a nervous customer reads, and two of its
 * behaviours are easy to break by accident: addressing somebody by their full
 * account name, and rendering "Vanakkam, ." when the name is missing.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsumerGreeting } from "./ConsumerGreeting";

describe("ConsumerGreeting", () => {
  it("greets the customer by first name only", () => {
    render(<ConsumerGreeting name="Sri Panneerselvam" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vanakkam, Sri.");
  });

  it("greets without a name rather than leaving a dangling comma", () => {
    for (const name of [null, "", "   "]) {
      const { unmount } = render(<ConsumerGreeting name={name} />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vanakkam.");
      unmount();
    }
  });

  it("copes with extra whitespace in a stored name", () => {
    render(<ConsumerGreeting name="  Meera   Nair " />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vanakkam, Meera.");
  });

  it("says the guidance is free, unprompted", () => {
    render(<ConsumerGreeting name="Sri" />);
    expect(screen.getByText(/nothing here costs anything/i)).toBeInTheDocument();
  });

  it("says who can see what the customer adds", () => {
    render(<ConsumerGreeting name="Sri" />);
    expect(screen.getByText(/only you can see/i)).toBeInTheDocument();
  });

  it("has exactly one level-1 heading, so the page has one title", () => {
    render(<ConsumerGreeting name="Sri" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
