/**
 * Deciding when a fragment of a streaming reply is worth saying out loud.
 *
 * The failure modes here are all audible, which is why they are worth pinning
 * precisely: a boundary found too early reads a premium as two half-sentences,
 * a boundary found too late leaves the customer in silence, and a boundary
 * never found at all is the old behaviour — wait for the whole reply — which is
 * exactly what this replaces.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_UNSPOKEN_CHARS,
  findSentenceEnd,
  isWorthSpeaking,
  sanitizeForSpeech,
  takeSpeakableSentences,
  truncateAtStructuredTag,
} from "./speech";

describe("finding a sentence boundary", () => {
  it("ends a sentence at a full stop followed by a space", () => {
    const text = "I can help with that. What is your budget?";
    expect(text.slice(0, findSentenceEnd(text))).toBe("I can help with that.");
  });

  it("treats a question mark and an exclamation as endings too", () => {
    expect(findSentenceEnd("Ready? Then let us begin.")).toBe(6);
    expect(findSentenceEnd("Welcome! Let us begin.")).toBe(8);
  });

  it("ends a Tamil sentence at the danda", () => {
    // Without this a reply written in Tamil script has no boundary at all and
    // buffers to the very end — losing every bit of the latency this wins.
    const text = "எனக்கு புரிகிறது। உங்கள் வயது என்ன?";
    expect(text.slice(0, findSentenceEnd(text))).toBe("எனக்கு புரிகிறது।");
  });

  it("does not break a rupee amount in half", () => {
    // "₹12,500." split at the decimal is read aloud as two fragments, and in a
    // premium quote that is worse than a pause.
    expect(findSentenceEnd("The premium is ₹12,500.50 per year and covers")).toBe(-1);
  });

  it("does not treat an abbreviation as the end of a thought", () => {
    expect(findSentenceEnd("Speak to Dr. Kumar about the medical check")).toBe(-1);
    expect(findSentenceEnd("Cashless, no co-pay, etc. are all included here")).toBe(-1);
  });

  it("does not break inside a version number or a domain", () => {
    expect(findSentenceEnd("Read it at aegis.example for the full wording")).toBe(-1);
  });

  it("withholds a terminator sitting at the end of an in-flight buffer", () => {
    // The next token may reveal it was "3.5" all along, so a full stop with
    // nothing after it is only trustworthy once the stream is closed.
    expect(findSentenceEnd("Your cover is ₹5", false)).toBe(-1);
    expect(findSentenceEnd("That is settled.", false)).toBe(-1);
    expect(findSentenceEnd("That is settled.", true)).toBe(16);
  });

  it("keeps a closing quote with the sentence it belongs to", () => {
    const text = 'They call it "top-up cover." It sits above your base plan.';
    expect(text.slice(0, findSentenceEnd(text))).toBe('They call it "top-up cover."');
  });
});

describe("draining a buffer into sentences", () => {
  it("yields complete sentences and keeps the rest", () => {
    const { sentences, rest } = takeSpeakableSentences(
      "First point here. Second point here. And a third that is incompl"
    );
    expect(sentences).toEqual(["First point here.", "Second point here."]);
    expect(rest.trim()).toBe("And a third that is incompl");
  });

  it("yields nothing at all until a boundary exists", () => {
    const { sentences, rest } = takeSpeakableSentences("I would suggest a family");
    // Speaking each token as it arrives produces three disconnected words with
    // three separate intonations, which is worse than waiting.
    expect(sentences).toEqual([]);
    expect(rest).toBe("I would suggest a family");
  });

  it("releases the tail once the stream is closed", () => {
    const { sentences, rest } = takeSpeakableSentences("One more thing", true);
    expect(sentences).toEqual(["One more thing"]);
    expect(rest).toBe("");
  });

  it("does not wait forever for a model that writes no punctuation", () => {
    // The one case where "wait for a boundary" degrades into "wait for the
    // end" — the exact failure this whole change is removing.
    const rambling = "so what I would say is ".repeat(20);
    const { sentences } = takeSpeakableSentences(rambling);
    expect(sentences.length).toBeGreaterThan(0);
    expect(sentences[0].length).toBeLessThanOrEqual(MAX_UNSPOKEN_CHARS);
  });

  it("breaks a long run at a natural pause, not mid-word", () => {
    const long = `Your family cover would include hospitalisation, day-care procedures, ` +
      `pre and post hospitalisation expenses, ambulance charges, and an annual health ` +
      `check-up for every member you choose to add to the policy going forward from here`;
    const { sentences } = takeSpeakableSentences(long);
    expect(sentences[0]).not.toMatch(/\w$/);
  });

  it("never emits an empty or whitespace-only utterance", () => {
    const { sentences } = takeSpeakableSentences("  .  .  . ", true);
    expect(sentences.every((s) => s.trim().length > 0)).toBe(true);
  });
});

describe("what must never be spoken", () => {
  it("stops at a recommendation tag rather than reading the JSON", () => {
    const reply = 'Here is my suggestion.\n\n[RECOMMENDATION:{"type":"single_plan","score":9';
    // Truncation, not stripping: the closing bracket has not arrived yet, and
    // read aloud this payload is a minute of punctuation.
    expect(truncateAtStructuredTag(reply)).toBe("Here is my suggestion.\n\n");
  });

  it("stops at a document request tag too", () => {
    expect(truncateAtStructuredTag("Please send it.[DOCUMENT_REQUEST:{}]")).toBe(
      "Please send it."
    );
  });

  it("strips markdown symbols that would be read as noise", () => {
    expect(sanitizeForSpeech("**Aegis Supreme** covers `day-care` too")).toBe(
      "Aegis Supreme covers day-care too"
    );
  });

  it("turns a paragraph break into a spoken pause", () => {
    // The doubled stop is the long-standing behaviour of this rule and is kept
    // deliberately: it is inaudible to a synthesiser, and changing it would
    // change how every existing reply is read out, which is not this step's
    // business. Pinned so a future edit is a decision rather than an accident.
    expect(sanitizeForSpeech("First point.\n\nSecond point.")).toBe("First point.. Second point.");
    expect(sanitizeForSpeech("First line\n\nSecond line")).toBe("First line. Second line");
  });

  it("bounds what one utterance can carry", () => {
    expect(sanitizeForSpeech("a".repeat(4000)).length).toBe(1500);
  });

  it("refuses a fragment with no actual words in it", () => {
    // A synthesiser handed "—" says nothing and fires no end event, which
    // would stall a queue that waits for one.
    expect(isWorthSpeaking("—")).toBe(false);
    expect(isWorthSpeaking("   ")).toBe(false);
    expect(isWorthSpeaking("**")).toBe(false);
    expect(isWorthSpeaking("[RECOMMENDATION:{}]")).toBe(false);
  });

  it("accepts a short but real answer", () => {
    expect(isWorthSpeaking("Yes.")).toBe(true);
    expect(isWorthSpeaking("ஆம்.")).toBe(true);
  });
});
