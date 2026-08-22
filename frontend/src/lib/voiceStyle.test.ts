/**
 * Reading how something was put, without guessing at who put it.
 *
 * The tests that matter most here are the ones about restraint. A detector that
 * fires too eagerly is worse than none: an advisor that starts acknowledging
 * frustration at a customer who was merely brisk, or simplifying for someone
 * who understood perfectly, is patronising in a way that is hard to undo. So
 * roughly half of this file is ordinary sentences that must come back `normal`.
 */
import { describe, it, expect } from "vitest";
import {
  BRIEF_WORD_LIMIT,
  detectSpeakingStyle,
  endsWithQuestion,
  isStopPhrase,
  maxUnspokenCharsFor,
  toRequestMeta,
  type VoiceContext,
} from "./voiceStyle";
import { MAX_UNSPOKEN_CHARS } from "./speech";

describe("wording that has not landed", () => {
  it.each([
    "I don't understand what you just said",
    "Sorry, that's not clear to me at all",
    "What does that even mean, deductible?",
    "Can you explain again in simpler words",
    "I didn't get any of that",
  ])("reads %j as confused", (message) => {
    expect(detectSpeakingStyle(message)).toBe("confused");
  });

  it("reads the Thanglish for it too", () => {
    // These customers say "puriyala" far more often than "I don't understand",
    // and a detector that only spoke English would be deaf to the people this
    // product is actually for.
    expect(detectSpeakingStyle("sorry puriyala, konjam explain pannunga")).toBe("confused");
    expect(detectSpeakingStyle("enakku theriyala what this means")).toBe("confused");
  });

  it("reads Tamil script for it", () => {
    expect(detectSpeakingStyle("மன்னிக்கவும், புரியல")).toBe("confused");
  });
});

describe("wording of a stalled conversation", () => {
  it.each([
    "I already told you my age twice",
    "This still doesn't work",
    "I have asked you this again and again",
    "That's a waste of time, it's not working",
  ])("reads %j as frustrated", (message) => {
    expect(detectSpeakingStyle(message)).toBe("frustrated");
  });

  it("counts repeated punctuation as emphasis", () => {
    expect(detectSpeakingStyle("Just give me the price!!")).toBe("frustrated");
  });

  it("counts sustained capitals as emphasis", () => {
    expect(detectSpeakingStyle("I SAID FIFTY THOUSAND")).toBe("frustrated");
  });

  it("does not read a single capitalised acronym as shouting", () => {
    // "What is my IDV" is a question, not a raised voice.
    expect(detectSpeakingStyle("Please tell me what my IDV would be")).toBe("normal");
  });
});

describe("wording with time pressure", () => {
  it.each([
    "I need this policy urgently",
    "Can you do it immediately please",
    "My trip is tomorrow, I need cover asap",
    "Seekiram sollunga, I have to leave",
  ])("reads %j as urgent", (message) => {
    expect(detectSpeakingStyle(message)).toBe("urgent");
  });
});

describe("short and direct", () => {
  it("reads a terse answer as brief", () => {
    expect(detectSpeakingStyle("Yes go ahead")).toBe("brief");
    expect(detectSpeakingStyle("Thirty five")).toBe("brief");
  });

  it("does not read a short question as terse", () => {
    // A short question is an ordinary question. Answering it in clipped
    // sentences because it was short would be the wrong lesson to draw.
    expect(detectSpeakingStyle("What is a floater?")).toBe("normal");
  });

  it("stops being brief past the word limit", () => {
    const words = Array(BRIEF_WORD_LIMIT + 2).fill("word").join(" ");
    expect(detectSpeakingStyle(words)).toBe("normal");
  });
});

describe("restraint", () => {
  it.each([
    "I would like health insurance for my family",
    "My father is sixty two and my mother is fifty eight",
    "We live in Tirunelveli and my budget is around two thousand a month",
    "Can you tell me what this plan covers for maternity",
    "Thank you, that was helpful",
    "எனக்கு மருத்துவ காப்பீடு வேண்டும்",
    "enakku family health policy venum",
  ])("leaves %j alone", (message) => {
    expect(detectSpeakingStyle(message)).toBe("normal");
  });

  it("treats nothing at all as normal", () => {
    expect(detectSpeakingStyle("")).toBe("normal");
    expect(detectSpeakingStyle(null)).toBe("normal");
    expect(detectSpeakingStyle(undefined)).toBe("normal");
    expect(detectSpeakingStyle("   ")).toBe("normal");
  });

  it("does not fire on a word merely containing a marker", () => {
    // The lesson of the domain-keyword bug: "car" matched inside "care".
    expect(detectSpeakingStyle("I want quick claim settlement history details")).toBe("urgent");
    expect(detectSpeakingStyle("Is there a network hospital in Quickfield Road area")).toBe("normal");
  });
});

