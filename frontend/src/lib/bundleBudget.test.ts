import { describe, it, expect } from "vitest";

// The pure budget check lives in the runnable CI script; import it directly so
// the logic is covered without needing a real `next build`.
import { checkBudget } from "../../scripts/bundle-budget.mjs";

describe("checkBudget", () => {
  const budgets = { totalMaxKb: 1000, chunkMaxKb: 200 };

  it("passes when total and every chunk are under budget", () => {
    const r = checkBudget(
      [
        { name: "a.js", bytes: 100 * 1024 },
        { name: "b.js", bytes: 50 * 1024 },
      ],
      budgets
    );
    expect(r.ok).toBe(true);
    expect(Math.round(r.totalKb)).toBe(150);
    expect(r.largest.name).toBe("a.js");
    expect(r.violations).toHaveLength(0);
  });

  it("flags total over budget", () => {
    const r = checkBudget([{ name: "a.js", bytes: 2000 * 1024 }], {
      totalMaxKb: 1000,
      chunkMaxKb: 5000,
    });
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatch(/total client JS/);
  });

  it("flags a single oversized chunk even when the total fits", () => {
    const r = checkBudget([{ name: "huge.js", bytes: 300 * 1024 }], {
      totalMaxKb: 100000,
      chunkMaxKb: 256,
    });
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatch(/huge\.js/);
  });

  it("handles an empty chunk list", () => {
    const r = checkBudget([], budgets);
    expect(r.ok).toBe(true);
    expect(r.totalKb).toBe(0);
    expect(r.largest.name).toBe("(none)");
  });
});
