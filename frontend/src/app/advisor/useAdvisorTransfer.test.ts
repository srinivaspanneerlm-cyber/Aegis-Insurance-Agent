import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { TransferSuggestion, InterruptSuggestion } from "@/hooks/useStreaming";
import { useAdvisorTransfer } from "./useAdvisorTransfer";

const transfer = (over: Partial<TransferSuggestion> = {}): TransferSuggestion => ({
  fromAgentName: "Sri AI",
  fromDomain: "executive",
  transferTo: "health",
  transferToName: "Sarah AI",
  transferReason: "Health cover is Sarah's specialty.",
  ...over,
});

const interrupt = (over: Partial<InterruptSuggestion> = {}): InterruptSuggestion => ({
  fromAgentName: "Sarah AI",
  fromDomain: "health",
  fromLabel: "Health",
  transferTo: "motor",
  transferToName: "Alex AI",
  transferToLabel: "Motor",
  ...over,
});

const setup = () => renderHook(() => useAdvisorTransfer());

describe("useAdvisorTransfer — initial state", () => {
  it("opens with no dialog, no overlay and nowhere to go back to", () => {
    const { result } = setup();
    expect(result.current.transferRequest).toBeNull();
    expect(result.current.interruptRequest).toBeNull();
    expect(result.current.connectingTo).toBeNull();
    expect(result.current.previousAdvisorCategory).toBeNull();
  });

  it("queues nothing for the first message", () => {
    const { result } = setup();
    let pending;
    act(() => { pending = result.current.consumePending(); });
    expect(pending).toEqual({ forceTransferTo: undefined });
  });
});

describe("suggest → dialog", () => {
  it("opens the transfer dialog on a suggestion", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    expect(result.current.transferRequest).toMatchObject({ toName: "Sarah AI", toDomain: "health" });
  });

  it("opens the interrupt dialog on a mid-workflow switch", () => {
    const { result } = setup();
    act(() => result.current.suggestInterrupt(interrupt(), "health"));
    expect(result.current.interruptRequest).toMatchObject({ toName: "Alex AI", fromLabel: "Health" });
  });

  it("ignores a suggestion for a domain with no advisor", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer({ transferTo: "pet" }), "miscellaneous"));
    expect(result.current.transferRequest).toBeNull();
  });
});

describe("confirming a transfer", () => {
  it("queues the forced transfer for exactly the next message", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    act(() => { result.current.confirmTransfer("I need family cover"); });

    let first, second;
    act(() => { first = result.current.consumePending(); });
    act(() => { second = result.current.consumePending(); });

    expect(first).toMatchObject({ forceTransferTo: "health" });
    // One-shot: the handoff must not leak into the message after it.
    expect(second).toMatchObject({ forceTransferTo: undefined });
  });

  it("returns the user's real question as the prompt to send", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    let prompt;
    act(() => { prompt = result.current.confirmTransfer("I need family cover"); });
    expect(prompt).toBe("I need family cover");
  });

  it("falls back to a connect request when there is no user message", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    let prompt;
    act(() => { prompt = result.current.confirmTransfer(""); });
    expect(prompt).toBe("Please connect me with Sarah AI.");
  });

  it("closes the dialog and raises the connecting overlay", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    act(() => { result.current.confirmTransfer("hi"); });
    expect(result.current.transferRequest).toBeNull();
    expect(result.current.connectingTo).toMatchObject({ name: "Sarah AI", avatar: "S" });
  });

  it("does nothing when no dialog is open", () => {
    const { result } = setup();
    let prompt;
    act(() => { prompt = result.current.confirmTransfer("hello"); });
    expect(prompt).toBeNull();
    let pending;
    act(() => { pending = result.current.consumePending(); });
    expect(pending).toMatchObject({ forceTransferTo: undefined });
  });

  it("approving does NOT block the domain — only declining does", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    act(() => { result.current.confirmTransfer("hi"); });
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    expect(result.current.transferRequest).not.toBeNull();
  });
});

describe("declining a transfer — Rule 13", () => {
  it("blocks that domain from ever asking again this session", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    act(() => { result.current.declineTransfer(); });

    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    expect(result.current.transferRequest).toBeNull();
  });

  it("blocks the domain across dialog types — a declined transfer stops the interrupt too", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer({ transferTo: "motor", transferToName: "Alex AI" }), "miscellaneous"));
    act(() => { result.current.declineTransfer(); });

    act(() => result.current.suggestInterrupt(interrupt(), "health"));
    expect(result.current.interruptRequest).toBeNull();
  });

  it("leaves other domains free to ask", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    act(() => { result.current.declineTransfer(); });

    act(() => result.current.suggestTransfer(transfer({ transferTo: "motor", transferToName: "Alex AI" }), "miscellaneous"));
    expect(result.current.transferRequest).toMatchObject({ toDomain: "motor" });
  });

  it("returns the staying agent's acknowledgement, attributed to that agent", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    let reply;
    act(() => { reply = result.current.declineTransfer(); });
    expect(reply).toEqual({
      text: expect.stringContaining("Sarah's expertise"),
      agentName: "Sri AI",
      agentDomain: "executive",
    });
  });

  it("queues no transfer and raises no overlay", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    act(() => { result.current.declineTransfer(); });
    expect(result.current.connectingTo).toBeNull();
    let pending;
    act(() => { pending = result.current.consumePending(); });
    expect(pending).toMatchObject({ forceTransferTo: undefined });
  });

  it("does nothing when no dialog is open", () => {
    const { result } = setup();
    let reply;
    act(() => { reply = result.current.declineTransfer(); });
    expect(reply).toBeNull();
  });
});

