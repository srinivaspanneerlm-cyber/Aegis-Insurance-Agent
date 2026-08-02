import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveDocumentRequest } from "./parseDocumentRequest";

/**
 * The other half of the contract.
 *
 * `ai-python/tests/eval/test_document_request_prompt.py` checks that the ids the
 * agent prompt teaches are ids this registry defines. This checks the reverse
 * and more important direction: the example tag those agents are shown must
 * actually parse here. If the two drift, an agent emits a tag the customer's
 * screen silently ignores — the worst kind of failure, because everything looks
 * fine on both sides.
 */

const PROMPT_FILE = resolve(__dirname, "../../../../ai-python/app/prompts/document_prompts.py");

const describeIfPresent = existsSync(PROMPT_FILE) ? describe : describe.skip;

const exampleTag = (): string => {
  const source = readFileSync(PROMPT_FILE, "utf-8");
  const match = source.match(/\[DOCUMENT_REQUEST:\{.*\}\]/);
  if (!match) throw new Error("the agent prompt no longer shows an example tag");
  return match[0];
};

describeIfPresent("agent tag contract", () => {
  it("parses the exact example the Python agents are taught to emit", () => {
    const reply = `Sure Sri, oru rendu document venum.\n\n${exampleTag()}`;
    const result = resolveDocumentRequest(reply, { agentDomain: "motor", requestId: "m1" });

    expect(result).not.toBeNull();
    expect(result!.request.source).toBe("ai-tag");
    expect(result!.request.requirements.length).toBeGreaterThan(0);
  });

  it("keeps the tag out of what the customer reads", () => {
    const reply = `Sure Sri, oru rendu document venum.\n\n${exampleTag()}`;
    const { cleanedText } = resolveDocumentRequest(reply, {})!;

    expect(cleanedText).not.toContain("DOCUMENT_REQUEST");
    expect(cleanedText).toContain("oru rendu document venum");
  });

  it("resolves the example's kind against the registry, not a fallback", () => {
    const { request } = resolveDocumentRequest(exampleTag(), {})!;
    const [requirement] = request.requirements;

    // A fallback requirement gets the generic paperclip icon; a catalogued one
    // has its own. This is how we know the id genuinely landed.
    expect(requirement.icon).not.toBe("📎");
    expect(requirement.accept.length).toBeGreaterThan(0);
  });
});
