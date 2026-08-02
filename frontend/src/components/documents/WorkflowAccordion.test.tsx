import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { WorkflowStepView } from "@/lib/documents/workflowSteps";
import { WorkflowAccordion } from "./WorkflowAccordion";

afterEach(cleanup);

const step = (over: Partial<WorkflowStepView> & Pick<WorkflowStepView, "id">): WorkflowStepView => ({
  title: { en: over.id, taEn: over.id },
  status: "locked",
  progress: 0,
  verified: false,
  ...over,
});

const steps: WorkflowStepView[] = [
  step({ id: "documents", title: { en: "What we need", ta: "எங்களுக்கு என்ன தேவை" }, status: "done", progress: 100, verified: true }),
  step({ id: "upload", title: { en: "Your documents" }, status: "active", progress: 50, detail: { en: "1 of 2 received" } }),
  step({ id: "verification", title: { en: "Checks" }, status: "locked", progress: 0 }),
];

describe("WorkflowAccordion", () => {
  it("lists every step with its own header button", () => {
    render(<WorkflowAccordion steps={steps} />);

    for (const name of ["What we need", "Your documents", "Checks"]) {
      expect(screen.getByRole("button", { name: new RegExp(name, "i") })).toBeInTheDocument();
    }
  });

  it("reports overall completion as a percentage and a progress bar", () => {
    render(<WorkflowAccordion steps={steps} />);

    // 100 + 50 + 0, averaged
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /overall completion/i })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
  });

  it("opens the active step so the customer lands on what to do next", () => {
    render(<WorkflowAccordion steps={steps} />);

    expect(screen.getByRole("button", { name: /your documents/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /checks/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("honours an explicit set of open steps", () => {
    render(<WorkflowAccordion steps={steps} defaultOpenIds={["verification"]} />);

    expect(screen.getByRole("button", { name: /checks/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("expands and collapses a step on click", async () => {
    render(<WorkflowAccordion steps={steps} />);
    const header = screen.getByRole("button", { name: /checks/i });

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: /checks/i })).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(screen.queryByRole("region", { name: /checks/i })).not.toBeInTheDocument());
  });

  it("lets the customer look ahead at a locked step", () => {
    render(<WorkflowAccordion steps={steps} />);
    const header = screen.getByRole("button", { name: /checks/i });

    expect(header).not.toBeDisabled();
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
  });

  it("walks the headers with the arrow keys and wraps around", () => {
    render(<WorkflowAccordion steps={steps} />);
    const first = screen.getByRole("button", { name: /what we need/i });

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: /your documents/i })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("button", { name: /your documents/i }), { key: "ArrowUp" });
    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(screen.getByRole("button", { name: /checks/i })).toHaveFocus();
  });

  it("jumps to the ends with Home and End", () => {
    render(<WorkflowAccordion steps={steps} />);
    const first = screen.getByRole("button", { name: /what we need/i });

    first.focus();
    fireEvent.keyDown(first, { key: "End" });
    expect(screen.getByRole("button", { name: /checks/i })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("button", { name: /checks/i }), { key: "Home" });
    expect(first).toHaveFocus();
  });

  it("shows the step's own progress bar while it is part-way through", () => {
    render(<WorkflowAccordion steps={steps} />);

    expect(screen.getByRole("progressbar", { name: /your documents progress/i })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
  });

  it("renders the caller's body inside the step panel", () => {
    render(
      <WorkflowAccordion
        steps={steps}
        renderStep={(s) => (s.id === "upload" ? <p>upload cards here</p> : null)}
      />,
    );

    expect(screen.getByText("upload cards here")).toBeInTheDocument();
  });

  // ── The honesty rule ─────────────────────────────────────────────────────────

  it("ticks a step only when its outcome was genuinely proven", () => {
    render(<WorkflowAccordion steps={steps} />);

    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText("Finished, nothing confirmed")).not.toBeInTheDocument();
  });

  it("gives a finished-but-unconfirmed step a neutral marker, not a tick", () => {
    const unconfirmed = [
      step({ id: "verification", title: { en: "Checks" }, status: "done", progress: 100, verified: false }),
    ];
    render(<WorkflowAccordion steps={unconfirmed} />);

    expect(screen.getByText("Finished, nothing confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("announces a locked step as not yet reachable", () => {
    render(<WorkflowAccordion steps={steps} />);
    expect(screen.getByText("Not yet")).toBeInTheDocument();
  });

  it("shows the count line under the title", () => {
    render(<WorkflowAccordion steps={steps} />);
    expect(screen.getByText("1 of 2 received")).toBeInTheDocument();
  });

  it("titles the steps in Tamil when asked", () => {
    render(<WorkflowAccordion steps={steps} locale="ta" />);
    expect(screen.getByText("எங்களுக்கு என்ன தேவை")).toBeInTheDocument();
  });
});
