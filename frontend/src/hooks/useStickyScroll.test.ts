import { describe, it, expect } from "vitest";
import { isNearBottom, NEAR_BOTTOM_THRESHOLD } from "./useStickyScroll";

describe("isNearBottom", () => {
  it("is true when the viewport is exactly at the bottom", () => {
    // scrollTop maxed out: scrollHeight - scrollTop - clientHeight === 0
    expect(isNearBottom(1000, 600, 400)).toBe(true);
  });

  it("is true within the threshold of the bottom", () => {
    // 80px remaining, threshold is 80 → still counts as at bottom
    expect(isNearBottom(1000, 520, 400, NEAR_BOTTOM_THRESHOLD)).toBe(true);
  });

  it("is false when scrolled up beyond the threshold", () => {
    // 200px remaining below the fold
    expect(isNearBottom(1000, 400, 400)).toBe(false);
  });

  it("is true when content fits without overflow", () => {
    // scrollHeight <= clientHeight → distance is non-positive
    expect(isNearBottom(300, 0, 400)).toBe(true);
  });

  it("respects a custom threshold", () => {
    // 120px remaining: outside default 80 but inside a custom 150
    expect(isNearBottom(1000, 480, 400, 80)).toBe(false);
    expect(isNearBottom(1000, 480, 400, 150)).toBe(true);
  });
});
