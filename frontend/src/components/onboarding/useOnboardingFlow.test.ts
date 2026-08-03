import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOnboardingFlow } from "./useOnboardingFlow";

const setup = (onComplete = vi.fn().mockResolvedValue(undefined)) => ({
  onComplete,
  ...renderHook(() => useOnboardingFlow({ onComplete })),
});

describe("useOnboardingFlow — moving through the questions", () => {
  it("opens on the welcome screen, which asks nothing", () => {
    const { result } = setup();
    expect(result.current.step).toBe("welcome");
    expect(result.current.canAdvance).toBe(true);
  });

  it("will not advance past a question until it is answered", () => {
    const { result } = setup();
    act(() => result.current.next());

    expect(result.current.step).toBe("language");
    expect(result.current.canAdvance).toBe(false);

    act(() => result.current.selectLanguage("ta"));
    expect(result.current.canAdvance).toBe(true);
  });

  it("lets the customer go back without losing their answer", () => {
    const { result } = setup();
    act(() => result.current.next());
    act(() => result.current.selectLanguage("taEn"));
    act(() => result.current.next());
    act(() => result.current.back());

    expect(result.current.step).toBe("language");
    expect(result.current.language).toBe("taEn");
  });

  it("does not run off either end of the flow", () => {
    const { result } = setup();
    act(() => result.current.back());
    expect(result.current.step).toBe("welcome");

    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.step).toBe("interests");
    expect(result.current.isLastStep).toBe(true);
  });
});

describe("useOnboardingFlow — interests", () => {
  it("adds and removes on tap", () => {
    const { result } = setup();
    act(() => result.current.toggleInterest("health"));
    expect(result.current.interests).toEqual(["health"]);

    act(() => result.current.toggleInterest("motor"));
    expect(result.current.interests).toEqual(["health", "motor"]);

    act(() => result.current.toggleInterest("health"));
    expect(result.current.interests).toEqual(["motor"]);
  });

  it("never exceeds what the server will accept", () => {
    const { result } = setup();
    for (const id of ["health", "motor", "travel", "property", "miscellaneous", "extra"]) {
      act(() => result.current.toggleInterest(id));
    }
    expect(result.current.interests).toHaveLength(5);
    expect(result.current.interests).not.toContain("extra");
  });
});

describe("useOnboardingFlow — finishing", () => {
  it("submits both answers together", async () => {
    const { result, onComplete } = setup();
    act(() => result.current.selectLanguage("en"));
    act(() => result.current.toggleInterest("health"));
    await act(async () => { await result.current.submit(); });

    expect(onComplete).toHaveBeenCalledWith({
      preferredLanguage: "en",
      insuranceInterests: ["health"],
    });
  });

  it("refuses to submit a half-answered flow", async () => {
    const { result, onComplete } = setup();
    act(() => result.current.selectLanguage("en"));
    await act(async () => { await result.current.submit(); });

    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/both questions/i);
  });

  it("stays busy after a successful submit so it cannot be sent twice", async () => {
    const { result } = setup();
    act(() => result.current.selectLanguage("en"));
    act(() => result.current.toggleInterest("motor"));
    await act(async () => { await result.current.submit(); });

    expect(result.current.submitting).toBe(true);
  });

  it("surfaces a failure and lets them try again", async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error("Network is down."));
    const { result } = setup(onComplete);
    act(() => result.current.selectLanguage("en"));
    act(() => result.current.toggleInterest("travel"));
    await act(async () => { await result.current.submit(); });

    await waitFor(() => expect(result.current.error).toBe("Network is down."));
    expect(result.current.submitting).toBe(false);
  });

  it("clears a stale error as soon as the customer changes an answer", async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error("nope"));
    const { result } = setup(onComplete);
    act(() => result.current.selectLanguage("en"));
    act(() => result.current.toggleInterest("travel"));
    await act(async () => { await result.current.submit(); });
    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => result.current.selectLanguage("ta"));
    expect(result.current.error).toBe("");
  });
});
