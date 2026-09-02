/**
 * Aegis Kural Lite, on screen.
 *
 * Most of what matters here is about honesty rather than function. The three
 * outcomes have to look different, the limits have to be visible before the
 * first question rather than after a failure, and every reply has to end with an
 * offer of a person — none of which a component can be trusted to keep doing
 * once somebody rearranges it.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AskPanel } from "./AskPanel";
import type { KuralAnswer, KuralTopics } from "@/services/api";

const getKuralTopics = vi.fn();
const askKural = vi.fn();

vi.mock("@/services/api", () => ({
  consumerService: {
    getKuralTopics: (...a: unknown[]) => getKuralTopics(...a),
    askKural: (...a: unknown[]) => askKural(...a),
  },
}));

const SCOPE = "This is general information about motor insurance, not a statement about your own policy.";
const CTA = "Would you like a person to go through this with you?";
const DISCLAIMER = "Guidance only.";

const topics: KuralTopics = {
  intro: "Ask me about motor insurance basics. I answer from a small set of checked notes.",
  topics: [
    { topic: "POLICY_EXPIRY", title: "When does my policy run out?" },
    { topic: "COVER_TYPES", title: "Third-party or comprehensive?" },
    { topic: "IDV", title: "What is IDV?" },
    { topic: "NCB", title: "What is a no-claim bonus?" },
    { topic: "ZERO_DEPRECIATION", title: "What is zero depreciation?" },
    { topic: "RENEWAL_STEPS", title: "How do I renew?" },
  ],
  scopeNote: SCOPE,
  humanCta: CTA,
  disclaimer: DISCLAIMER,
  copyVersion: "v1",
};

const answer = (over: Partial<KuralAnswer> = {}): KuralAnswer => ({
  outcome: "ANSWERED",
  topic: "IDV",
  answer: "IDV stands for Insured Declared Value.",
  aboutYourPolicy: null,
  source: { kind: "aegis-editorial", reference: "Definitional." },
  scopeNote: SCOPE,
  disclaimer: DISCLAIMER,
  humanCta: CTA,
  suggestions: [],
  copyVersion: "v1",
  ...over,
});

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText(/ask about motor insurance/i), { target: { value } });
const send = () => fireEvent.click(screen.getByTestId("kural-send"));

const ask = async (question: string) => {
  type(question);
  send();
  await waitFor(() => expect(askKural).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  getKuralTopics.mockResolvedValue(topics);
  askKural.mockResolvedValue(answer());
});

describe("before the first question", () => {
  it("names all six things it can answer", async () => {
    // A customer who has to discover the boundary by hitting it has already
    // been told the product does not work.
    render(<AskPanel />);

    await waitFor(() => expect(screen.getByTestId("kural-intro")).toBeInTheDocument());
    for (const topic of topics.topics) {
      expect(screen.getByTestId(`kural-topic-${topic.topic}`)).toHaveTextContent(topic.title);
    }
  });

  it("says up front that it answers from checked notes", async () => {
    render(<AskPanel />);
    await waitFor(() => expect(screen.getByText(/checked notes/i)).toBeInTheDocument());
  });

  it("still offers the box when the suggestions cannot be loaded", async () => {
    // Somebody who knows what they want to ask can still ask it.
    getKuralTopics.mockRejectedValue(new Error("The network dropped."));
    render(<AskPanel />);

    await waitFor(() => expect(screen.getByTestId("kural-send")).toBeInTheDocument());
    expect(screen.getByLabelText(/ask about motor insurance/i)).toBeInTheDocument();
  });

  it("asks a topic when its chip is tapped", async () => {
    render(<AskPanel />);
    await waitFor(() => expect(screen.getByTestId("kural-topic-IDV")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("kural-topic-IDV"));

    await waitFor(() => expect(askKural).toHaveBeenCalledWith("What is IDV?", expect.anything()));
  });

  it("will not send an empty question", () => {
    render(<AskPanel />);
    expect(screen.getByTestId("kural-send")).toBeDisabled();
    type("   ");
    expect(screen.getByTestId("kural-send")).toBeDisabled();
  });
});

describe("an answer", () => {
  it("shows the answer, where it came from, and the disclaimer", async () => {
    render(<AskPanel />);
    await ask("what is idv");

    await waitFor(() => expect(screen.getByTestId("kural-answer")).toBeInTheDocument());
    expect(screen.getByTestId("kural-answer")).toHaveAttribute("data-outcome", "ANSWERED");
    expect(screen.getByText(/Insured Declared Value/)).toBeInTheDocument();
    expect(screen.getByTestId("kural-source")).toBeInTheDocument();
    expect(screen.getByTestId("kural-scope-note")).toHaveTextContent(
      "not a statement about your own policy"
    );
    expect(screen.getByTestId("kural-scope-note")).toHaveTextContent("Guidance only.");
  });

  it("always ends with an offer of a person", async () => {
    render(<AskPanel />);
    await ask("what is idv");

    await waitFor(() => expect(screen.getByTestId("kural-human-cta")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /talk to a person/i })).toBeInTheDocument();
  });

  it("keeps the question on screen beside its answer", async () => {
    render(<AskPanel />);
    await ask("what is idv");

    await waitFor(() => expect(screen.getByText("what is idv")).toBeInTheDocument());
  });

  it("clears the box so the next question can be typed", async () => {
    render(<AskPanel />);
    await ask("what is idv");

    await waitFor(() =>
      expect(screen.getByLabelText(/ask about motor insurance/i)).toHaveValue("")
    );
  });

  it("shows what the renewal engine says when the answer is about their own policy", async () => {
    askKural.mockResolvedValue(
      answer({
        topic: "POLICY_EXPIRY",
        aboutYourPolicy: {
          status: "Your policy expires in a few days.",
          nextAction: "Renew now.",
          expiryDate: "2026-09-07",
        },
      })
    );
    render(<AskPanel policyId="pol-1" />);
    await ask("when does my policy expire");

    await waitFor(() =>
      expect(screen.getByTestId("kural-about-your-policy")).toHaveTextContent(
        "Your policy expires in a few days."
      )
    );
    expect(askKural.mock.calls[0][1]).toMatchObject({ policyId: "pol-1" });
  });

  it("shows nothing personal when the answer is general", async () => {
    render(<AskPanel policyId="pol-1" />);
    await ask("what is idv");

    await waitFor(() => expect(screen.getByTestId("kural-answer")).toBeInTheDocument());
    expect(screen.queryByTestId("kural-about-your-policy")).not.toBeInTheDocument();
  });

  it("offers a related topic and asks it when tapped", async () => {
    askKural.mockResolvedValue(
      answer({ suggestions: [{ topic: "NCB", title: "What is a no-claim bonus?" }] })
    );
    render(<AskPanel />);
    await ask("what is idv");

    await waitFor(() => expect(screen.getByTestId("kural-suggestion-NCB")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("kural-suggestion-NCB"));

    await waitFor(() => expect(askKural).toHaveBeenCalledTimes(2));
    expect(askKural.mock.calls[1][0]).toBe("What is a no-claim bonus?");
  });
});

describe("when it does not know", () => {
  it("draws a refusal differently from an answer", async () => {
    // Rendering them alike teaches somebody to keep rephrasing a question that
    // was never going to be answered.
    askKural.mockResolvedValue(
      answer({
        outcome: "NO_MATCH",
        topic: null,
        answer: "I do not have a checked answer for that one.",
        source: null,
      })
    );
    render(<AskPanel />);
    await ask("does my policy cover flood damage");

    await waitFor(() => expect(screen.getByTestId("kural-answer")).toBeInTheDocument());
    expect(screen.getByTestId("kural-answer")).toHaveAttribute("data-outcome", "NO_MATCH");
    expect(screen.queryByTestId("kural-source")).not.toBeInTheDocument();
  });

  it("still offers a person, which is the actual answer", async () => {
    askKural.mockResolvedValue(
      answer({ outcome: "NO_MATCH", topic: null, answer: "I do not have a checked answer.", source: null })
    );
    render(<AskPanel />);
    await ask("can i claim for a windscreen");

    await waitFor(() => expect(screen.getByTestId("kural-human-cta")).toBeInTheDocument());
  });

  it("draws an unreadable question differently again", async () => {
    askKural.mockResolvedValue(
      answer({ outcome: "UNREADABLE", topic: null, answer: "I could not read that as a question.", source: null })
    );
    render(<AskPanel />);
    await ask("?????");

    await waitFor(() =>
      expect(screen.getByTestId("kural-answer")).toHaveAttribute("data-outcome", "UNREADABLE")
    );
  });
});

describe("when the assistant cannot be reached", () => {
  it("says so, rather than appearing to have answered", async () => {
    askKural.mockRejectedValue(new Error("Network Error"));
    render(<AskPanel />);
    await ask("what is idv");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not reach/i));
    expect(screen.queryByTestId("kural-answer")).not.toBeInTheDocument();
  });

  it("shows the API's own sentence when it sent one", async () => {
    askKural.mockRejectedValue({
      response: { data: { message: "That is longer than we can read." } },
    });
    render(<AskPanel />);
    await ask("x".repeat(20));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("That is longer than we can read.")
    );
  });

  it("keeps the question so it is not retyped", async () => {
    askKural.mockRejectedValue(new Error("Network Error"));
    render(<AskPanel />);
    await ask("what is idv");

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByLabelText(/ask about motor insurance/i)).toHaveValue("what is idv");
  });

  it("does not send a second question while one is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    askKural.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    render(<AskPanel />);

    type("what is idv");
    send();

    await waitFor(() => expect(screen.getByTestId("kural-send")).toBeDisabled());
    release(answer());
  });
});
