/**
 * The OTP step has somewhere to type.
 *
 * The defect this pins: the six digit boxes were derived with
 * `value.padEnd(6, "")` — an *empty* pad string, which JavaScript ignores, so
 * `"".padEnd(6, "")` is still `""`. The array was empty, no inputs rendered,
 * and after "Send OTP" the customer was shown a card with a phone number, a
 * "Resend OTP" link, a "Verify Both OTPs" button, and no way whatsoever to
 * enter an OTP. Pressing verify then told them the OTP was incorrect.
 *
 * A page that cannot be used at all is the kind of thing a rendering test
 * catches and a logic test never does, so this asserts on the boxes.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/context/PurchaseContext", () => ({
  usePurchase: () => ({
    state: { customerDetails: { mobile: "6384306351", email: "ravi@example.com" } },
    setOtpDone: vi.fn(),
  }),
}));

import OTPPage from "./page";

afterEach(cleanup);

/** The digit boxes are the only single-character inputs on the page. */
const digitBoxes = () =>
  screen.getAllByRole("textbox").filter(el => el.getAttribute("maxlength") === "1");

const sendBoth = () => {
  const sendButtons = screen.getAllByRole("button", { name: /send otp/i });
  sendButtons.forEach(b => fireEvent.click(b));
};

describe("the OTP step", () => {
  it("offers six empty boxes for each channel once the OTP is sent", () => {
    render(<OTPPage />);
    sendBoth();
    // Six for mobile, six for email. Zero was the bug.
    expect(digitBoxes()).toHaveLength(12);
    digitBoxes().forEach(box => expect(box).toHaveValue(""));
  });

  it("keeps all six boxes while the customer is part-way through typing", () => {
    render(<OTPPage />);
    sendBoth();
    const boxes = digitBoxes();

    fireEvent.change(boxes[0], { target: { value: "1" } });
    fireEvent.change(boxes[1], { target: { value: "2" } });

    // `padEnd` with an empty pad also shrank the row as it filled — two digits
    // typed meant two boxes left. The count must not move.
    expect(digitBoxes()).toHaveLength(12);
    expect(digitBoxes()[0]).toHaveValue("1");
    expect(digitBoxes()[1]).toHaveValue("2");
  });

  it("takes a full six-digit code and accepts the demo OTP", async () => {
    render(<OTPPage />);
    sendBoth();

    digitBoxes().forEach((box, i) => {
      fireEvent.change(box, { target: { value: "123456"[i % 6] } });
    });

    fireEvent.click(screen.getByRole("button", { name: /verify both otps/i }));

    expect(screen.queryByText(/is incorrect/i)).toBeNull();
    // The success panel is held back by a 400ms timer, so this has to wait.
    expect(await screen.findByText(/both otps verified/i)).toBeInTheDocument();
  });

  it("still rejects a wrong code", () => {
    render(<OTPPage />);
    sendBoth();

    digitBoxes().forEach(box => {
      fireEvent.change(box, { target: { value: "9" } });
    });

    fireEvent.click(screen.getByRole("button", { name: /verify both otps/i }));
    expect(screen.getByText(/is incorrect/i)).toBeInTheDocument();
  });
});
