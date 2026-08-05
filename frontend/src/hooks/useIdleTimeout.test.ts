import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdleTimeout } from "./useIdleTimeout";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const MINUTE = 60 * 1000;
const TIMEOUT = 30 * MINUTE;
const WARNING = MINUTE;

function renderIdle(enabled = true) {
  const onExpire = vi.fn();
  const view = renderHook((props: { enabled: boolean } = { enabled }) =>
    useIdleTimeout({
      enabled: props.enabled,
      onExpire,
      timeoutMs: TIMEOUT,
      warningMs: WARNING,
    })
  );
  return { ...view, onExpire };
}

/** Move time forward, letting the hook's one-second tick run. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useIdleTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000_000));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says nothing for most of the idle window", () => {
    const { result } = renderIdle();
    advance(20 * MINUTE);
    expect(result.current.phase).toBe("active");
  });

  it("warns in the last minute", () => {
    const { result } = renderIdle();
    advance(29 * MINUTE);
    expect(result.current.phase).toBe("warning");
    expect(result.current.msUntilSignOut).toBeLessThanOrEqual(WARNING);
  });

  it("ends the session once, not on every tick after", () => {
    const { onExpire } = renderIdle();
    advance(TIMEOUT);
    expect(onExpire).toHaveBeenCalledTimes(1);

    // The sign-out that follows takes a moment; the timer must not fire again
    // underneath it.
    advance(10 * MINUTE);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("treats reading as presence — a scroll resets the clock", () => {
    const { result, onExpire } = renderIdle();
    advance(29 * MINUTE);
    expect(result.current.phase).toBe("warning");

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    advance(1000);

    expect(result.current.phase).toBe("active");
    advance(20 * MINUTE);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("a keystroke counts too", () => {
    const { result } = renderIdle();
    advance(29 * MINUTE);

    act(() => {
      window.dispatchEvent(new Event("keydown"));
    });
    advance(1000);

    expect(result.current.phase).toBe("active");
  });

  it("'Stay signed in' puts the full window back", () => {
    const { result, onExpire } = renderIdle();
    advance(29 * MINUTE);
    expect(result.current.phase).toBe("warning");

    act(() => {
      result.current.extend();
    });

    expect(result.current.phase).toBe("active");
    expect(result.current.msUntilSignOut).toBe(TIMEOUT);
    advance(29 * MINUTE);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("follows the customer, not the tab — activity elsewhere keeps this one alive", () => {
    const { result, onExpire } = renderIdle();
    advance(29 * MINUTE);
    expect(result.current.phase).toBe("warning");

    // Another tab records activity: the customer is reading there while this
    // tab sits untouched. Signing them out would be signing out someone who is
    // demonstrably present.
    act(() => {
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, String(Date.now()));
    });
    advance(1000);

    expect(result.current.phase).toBe("active");
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("does nothing at all when disabled", () => {
    const { result, onExpire } = renderIdle(false);
    advance(2 * TIMEOUT);
    expect(result.current.phase).toBe("active");
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("survives a browser that refuses localStorage", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    // Private mode still deserves an idle timeout; it just stops being shared
    // between tabs.
    const { onExpire } = renderIdle();
    advance(TIMEOUT);
    expect(onExpire).toHaveBeenCalledTimes(1);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
