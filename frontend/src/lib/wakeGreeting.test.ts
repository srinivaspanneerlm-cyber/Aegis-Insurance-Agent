import { describe, it, expect, beforeEach } from "vitest";
import {
  matchWakePhrase,
  greetingFor,
  hasGreetedThisSession,
  markGreetedThisSession,
} from "./wakeGreeting";

describe("matchWakePhrase", () => {
  it("recognises a bare wake phrase with nothing after it", () => {
    expect(matchWakePhrase("Hello Aegis")).toEqual({
      isWake: true,
      remainder: "",
      tamil: false,
    });
  });

  it.each([
    "hello aegis",
    "Hey Aegis",
    "hi aegis",
    "Aegis",
    "aegis,",
  ])("wakes on %j", (text) => {
    expect(matchWakePhrase(text).isWake).toBe(true);
  });

  it("carries whatever follows the wake phrase as the remainder", () => {
    const result = matchWakePhrase("Hello Aegis, I need motor insurance for my car.");
    expect(result.isWake).toBe(true);
    expect(result.remainder).toBe("I need motor insurance for my car.");
  });

  it("marks a Tamil greeting word as Tamil", () => {
    expect(matchWakePhrase("Vanakkam Aegis").tamil).toBe(true);
    expect(matchWakePhrase("வணக்கம் Aegis").tamil).toBe(true);
  });

  it("marks Tamil script anywhere in the utterance as Tamil, even with an English greeting word", () => {
    expect(matchWakePhrase("Hello Aegis, எனக்கு கார் இன்சூரன்ஸ் வேண்டும்").tamil).toBe(true);
  });

  it("does not wake on a bare English greeting word", () => {
    expect(matchWakePhrase("Hello sir, I need help").isWake).toBe(false);
  });

  it("does not wake when aegis is mentioned mid-sentence, not addressed", () => {
    // Guards against accidental triggers — see the file's own doc comment.
    expect(matchWakePhrase("I read about my aegis policy online").isWake).toBe(false);
    expect(matchWakePhrase("Can you tell me about Aegis AI as a company").isWake).toBe(false);
  });

  it("is not fooled by a word merely starting with a greeting word", () => {
    expect(matchWakePhrase("history aegis").isWake).toBe(false);
  });

  it("returns a stable shape for empty input", () => {
    expect(matchWakePhrase("")).toEqual({ isWake: false, remainder: "", tamil: false });
    expect(matchWakePhrase(null)).toEqual({ isWake: false, remainder: "", tamil: false });
    expect(matchWakePhrase(undefined)).toEqual({ isWake: false, remainder: "", tamil: false });
  });
});

describe("greetingFor", () => {
  it("answers in English by default", () => {
    expect(greetingFor(false)).toBe("Hello sir. I'm Aegis. How can I help you?");
  });

  it("answers in Tamil/Thanglish when asked to", () => {
    expect(greetingFor(true)).toBe("Vanakkam sir. Naan Aegis. Ungalukku enna help venum?");
  });
});

describe("session-scoped greeting state", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("has not greeted a session that was never marked", () => {
    expect(hasGreetedThisSession("session-1")).toBe(false);
  });

  it("remembers a session once marked", () => {
    markGreetedThisSession("session-1");
    expect(hasGreetedThisSession("session-1")).toBe(true);
  });

  it("treats a different session id as not yet greeted, including the pre-session empty id", () => {
    markGreetedThisSession("");
    expect(hasGreetedThisSession("")).toBe(true);
    expect(hasGreetedThisSession("session-1")).toBe(false);
  });
});
