/**
 * The multi-step form, driven the way a customer drives it.
 *
 * The pure rules are covered in `policyForm.test.ts`; what is left here is the
 * behaviour a person actually experiences — when errors appear, whether their
 * answers survive going backwards, and whether a failed save loses the form.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PolicyWizard } from "./PolicyWizard";
import { draftFromPolicy, type EditablePolicy } from "@/lib/consumer/policyForm";

const type = (name: string): HTMLInputElement =>
  screen.getByRole("textbox", { name: new RegExp(name, "i") }) as HTMLInputElement;

const named = (name: string): HTMLInputElement =>
  document.querySelector(`input[name="${name}"]`) as HTMLInputElement;

/** `fireEvent`, because this workspace has no `user-event` dependency. */
const fill = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

const click = (element: Element) => fireEvent.click(element);

const next = () => click(screen.getByTestId("wizard-next"));

/** Fill in step one and move on. */
function completeVehicleStep() {
  fill(type("Vehicle number"), "TN 09 AB 1234");
  click(screen.getByTestId("choice-vehicleType-BIKE"));
  next();
}

function completeInsurerStep() {
  fill(type("Insurance company"), "Bharat General");
  fill(type("Policy number"), "POL/2026/000123");
  next();
}

describe("moving through the form", () => {
  it("starts on the vehicle step and shows progress", () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);
    expect(screen.getByText("Which vehicle?")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  it("will not advance past a step that is not answered", async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);

    next();

    expect(screen.getByText("Which vehicle?")).toBeInTheDocument();
    expect(screen.getByText(/Please enter your vehicle number/)).toBeInTheDocument();
  });

  it("does not complain while somebody is still typing", async () => {
    // A field that turns red on the second character tells a nervous user they
    // are failing at something they have not finished doing.
    render(<PolicyWizard onSubmit={vi.fn()} />);

    fill(type("Vehicle number"), "TN");
    expect(screen.queryByText(/looks too short/i)).not.toBeInTheDocument();
  });

  it("clears an error as soon as the field is corrected", async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);

    next();
    expect(screen.getByText(/Please enter your vehicle number/)).toBeInTheDocument();

    fill(type("Vehicle number"), "TN 09 AB 1234");
    expect(screen.queryByText(/Please enter your vehicle number/)).not.toBeInTheDocument();
  });

  it("walks all the way to the review step", async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);

    completeVehicleStep();
    expect(screen.getByText("Who insures it?")).toBeInTheDocument();

    completeInsurerStep();
    expect(screen.getByText("What kind of cover?")).toBeInTheDocument();

    click(screen.getByTestId("choice-policyType-COMPREHENSIVE"));
    next();
    expect(screen.getByText("When does it run out?")).toBeInTheDocument();
  });

  it("keeps what was typed when going back", async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);

    completeVehicleStep();
    click(screen.getByRole("button", { name: /back/i }));

    expect(type("Vehicle number")).toHaveValue("TN 09 AB 1234");
    expect(screen.getByTestId("choice-vehicleType-BIKE")).toHaveAttribute("data-selected", "true");
  });

  it("calls onCancel from the first step rather than going nowhere", async () => {
    const onCancel = vi.fn();
    render(<PolicyWizard onSubmit={vi.fn()} onCancel={onCancel} />);

    click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("the cover-type step", () => {
  it("explains each option rather than just naming it", async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);
    completeVehicleStep();
    completeInsurerStep();

    // The whole difficulty is that people do not know what these words mean, so
    // the explanation is on the card and not behind a dropdown.
    expect(screen.getByText(/This is the minimum the law requires/)).toBeInTheDocument();
    expect(screen.getByText(/including theft/)).toBeInTheDocument();
  });

  it('offers "I am not sure" as an ordinary answer', async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);
    completeVehicleStep();
    completeInsurerStep();

    expect(screen.getByText("I'm not sure")).toBeInTheDocument();
    click(screen.getByTestId("choice-policyType-UNKNOWN"));
    next();

    expect(screen.getByText("When does it run out?")).toBeInTheDocument();
  });
});

describe("the extras step", () => {
  it("can be skipped without answering anything", async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);

    completeVehicleStep();
    completeInsurerStep();
    click(screen.getByTestId("choice-policyType-THIRD_PARTY"));
    next();

    fill(named("expiryDate"), "2026-12-31");
    next();

    expect(screen.getByText("Anything else?")).toBeInTheDocument();
    next();
    expect(screen.getByText("Does this look right?")).toBeInTheDocument();
  });
});

