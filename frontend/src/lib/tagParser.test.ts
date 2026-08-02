import { describe, it, expect } from "vitest";
import { extractTaggedPayload } from "./tagParser";

/**
 * The generic extractor behind both `[RECOMMENDATION:{…}]` and
 * `[DOCUMENT_REQUEST:{…}]`. parseRecommendation.test.ts covers the recommendation
 * contract in detail; these cases pin the behaviour that is shared by every tag.
 */
describe("extractTaggedPayload", () => {
  it("reads whichever tag name it is given", () => {
    const text = 'Please send these. [DOCUMENT_REQUEST:{"documents":[{"kind":"rc_book"}]}]';
    const result = extractTaggedPayload<{ documents: { kind: string }[] }>(text, "DOCUMENT_REQUEST");

    expect(result!.data.documents).toEqual([{ kind: "rc_book" }]);
    expect(result!.cleanedText).toBe("Please send these.");
  });

  it("ignores a tag of a different name", () => {
    const text = '[RECOMMENDATION:{"plan":"X"}]';
    expect(extractTaggedPayload(text, "DOCUMENT_REQUEST")).toBeNull();
  });

  it("returns null while the payload is still streaming in", () => {
    expect(extractTaggedPayload('[DOCUMENT_REQUEST:{"documents":[', "DOCUMENT_REQUEST")).toBeNull();
  });

  it("survives braces and escaped quotes inside string values", () => {
    const text = '[DOCUMENT_REQUEST:{"note":"send {both} \\"sides\\"","documents":[]}]';
    const result = extractTaggedPayload<{ note: string }>(text, "DOCUMENT_REQUEST");

    expect(result!.data.note).toBe('send {both} "sides"');
  });

  it("strips the tag out from between surrounding prose", () => {
    const result = extractTaggedPayload('Before [X:{"a":1}] after', "X");
    expect(result!.cleanedText).toBe("Before  after");
  });
});
