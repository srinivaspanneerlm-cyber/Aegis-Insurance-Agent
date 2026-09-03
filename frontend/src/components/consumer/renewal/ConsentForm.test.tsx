/**
 * The consent screen.
 *
 * Every assertion here is about the same thing: that agreeing was an action
 * somebody took, and not a side effect of finishing a form. A pre-ticked box, a
 * "by continuing you agree", or an agreement on a later step would each pass a
 * casual read of this component and fail the only question that matters about
 * it afterwards.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConsentForm } from "./ConsentForm";
import { CONSENT_TEXT } from "@/lib/consumer/renewal";

const onSubmit = vi.fn();

const click = (element: Element) => fireEvent.click(element);
const submit = () => screen.getByTestId("consent-submit");
const box = (name: string) => document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
const phone = () => document.querySelector('input[name="contactPhone"]') as HTMLInputElement | null;

const chooseCall = () => click(screen.getByTestId("channel-CALL"));
const chooseEmail = () => click(screen.getByTestId("channel-EMAIL"));
const agree = () => fireEvent.click(box("agreed"));
const typePhone = (value: string) =>
  fireEvent.change(phone() as HTMLInputElement, { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  onSubmit.mockResolvedValue(undefined);
});

describe("what a customer is shown before agreeing", () => {
  it("shows the whole agreement on the screen, not behind a link", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    expect(screen.getByTestId("consent-text")).toHaveTextContent(CONSENT_TEXT.RENEWAL_ASSISTANCE.en);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says nothing is sent automatically, on the same screen", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    expect(screen.getByTestId("consent-explainer")).toHaveTextContent(/Nothing is sent automatically/i);
    expect(screen.getByTestId("consent-explainer")).toHaveTextContent(/WhatsApp/);
  });

  it("offers all three channels with what each one means", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    for (const id of ["CALL", "WHATSAPP", "EMAIL"]) {
      expect(screen.getByTestId(`channel-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByText(/Someone rings you/i)).toBeInTheDocument();
  });

  it("renders in Tamil when asked to", () => {
    render(<ConsentForm locale="ta" onSubmit={onSubmit} />);
    expect(screen.getByTestId("consent-text")).toHaveTextContent(
      CONSENT_TEXT.RENEWAL_ASSISTANCE.ta as string
    );
  });
});

describe("the agreement is an action, not a default", () => {
  it("starts unticked", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    expect(box("agreed")).not.toBeChecked();
    expect(box("alsoRemind")).not.toBeChecked();
  });

  it("cannot be sent until it has been ticked", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseEmail();
    expect(submit()).toBeDisabled();

    agree();
    expect(submit()).toBeEnabled();
  });

  it("cannot be sent without choosing a channel either", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    agree();
    expect(submit()).toBeDisabled();
  });

  it("sends the agreement explicitly rather than implying it", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseEmail();
    agree();
    click(submit());

    return waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ preferredChannel: "EMAIL", agreed: true })
      );
    });
  });

  it("keeps the reminder a second, separate decision", () => {
    // Being helped once and being contacted every year are different asks. The
    // API stores them as two records for exactly this reason.
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseEmail();
    agree();
    click(submit());

    return waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ alsoRemind: false }))
    );
  });

  it("sends the reminder only when it was ticked", async () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseEmail();
    agree();
    fireEvent.click(box("alsoRemind"));
    click(submit());

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ alsoRemind: true }))
    );
  });
});

describe("the number", () => {
  it("is asked for only when the channel needs one", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    expect(phone()).toBeNull();

    chooseEmail();
    expect(phone()).toBeNull();

    chooseCall();
    expect(phone()).not.toBeNull();
  });

  it("holds the request back until it is given", () => {
    // A queue row saying "ring them" with nothing to ring is a row nobody can
    // work, and the customer waits for a call that never comes.
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseCall();
    agree();
    expect(submit()).toBeDisabled();

    typePhone("+91 98400 12345");
    expect(submit()).toBeEnabled();
  });

  it("is not fooled by a few digits", () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseCall();
    agree();
    typePhone("123");
    expect(submit()).toBeDisabled();
  });

  it("accepts a number however it was punctuated", async () => {
    // Numbers arrive with spaces, dashes, a country code or none. Refusing one
    // over its punctuation is how this flow loses people.
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseCall();
    agree();
    typePhone("044-2841 9000");
    click(submit());

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ contactPhone: "044-2841 9000" })
      )
    );
  });

  it("is not sent at all when they chose email", async () => {
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseEmail();
    agree();
    click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("contactPhone");
  });
});

describe("when sending fails", () => {
  it("shows the API's own sentence and keeps everything they chose", async () => {
    onSubmit.mockRejectedValue({
      response: { data: { message: "Please give us a number to reach you on." } },
    });
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseEmail();
    agree();
    click(submit());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Please give us a number to reach you on.")
    );
    expect(box("agreed")).toBeChecked();
    expect(screen.getByTestId("channel-EMAIL")).toHaveAttribute("data-selected", "true");
  });

  it("falls back to a plain sentence when the network drops", async () => {
    onSubmit.mockRejectedValue(new Error("Network Error"));
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseEmail();
    agree();
    click(submit());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not send/i));
  });

  it("does not start a second request while one is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    onSubmit.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    render(<ConsentForm onSubmit={onSubmit} />);
    chooseEmail();
    agree();
    click(submit());

    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveTextContent(/Sending/);
    release(undefined);
  });
});
