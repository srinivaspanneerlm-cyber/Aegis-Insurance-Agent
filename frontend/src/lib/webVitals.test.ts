import { describe, it, expect } from "vitest";

import { formatWebVital } from "./webVitals";

describe("formatWebVital", () => {
  it("rounds latency metrics to whole milliseconds", () => {
    const p = formatWebVital({ name: "LCP", value: 1234.678, id: "v1", rating: "good" });
    expect(p).toEqual({ name: "LCP", value: 1235, rating: "good", id: "v1" });
  });

  it("keeps CLS precision as a small ratio", () => {
    const p = formatWebVital({ name: "CLS", value: 0.123456, id: "v2", rating: "needs-improvement" });
    expect(p.value).toBe(0.1235);
    expect(p.name).toBe("CLS");
  });

  it("passes rating through and tolerates its absence", () => {
    const p = formatWebVital({ name: "INP", value: 42, id: "v3" });
    expect(p.rating).toBeUndefined();
    expect(p.value).toBe(42);
    expect(p.id).toBe("v3");
  });
});
