import { describe, it, expect } from "vitest";
import { parseRecommendation } from "./parseRecommendation";

/**
 * The advisor streams plain prose with an inline [RECOMMENDATION:{…}] tag.
 * parseRecommendation must pull the JSON out and hand back the prose without
 * it — a half-arrived tag mid-stream must never render as raw text.
 */
describe("parseRecommendation", () => {
  const tag = (json: string) => `[RECOMMENDATION:${json}]`;

  it("returns null when there is no recommendation tag", () => {
    expect(parseRecommendation("Just a normal reply.")).toBeNull();
  });

  it("extracts the payload and strips the tag from the prose", () => {
    const text = `Here is my pick. ${tag('{"plan":"Family Shield","score":92}')}`;
    const result = parseRecommendation(text);

    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ plan: "Family Shield", score: 92 });
    expect(result!.cleanedText).toBe("Here is my pick.");
  });

  it("handles nested objects and arrays inside the payload", () => {
    const json = '{"plans":[{"name":"A","scores":{"overall":90}},{"name":"B"}],"type":"multi_plan"}';
    const result = parseRecommendation(`Compare these. ${tag(json)}`);

    expect(result!.data).toEqual({
      plans: [{ name: "A", scores: { overall: 90 } }, { name: "B" }],
      type: "multi_plan",
    });
    expect(result!.cleanedText).toBe("Compare these.");
  });

  it("does not end the payload on braces that sit inside strings", () => {
    const json = '{"note":"covers } and { braces","plan":"X"}';
    const result = parseRecommendation(tag(json));

    expect(result!.data).toEqual({ note: "covers } and { braces", plan: "X" });
  });

  it("respects escaped quotes inside string values", () => {
    const json = '{"note":"he said \\"hello\\"","plan":"X"}';
    const result = parseRecommendation(tag(json));

    expect(result!.data).toEqual({ note: 'he said "hello"', plan: "X" });
  });

  it("returns null for a tag whose JSON never closes (still streaming)", () => {
    expect(parseRecommendation('Loading… [RECOMMENDATION:{"plan":"X"')).toBeNull();
  });

  it("returns null when the payload is not valid JSON", () => {
    expect(parseRecommendation(tag("{not json}"))).toBeNull();
  });

  it("returns null when the tag is the very last thing with no payload", () => {
    expect(parseRecommendation("Text [RECOMMENDATION:")).toBeNull();
  });

  it("keeps prose that appears on both sides of the tag", () => {
    const result = parseRecommendation(`Before ${tag('{"plan":"X"}')} after`);
    expect(result!.cleanedText).toBe("Before  after");
  });
});
