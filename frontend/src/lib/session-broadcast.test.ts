import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { publishSessionEvent, subscribeToSessionEvents } from "./session-broadcast";

/**
 * A stand-in for the browser's `BroadcastChannel` that delivers to every *other*
 * open instance, which is the behaviour the real one has and the whole reason
 * we use it: the tab that acted has already updated itself.
 */
const open = new Set<FakeChannel>();

class FakeChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(public name: string) {
    open.add(this);
  }
  postMessage(data: unknown) {
    for (const other of open) {
      if (other !== this && other.name === this.name) {
        other.onmessage?.({ data } as MessageEvent);
      }
    }
  }
  close() {
    open.delete(this);
  }
}

describe("session broadcast (BroadcastChannel)", () => {
  beforeEach(() => {
    open.clear();
    vi.stubGlobal("BroadcastChannel", FakeChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tells another tab the customer signed out", () => {
    const heard: unknown[] = [];
    const unsubscribe = subscribeToSessionEvents((event) => heard.push(event));

    publishSessionEvent({ type: "signed-out" });

    expect(heard).toEqual([{ type: "signed-out" }]);
    unsubscribe();
  });

  it("tells another tab the customer signed in", () => {
    const heard: unknown[] = [];
    const unsubscribe = subscribeToSessionEvents((event) => heard.push(event));

    publishSessionEvent({ type: "signed-in" });

    expect(heard).toEqual([{ type: "signed-in" }]);
    unsubscribe();
  });

  it("reaches every other tab, not just the first", () => {
    const tabTwo: unknown[] = [];
    const tabThree: unknown[] = [];
    const stopTwo = subscribeToSessionEvents((e) => tabTwo.push(e));
    const stopThree = subscribeToSessionEvents((e) => tabThree.push(e));

    publishSessionEvent({ type: "signed-out" });

    expect(tabTwo).toHaveLength(1);
    expect(tabThree).toHaveLength(1);
    stopTwo();
    stopThree();
  });

  it("stops listening once unsubscribed", () => {
    const heard: unknown[] = [];
    const unsubscribe = subscribeToSessionEvents((event) => heard.push(event));
    unsubscribe();

    publishSessionEvent({ type: "signed-out" });

    expect(heard).toEqual([]);
  });
});

describe("session broadcast (storage fallback)", () => {
  beforeEach(() => {
    // A browser without BroadcastChannel takes the localStorage route instead.
    vi.stubGlobal("BroadcastChannel", undefined);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes the event where other tabs will see it", () => {
    publishSessionEvent({ type: "signed-out" });

    const raw = localStorage.getItem("aegis_session_event");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({ type: "signed-out" });
  });

  it("stamps each event, so two sign-outs are two events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000));
    publishSessionEvent({ type: "signed-out" });
    const first = localStorage.getItem("aegis_session_event");

    vi.setSystemTime(new Date(2_000_000));
    publishSessionEvent({ type: "signed-out" });
    const second = localStorage.getItem("aegis_session_event");

    expect(first).not.toEqual(second);
    vi.useRealTimers();
  });

  it("acts on a storage event from another tab", () => {
    const heard: unknown[] = [];
    const unsubscribe = subscribeToSessionEvents((event) => heard.push(event));

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "aegis_session_event",
        newValue: JSON.stringify({ type: "signed-out", at: 1 }),
      })
    );

    expect(heard).toEqual([{ type: "signed-out", at: 1 }]);
    unsubscribe();
  });

  it("ignores storage traffic that is not ours", () => {
    const heard: unknown[] = [];
    const unsubscribe = subscribeToSessionEvents((event) => heard.push(event));

    window.dispatchEvent(
      new StorageEvent("storage", { key: "aegis_theme", newValue: "dark" })
    );
    // Our key, but written by an older version or another tool.
    window.dispatchEvent(
      new StorageEvent("storage", { key: "aegis_session_event", newValue: "not json" })
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "aegis_session_event",
        newValue: JSON.stringify({ type: "something-else" }),
      })
    );

    expect(heard).toEqual([]);
    unsubscribe();
  });
});
