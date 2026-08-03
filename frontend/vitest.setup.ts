import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

/**
 * Testing Library's own `waitFor` ceiling is one second, separate from vitest's
 * `testTimeout`. Several suites wait on a Framer Motion *exit* animation to
 * unmount an element — a menu closing, a panel collapsing. That resolves in
 * ~200ms on an idle machine, but vitest runs one worker per core, and on a
 * saturated box it drifts past a second and the assertion fails on time rather
 * than on behaviour.
 *
 * Raising it does not hide a real failure: an element that never unmounts still
 * fails, just five seconds later. It removes the false negatives that otherwise
 * pick a different two or three tests to fail on every run.
 */
configure({ asyncUtilTimeout: 5000 });

/**
 * jsdom ships no IntersectionObserver, and Framer Motion's `whileInView` needs
 * one the moment it mounts. Without this, any component that reveals on scroll
 * throws during render and the test fails for a reason that has nothing to do
 * with the component.
 *
 * The stub reports nothing as intersecting. Tests that care about the revealed
 * state should assert on what the component renders, not on the animation.
 */
if (!("IntersectionObserver" in globalThis)) {
  class StubIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: StubIntersectionObserver,
  });
}
