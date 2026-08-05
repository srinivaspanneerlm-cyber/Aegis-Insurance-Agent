import { describe, it, expect } from "vitest";
import {
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  idleStateAt,
  formatCountdown,
} from "./session-lifecycle";

const MINUTE = 60 * 1000;

describe("idleStateAt", () => {
  it("leaves a customer who just did something alone", () => {
    const state = idleStateAt(1_000_000, 1_000_000);
    expect(state.phase).toBe("active");
    expect(state.msUntilSignOut).toBe(IDLE_TIMEOUT_MS);
  });

  it("stays quiet through most of the idle window", () => {
    // 20 minutes idle out of 30 — nothing to say yet.
    expect(idleStateAt(0, 20 * MINUTE).phase).toBe("active");
  });

  it("warns for the last minute, not before", () => {
    // 28:59 idle — still silent.
    expect(idleStateAt(0, IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1000).phase).toBe("active");
    // 29:00 idle — exactly one minute left, the warning starts.
    expect(idleStateAt(0, IDLE_TIMEOUT_MS - IDLE_WARNING_MS).phase).toBe("warning");
  });

  it("counts down through the warning", () => {
    const state = idleStateAt(0, IDLE_TIMEOUT_MS - 30_000);
    expect(state.phase).toBe("warning");
    expect(state.msUntilSignOut).toBe(30_000);
  });

  it("expires exactly at the timeout, not a tick early", () => {
    expect(idleStateAt(0, IDLE_TIMEOUT_MS - 1).phase).toBe("warning");
    expect(idleStateAt(0, IDLE_TIMEOUT_MS).phase).toBe("expired");
  });

  it("reports no time left once expired, however long ago that was", () => {
    const state = idleStateAt(0, IDLE_TIMEOUT_MS + 10 * MINUTE);
    expect(state.phase).toBe("expired");
    expect(state.msUntilSignOut).toBe(0);
  });

  it("treats a future timestamp as presence, not as absence", () => {
    // Another tab's clock ran ahead, or the device's clock moved back. Reading
    // this as "idle for minus five minutes" must never sign anyone out.
    const state = idleStateAt(2_000_000, 1_000_000);
    expect(state.phase).toBe("active");
    expect(state.msUntilSignOut).toBe(IDLE_TIMEOUT_MS);
  });

  it("honours a custom timeout and warning window", () => {
    expect(idleStateAt(0, 4 * MINUTE, 10 * MINUTE, 2 * MINUTE).phase).toBe("active");
    expect(idleStateAt(0, 8 * MINUTE, 10 * MINUTE, 2 * MINUTE).phase).toBe("warning");
    expect(idleStateAt(0, 10 * MINUTE, 10 * MINUTE, 2 * MINUTE).phase).toBe("expired");
  });
});

describe("formatCountdown", () => {
  it("pads the seconds so the width never jumps", () => {
    expect(formatCountdown(59_000)).toBe("0:59");
    expect(formatCountdown(9_000)).toBe("0:09");
  });

  it("rounds up, so the last second is shown rather than skipped", () => {
    // 500ms left is still a second the customer can act in.
    expect(formatCountdown(500)).toBe("0:01");
  });

  it("shows minutes when there are any", () => {
    expect(formatCountdown(2 * MINUTE)).toBe("2:00");
    expect(formatCountdown(90_000)).toBe("1:30");
  });

  it("never shows a negative time", () => {
    expect(formatCountdown(-5000)).toBe("0:00");
    expect(formatCountdown(0)).toBe("0:00");
  });
});