describe("review and save", () => {
  function reachReview() {
    completeVehicleStep();
    completeInsurerStep();
    click(screen.getByTestId("choice-policyType-COMPREHENSIVE"));
    next();
    fill(named("expiryDate"), "2026-12-31");
    next();
    next();
  }

  it("shows back everything that was entered", async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);
    reachReview();

    expect(screen.getByText("TN 09 AB 1234")).toBeInTheDocument();
    expect(screen.getByText("Bharat General")).toBeInTheDocument();
    expect(screen.getByText("Comprehensive")).toBeInTheDocument();
    expect(screen.getByText("2026-12-31")).toBeInTheDocument();
  });

  it("lets any row be corrected in place", async () => {
    // A review that can only be accepted or abandoned is not a review.
    render(<PolicyWizard onSubmit={vi.fn()} />);
    reachReview();

    const rows = screen.getAllByRole("button", { name: /change/i });
    click(rows[0]);
    expect(screen.getByText("Which vehicle?")).toBeInTheDocument();
  });

  it("submits the shape the API expects", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PolicyWizard onSubmit={onSubmit} />);
    reachReview();

    click(screen.getByTestId("wizard-submit"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      insurer: "Bharat General",
      policyNumber: "POL/2026/000123",
      policyType: "COMPREHENSIVE",
      expiryDate: "2026-12-31",
      vehicle: { registrationNumber: "TN 09 AB 1234", vehicleType: "BIKE" },
    });
  });

  it("keeps the whole form when saving fails", async () => {
    // Losing a filled-in form to a network blip is how people stop coming back.
    const onSubmit = vi.fn().mockRejectedValue(new Error("The network dropped."));
    render(<PolicyWizard onSubmit={onSubmit} />);
    reachReview();

    click(screen.getByTestId("wizard-submit"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The network dropped."));
    expect(screen.getByText("TN 09 AB 1234")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-submit")).not.toBeDisabled();
  });

  it("sends somebody back to the field they broke rather than reporting it from afar", async () => {
    render(<PolicyWizard onSubmit={vi.fn()} />);
    reachReview();

    // Go back and clear a required field, then walk forward and submit.
    const rows = screen.getAllByRole("button", { name: /change/i });
    click(rows[0]);
    fill(type("Vehicle number"), "");
    for (let i = 0; i < 5; i += 1) {
      const next = screen.queryByTestId("wizard-next");
      if (next) click(next);
    }

    // It refuses to leave step one, which is where the problem actually is.
    expect(screen.getByText("Which vehicle?")).toBeInTheDocument();
    expect(screen.getByText(/Please enter your vehicle number/)).toBeInTheDocument();
  });
});

describe("correcting a policy that is already saved", () => {
  const saved: EditablePolicy = {
    insurer: "Bharat General",
    policyType: "COMPREHENSIVE",
    startDate: "2025-12-31",
    expiryDate: "2026-12-31",
    idv: 65000,
    ncbPercent: 25,
    vehicle: {
      registrationNumber: "TN 09 AB 1234",
      vehicleType: "BIKE",
      make: "Hero",
      model: "Splendor",
    },
  };

  const renderEdit = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
    render(
      <PolicyWizard
        mode="edit"
        initialDraft={draftFromPolicy(saved)}
        policyNumberMasked="••••1234"
        onSubmit={onSubmit}
      />
    );
    return onSubmit;
  };

  /** Walk to the review screen without changing anything. */
  const reachReview = () => {
    for (let i = 0; i < 5; i += 1) next();
  };

  it("opens with what is already stored, not an empty form", () => {
    renderEdit();
    expect(type("Vehicle number")).toHaveValue("TN 09 AB 1234");
    expect(screen.getByTestId("choice-vehicleType-BIKE")).toHaveAttribute("data-selected", "true");
  });

  it("walks straight through without re-asking anything", () => {
    // Nothing was changed, so no step may block. A correction form that demands
    // re-entry of answers it already has is one people abandon.
    renderEdit();
    reachReview();
    expect(screen.getByText("Does this look right?")).toBeInTheDocument();
  });

  it("says the policy number is still held rather than showing an empty box", () => {
    renderEdit();
    next();
    expect(type("Policy number")).toHaveValue("");
    expect(screen.getByText(/We already hold this one \(••••1234\)/)).toBeInTheDocument();
  });

  it("shows the number as kept on the review screen", () => {
    renderEdit();
    reachReview();
    expect(screen.getByText("Kept as it is")).toBeInTheDocument();
  });

  it("saves without the policy number when it was not retyped", async () => {
    const onSubmit = renderEdit();
    reachReview();
    click(screen.getByTestId("wizard-submit"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect("policyNumber" in payload).toBe(false);
    expect(payload).toMatchObject({
      insurer: "Bharat General",
      policyType: "COMPREHENSIVE",
      expiryDate: "2026-12-31",
      vehicle: { registrationNumber: "TN 09 AB 1234", vehicleType: "BIKE" },
    });
  });

  it("sends a corrected expiry date", async () => {
    const onSubmit = renderEdit();
    next();
    next();
    next();
    fill(named("expiryDate"), "2027-03-01");
    next();
    next();
    click(screen.getByTestId("wizard-submit"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ expiryDate: "2027-03-01" });
  });

  it("still refuses to let the expiry date be cleared", () => {
    renderEdit();
    next();
    next();
    next();
    fill(named("expiryDate"), "");
    next();

    expect(screen.getByText("When does it run out?")).toBeInTheDocument();
    expect(screen.getByText(/We need the expiry date/)).toBeInTheDocument();
  });

  it("offers to save changes rather than to save a new policy", () => {
    renderEdit();
    reachReview();
    expect(screen.getByTestId("wizard-submit")).toHaveTextContent("Save these changes");
  });
});
