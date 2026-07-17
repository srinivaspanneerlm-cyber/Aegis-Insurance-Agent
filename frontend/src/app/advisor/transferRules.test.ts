import { describe, it, expect } from "vitest";
import type { TransferSuggestion, InterruptSuggestion } from "@/hooks/useStreaming";
import {
  isDeclined,
  buildTransferRequest,
  buildInterruptRequest,
  buildConnectingAgent,
  transferDeclineMessage,
  interruptDeclineMessage,
  transferConfirmPrompt,
  interruptConfirmPrompt,
  returnToPreviousPrompt,
  resolveAgentNameForDomain,
  resolvePreviousCategory,
} from "./transferRules";

const NONE: ReadonlySet<string> = new Set();

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

describe("isDeclined", () => {
  it("gates only the domain the user actually declined", () => {
    const declined = new Set(["motor"]);
    expect(isDeclined(declined, "motor")).toBe(true);
    expect(isDeclined(declined, "health")).toBe(false);
  });
});

describe("buildTransferRequest", () => {
  it("carries both agents' identity and the reason into the dialog", () => {
    const req = buildTransferRequest(transfer(), "miscellaneous", NONE);
    expect(req).toMatchObject({
      fromName: "Sri AI",
      fromDomain: "executive",
      fromAvatar: "SR",
      toName: "Sarah AI",
      toDomain: "health",
      toAvatar: "S",
      reason: "Health cover is Sarah's specialty.",
    });
  });

  it("themes each side from its own advisor, not the active one", () => {
    const req = buildTransferRequest(transfer(), "miscellaneous", NONE);
    expect(req?.fromTheme).toBe("from-rose-600 to-pink-500");
    expect(req?.toTheme).toBe("from-emerald-600 to-teal-500");
    expect(req?.fromEmoji).toBe("💼");
    expect(req?.toEmoji).toBe("❤️");
  });

  // Rule 13 — the whole point of remembering a decline.
  it("stays silent once the user has declined that domain", () => {
    expect(buildTransferRequest(transfer(), "miscellaneous", new Set(["health"]))).toBeNull();
  });

  it("still offers a different domain after one was declined", () => {
    const req = buildTransferRequest(transfer({ transferTo: "motor", transferToName: "Alex AI" }), "miscellaneous", new Set(["health"]));
    expect(req?.toDomain).toBe("motor");
  });

  it("refuses a target domain the UI has no advisor for", () => {
    expect(buildTransferRequest(transfer({ transferTo: "pet" }), "miscellaneous", NONE)).toBeNull();
  });

  it("falls back to the active category when the source domain is unknown", () => {
    const req = buildTransferRequest(transfer({ fromDomain: "pet" }), "motor", NONE);
    // Source visuals come from the active advisor (Alex), source domain stays raw.
    expect(req?.fromAvatar).toBe("A");
    expect(req?.fromTheme).toBe("from-blue-600 to-cyan-500");
    expect(req?.fromDomain).toBe("pet");
  });

  it("names the target from the advisor config when the backend sends none", () => {
    const req = buildTransferRequest(transfer({ transferToName: "" }), "miscellaneous", NONE);
    expect(req?.toName).toBe("Sarah AI");
  });

  it("maps the home-property domain onto the property advisor", () => {
    const req = buildTransferRequest(transfer({ transferTo: "home-property", transferToName: "" }), "miscellaneous", NONE);
    expect(req?.toName).toBe("Emma AI");
    expect(req?.toDomain).toBe("home-property");
  });
});

