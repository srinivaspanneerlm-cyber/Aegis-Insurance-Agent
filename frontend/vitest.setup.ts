import "@testing-library/jest-dom";

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
