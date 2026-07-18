import { describe, it, expect } from "vitest";
import { subscribeToast, notify, type Toast } from "./toast";

describe("toast bus", () => {
  it("delivers emitted toasts to subscribers with kind and message", () => {
    const seen: Pick<Toast, "kind" | "message">[] = [];
    const unsub = subscribeToast((t) => seen.push({ kind: t.kind, message: t.message }));

    notify.error("boom");
    notify.success("done");

    unsub();
    notify.info("after unsubscribe"); // must not be delivered

    expect(seen).toEqual([
      { kind: "error", message: "boom" },
      { kind: "success", message: "done" },
    ]);
  });

  it("assigns a unique id to each toast", () => {
    const ids: number[] = [];
    const unsub = subscribeToast((t) => ids.push(t.id));

    notify.info("a");
    notify.info("b");
    unsub();

    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
