import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Input, Field } from "./Input";

afterEach(cleanup);

describe("Input", () => {
  it("sets aria-invalid only when invalid", () => {
    const { rerender } = render(<Input placeholder="Name" />);
    expect(screen.getByPlaceholderText("Name").getAttribute("aria-invalid")).toBeNull();
    rerender(<Input placeholder="Name" invalid />);
    expect(screen.getByPlaceholderText("Name").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("Field", () => {
  it("binds the label to the control via a shared id", () => {
    render(
      <Field label="Email">
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} aria-describedby={describedBy} placeholder="e" />
        )}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toBe(screen.getByPlaceholderText("e"));
  });

  it("shows the error, marks the control invalid, and wires aria-describedby", () => {
    render(
      <Field label="Email" error="Required">
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} aria-describedby={describedBy} placeholder="e" />
        )}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const error = screen.getByText("Required");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.getAttribute("id"));
  });

  it("shows a hint when there is no error", () => {
    render(
      <Field label="Phone" hint="For OTP only">
        {({ id }) => <Input id={id} />}
      </Field>,
    );
    expect(screen.getByText("For OTP only")).toBeTruthy();
  });
});
