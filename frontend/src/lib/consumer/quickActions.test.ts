/**
 * The quick action catalogue.
 *
 * These five cards are the entire navigation for someone who may be using an
 * insurance product for the first time. What is worth pinning is not the copy
 * but the invariants underneath it: that no card can lead nowhere, that the
 * unbuilt ones say so, and that the language stays readable.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSUMER_TRUST_NOTE,
  GUIDANCE_DISCLAIMER,
  QUICK_ACTIONS,
} from "./quickActions";

describe("the five quick actions", () => {
  it("offers exactly the five the product specifies, in order", () => {
    expect(QUICK_ACTIONS.map((a) => a.label)).toEqual([
      "Check My Policy",
      "Renew My Insurance",
      "Understand My Coverage",
      "Claim Help",
      "My Policies",
    ]);
  });

  it("gives every action a stable, unique id", () => {
    const ids = QUICK_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("no action can lead nowhere", () => {
  it("a ready action has a destination", () => {
    // The bug this stops: a card styled as tappable with no href, which
    // navigates to the current page and looks like the app has frozen.
    for (const action of QUICK_ACTIONS.filter((a) => a.state === "ready")) {
      expect(action.href, `${action.id} is ready with no href`).toBeTruthy();
      expect(action.href!.startsWith("/"), `${action.id} must be same-site`).toBe(true);
    }
  });

  it("a pending action has no destination and says when instead", () => {
    for (const action of QUICK_ACTIONS.filter((a) => a.state === "next")) {
      expect(action.href, `${action.id} is not ready but has an href`).toBeUndefined();
      expect(action.pending, `${action.id} does not say when`).toBeTruthy();
    }
  });

  it("every destination is a route that actually exists in the app", () => {
    // Checked against the filesystem rather than a hand-written list, so a
    // route deleted or renamed later fails here instead of becoming a 404 the
    // first time a customer presses the card.
    const appDir = join(__dirname, "..", "..", "app");
    for (const action of QUICK_ACTIONS) {
      if (!action.href) continue;
      const segments = action.href.replace(/^\//, "");
      expect(
        existsAsRoute(appDir, segments),
        `${action.id} points at ${action.href}, which has no page`
      ).toBe(true);
    }
  });
});

describe("the copy is written for the people it is for", () => {
  it("every action explains what happens before it is pressed", () => {
    for (const action of QUICK_ACTIONS) {
      expect(action.description.length, `${action.id} has no real description`).toBeGreaterThan(30);
      // A description that does not end in a full stop is a fragment, and
      // fragments read as labels rather than as someone talking to you.
      expect(action.description.trim().endsWith(".")).toBe(true);
    }
  });

  it("uses no product jargon a first-time buyer would have to look up", () => {
    // Deliberately narrow: these are the words that appeared in the existing
    // console's navigation ("Overview Console", "AI Advisor Core") and are
    // exactly what this surface exists to avoid.
    const JARGON = ["console", "viewport", "portal", "IDV", "NCB", "sub-limit", "endorsement"];
    for (const action of QUICK_ACTIONS) {
      const text = `${action.label} ${action.description}`.toLowerCase();
      for (const word of JARGON) {
        expect(text.includes(word.toLowerCase()), `${action.id} says "${word}"`).toBe(false);
      }
    }
  });

  it("promises nothing about money, because Phase 1 takes none", () => {
    const FORBIDDEN = ["buy", "purchase", "pay", "premium quote", "discount", "cashback"];
    for (const action of QUICK_ACTIONS) {
      const text = `${action.label} ${action.description}`.toLowerCase();
      for (const word of FORBIDDEN) {
        expect(text.includes(word), `${action.id} says "${word}"`).toBe(false);
      }
    }
  });
});

describe("trust copy", () => {
  it("states plainly that this costs nothing and shares nothing", () => {
    expect(CONSUMER_TRUST_NOTE).toMatch(/free/i);
    expect(CONSUMER_TRUST_NOTE).toMatch(/never ask for payment/i);
  });

  it("the disclaimer matches the backend's word for word", () => {
    // The wording is fixed by the specification. Two copies of a fixed string
    // in two languages is exactly the kind of thing that drifts silently, so
    // the backend's constant is read here rather than trusted.
    const backend = readFileSync(
      join(__dirname, "..", "..", "..", "..", "backend", "src", "consumer", "messages.ts"),
      "utf8"
    );
    expect(backend).toContain(GUIDANCE_DISCLAIMER);
  });
});

/** Whether `app/<segments>` has a page of its own. */
function existsAsRoute(appDir: string, segments: string): boolean {
  return existsSync(join(appDir, segments, "page.tsx"));
}