describe("buildInterruptRequest", () => {
  it("carries both workflow labels so the dialog can name what is being paused", () => {
    const req = buildInterruptRequest(interrupt(), "health", NONE);
    expect(req).toMatchObject({
      fromName: "Sarah AI",
      fromLabel: "Health",
      fromDomain: "health",
      toName: "Alex AI",
      toLabel: "Motor",
      toDomain: "motor",
    });
  });

  it("applies the same decline gate as a plain transfer", () => {
    expect(buildInterruptRequest(interrupt(), "health", new Set(["motor"]))).toBeNull();
  });

  it("refuses a target domain the UI has no advisor for", () => {
    expect(buildInterruptRequest(interrupt({ transferTo: "pet" }), "health", NONE)).toBeNull();
  });

  it("falls back to the active category when the source domain is unknown", () => {
    const req = buildInterruptRequest(interrupt({ fromDomain: "pet" }), "travel", NONE);
    expect(req?.fromAvatar).toBe("E");
    expect(req?.fromTheme).toBe("from-violet-600 to-purple-500");
  });

  it("names the target from the advisor config when the backend sends none", () => {
    const req = buildInterruptRequest(interrupt({ transferToName: "" }), "health", NONE);
    expect(req?.toName).toBe("Alex AI");
  });
});

describe("buildConnectingAgent", () => {
  it("dresses the overlay in the target advisor's identity", () => {
    expect(buildConnectingAgent("health", "Sarah AI")).toEqual({
      name: "Sarah AI",
      avatar: "S",
      theme: "from-emerald-600 to-teal-500",
      emoji: "❤️",
    });
  });

  it("keeps the display name it was handed rather than the config name", () => {
    expect(buildConnectingAgent("motor", "Alex")?.name).toBe("Alex");
  });

  it("returns null for an unmapped domain so no blank overlay renders", () => {
    expect(buildConnectingAgent("pet", "Nobody")).toBeNull();
  });
});

describe("decline messages", () => {
  // Rule 4 — the agent stays and leaves the door open.
  it("strips the ' AI' suffix when referring to the other specialist", () => {
    const msg = transferDeclineMessage("Sarah AI");
    expect(msg).toContain("Sarah's expertise");
    expect(msg).not.toContain("Sarah AI's");
  });

  it("promises to continue rather than dropping the subject", () => {
    const msg = transferDeclineMessage("Alex AI");
    expect(msg).toContain("I'll continue to assist you here");
    expect(msg).toContain("just let me know");
  });

  it("resumes the paused workflow by name when an interrupt is declined", () => {
    expect(interruptDeclineMessage("Health")).toContain("your Health Insurance consultation");
  });
});

describe("confirm prompts", () => {
  it("replays the user's real question to the new agent", () => {
    expect(transferConfirmPrompt("I need family health cover", "Sarah AI")).toBe("I need family health cover");
    expect(interruptConfirmPrompt("what about my car", "Alex AI")).toBe("what about my car");
  });

  it("falls back to a connect request when there is no user message behind the handoff", () => {
    expect(transferConfirmPrompt("", "Sarah AI")).toBe("Please connect me with Sarah AI.");
  });

  it("falls back to a switch request for an interrupt", () => {
    expect(interruptConfirmPrompt("", "Alex AI")).toBe("Please switch me to Alex AI.");
  });
});

describe("returnToPreviousPrompt", () => {
  it("asks to reconnect to the advisor by name", () => {
    expect(returnToPreviousPrompt("health")).toBe("Please reconnect me to Sarah AI.");
    expect(returnToPreviousPrompt("miscellaneous")).toBe("Please reconnect me to Sri AI.");
  });
});

describe("resolveAgentNameForDomain", () => {
  it("names the agent behind each backend domain", () => {
    expect(resolveAgentNameForDomain("health")).toBe("Sarah AI");
    expect(resolveAgentNameForDomain("home-property")).toBe("Emma AI");
    expect(resolveAgentNameForDomain("executive")).toBe("Sri AI");
  });

  it("falls back to the raw domain so the message is still labelled", () => {
    expect(resolveAgentNameForDomain("pet")).toBe("pet");
  });
});

describe("resolvePreviousCategory", () => {
  it("maps a backend domain back to its sidebar category", () => {
    expect(resolvePreviousCategory("home-property")).toBe("property");
    expect(resolvePreviousCategory("executive")).toBe("miscellaneous");
  });

  it("returns null for an unknown domain so the return pill stays hidden", () => {
    expect(resolvePreviousCategory("pet")).toBeNull();
  });
});