describe("precedence", () => {
  it("answers a stalled conversation as stalled, even when it is also urgent", () => {
    // Acknowledging what has not worked is what unblocks it. Answering faster
    // without acknowledging is how a conversation going in circles goes round
    // once more.
    expect(detectSpeakingStyle("I already told you this, I need it urgently")).toBe("frustrated");
  });

  it("answers time pressure before confusion", () => {
    // "Just tell me quickly, I don't follow all this" wants the answer first.
    expect(detectSpeakingStyle("Just tell me quickly, I don't understand all this")).toBe("urgent");
  });
});

describe("the wire form", () => {
  const context: VoiceContext = {
    style: "urgent", language: "ta-en", spoken: true,
    agentName: "Sarah AI", agentDomain: "health",
    conversationState: "Data Collection", intent: "general",
    transcript: "I need this urgently",
  };

  it("sends only what the engine needs", () => {
    // The transcript is already the message; the agent and the stage came from
    // the engine in the first place. Sending them back would be noise.
    expect(toRequestMeta(context)).toEqual({ style: "urgent", language: "ta-en", spoken: true });
  });

  it("omits a language nobody detected", () => {
    expect(toRequestMeta({ ...context, language: null })).toEqual({
      style: "urgent", spoken: true,
    });
  });

  it("sends nothing at all for a typed turn", () => {
    // The guarantee that keeps typed chat unchanged.
    expect(toRequestMeta(null)).toBeNull();
  });
});

describe("delivery", () => {
  it("shortens the chunk a turn under time pressure waits for", () => {
    expect(maxUnspokenCharsFor("urgent", MAX_UNSPOKEN_CHARS)).toBeLessThan(MAX_UNSPOKEN_CHARS);
    expect(maxUnspokenCharsFor("confused", MAX_UNSPOKEN_CHARS)).toBeLessThan(MAX_UNSPOKEN_CHARS);
  });

  it("leaves an ordinary turn at the default", () => {
    expect(maxUnspokenCharsFor("normal", MAX_UNSPOKEN_CHARS)).toBe(MAX_UNSPOKEN_CHARS);
    expect(maxUnspokenCharsFor("brief", MAX_UNSPOKEN_CHARS)).toBe(MAX_UNSPOKEN_CHARS);
  });

  it("never lengthens past the caller's own limit", () => {
    expect(maxUnspokenCharsFor("urgent", 60)).toBeLessThanOrEqual(60);
  });
});

describe("knowing the conversation was handed back", () => {
  it("recognises a reply that ends on a question", () => {
    expect(endsWithQuestion("And how old is the eldest person we're covering?")).toBe(true);
  });

  it("looks past a closing quote", () => {
    expect(endsWithQuestion('Would you like me to show you why?"')).toBe(true);
  });

  it("ignores a plan card appended after the words", () => {
    // The card is always last, and it is not a sentence.
    expect(
      endsWithQuestion('Shall I show you why?\n\n[RECOMMENDATION:{"type":"single_plan"}]')
    ).toBe(true);
  });

  it("does not mistake a statement for a question", () => {
    expect(endsWithQuestion("That plan covers your whole family.")).toBe(false);
    expect(endsWithQuestion("A question mark? Not at the end though.")).toBe(false);
  });

  it("treats a Tamil statement ending in a danda as a statement", () => {
    expect(endsWithQuestion("உங்கள் குடும்பத்திற்கு இது பொருந்தும்।")).toBe(false);
  });

  it("handles nothing at all", () => {
    expect(endsWithQuestion("")).toBe(false);
    expect(endsWithQuestion(null)).toBe(false);
  });
});

describe("a request for silence", () => {
  it.each(["wait", "Wait.", "stop", "Hold on!", "one second", "hang on", "irunga", "இருங்க"])(
    "recognises %j as asking Aegis to stop",
    (message) => {
      expect(isStopPhrase(message)).toBe(true);
    }
  );

  it("recognises the same word repeated", () => {
    // "stop stop stop" is one instruction, not three.
    expect(isStopPhrase("stop stop stop")).toBe(true);
    expect(isStopPhrase("wait wait")).toBe(true);
  });

  it("does not swallow a question that merely opens with one", () => {
    // The word carries no weight once a sentence follows it. Treating this as
    // "be quiet" would drop a real question on the floor.
    expect(isStopPhrase("Wait, does this cover my mother?")).toBe(false);
    expect(isStopPhrase("Actually I wanted to ask about the premium")).toBe(false);
    expect(isStopPhrase("Hold on, let me check my policy number")).toBe(false);
  });

  it("treats nothing at all as nothing", () => {
    expect(isStopPhrase("")).toBe(false);
    expect(isStopPhrase(null)).toBe(false);
    expect(isStopPhrase("   ")).toBe(false);
  });
});