describe("interrupt confirm / decline", () => {
  it("queues the switch and returns the prompt", () => {
    const { result } = setup();
    act(() => result.current.suggestInterrupt(interrupt(), "health"));
    let prompt;
    act(() => { prompt = result.current.confirmInterrupt(""); });
    expect(prompt).toBe("Please switch me to Alex AI.");

    let pending;
    act(() => { pending = result.current.consumePending(); });
    expect(pending).toMatchObject({ forceTransferTo: "motor" });
  });

  it("declining resumes the paused workflow and blocks the domain", () => {
    const { result } = setup();
    act(() => result.current.suggestInterrupt(interrupt(), "health"));
    let reply;
    act(() => { reply = result.current.declineInterrupt(); });
    expect(reply).toEqual({
      text: expect.stringContaining("your Health Insurance consultation"),
      agentName: "Sarah AI",
      agentDomain: "health",
    });

    act(() => result.current.suggestInterrupt(interrupt(), "health"));
    expect(result.current.interruptRequest).toBeNull();
  });

  // The orchestrator needs the refusal too. Without it, it re-detects the
  // switch and replies with the suggestion template instead of answering —
  // and the UI suppresses that dialog, leaving the question unanswerable.
  it("reports a declined interrupt domain to the orchestrator", () => {
    const { result } = setup();
    act(() => result.current.suggestInterrupt(interrupt(), "health"));
    act(() => { result.current.declineInterrupt(); });
    expect(result.current.getDeclinedDomains()).toEqual(["motor"]);
  });

  it("reports a declined transfer domain too", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    act(() => { result.current.declineTransfer(); });
    expect(result.current.getDeclinedDomains()).toEqual(["health"]);
  });

  it("keeps the refusal for the whole session, not just the next message", () => {
    const { result } = setup();
    act(() => result.current.suggestInterrupt(interrupt(), "health"));
    act(() => { result.current.declineInterrupt(); });

    act(() => { result.current.consumePending(); });
    act(() => { result.current.consumePending(); });
    // Still declined after later messages — this is the bug the old one-shot
    // flag could not express.
    expect(result.current.getDeclinedDomains()).toEqual(["motor"]);
  });

  it("accumulates every refusal without duplicating one", () => {
    const { result } = setup();
    act(() => result.current.suggestInterrupt(interrupt(), "health"));
    act(() => { result.current.declineInterrupt(); });
    act(() => result.current.suggestInterrupt(interrupt({ transferTo: "travel", transferToName: "Ethan AI" }), "health"));
    act(() => { result.current.declineInterrupt(); });
    expect(result.current.getDeclinedDomains().sort()).toEqual(["motor", "travel"]);
  });

  it("reports nothing declined before the user refuses anything", () => {
    const { result } = setup();
    expect(result.current.getDeclinedDomains()).toEqual([]);
  });
});

describe("return to previous advisor — Rule 6", () => {
  it("stays hidden until a transfer reports where the user came from", () => {
    const { result } = setup();
    expect(result.current.previousAdvisorCategory).toBeNull();
    act(() => result.current.recordPreviousAgent("home-property"));
    expect(result.current.previousAdvisorCategory).toBe("property");
  });

  it("ignores an unknown previous domain", () => {
    const { result } = setup();
    act(() => result.current.recordPreviousAgent("pet"));
    expect(result.current.previousAdvisorCategory).toBeNull();
  });

  it("queues the previous advisor's domain and clears the pill", () => {
    const { result } = setup();
    act(() => result.current.recordPreviousAgent("home-property"));
    let prompt;
    act(() => { prompt = result.current.returnToPrevious(); });

    expect(prompt).toBe("Please reconnect me to Emma AI.");
    expect(result.current.previousAdvisorCategory).toBeNull();

    let pending;
    act(() => { pending = result.current.consumePending(); });
    // 'property' is the UI category; the backend domain is 'home-property'.
    expect(pending).toMatchObject({ forceTransferTo: "home-property" });
  });

  it("does nothing when there is nowhere to go back to", () => {
    const { result } = setup();
    let prompt;
    act(() => { prompt = result.current.returnToPrevious(); });
    expect(prompt).toBeNull();
  });
});

describe("connecting overlay", () => {
  it("comes down when the stream goes live", () => {
    const { result } = setup();
    act(() => result.current.suggestTransfer(transfer(), "miscellaneous"));
    act(() => { result.current.confirmTransfer("hi"); });
    expect(result.current.connectingTo).not.toBeNull();

    act(() => result.current.dismissConnecting());
    expect(result.current.connectingTo).toBeNull();
  });
});
