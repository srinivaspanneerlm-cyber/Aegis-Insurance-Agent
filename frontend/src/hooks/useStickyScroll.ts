import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";

/** A new message within this many px of the bottom still counts as "at bottom". */
export const NEAR_BOTTOM_THRESHOLD = 80;

/**
 * Pure test seam for the scroll maths: is the viewport within `threshold` px of
 * the content bottom? Kept separate so it can be unit-tested without a real
 * layout (jsdom does not compute scroll geometry).
 */
export function isNearBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold: number = NEAR_BOTTOM_THRESHOLD,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

/**
 * Keeps a scroll container pinned to the newest content as it arrives, but only
 * while the reader is already near the bottom. If they scroll up to re-read an
 * earlier answer, auto-scroll pauses and `showJump` goes true so the UI can
 * offer a "jump to latest" control.
 *
 * Purely presentational: it observes scroll position and moves the viewport. It
 * never touches chat, streaming, or voice state — the advisor's protected
 * workflow is unaffected.
 *
 * @param deps content signals (messages, streaming text/phase) that should
 *   trigger a re-pin when the reader is at the bottom.
 */
export function useStickyScroll<T extends HTMLElement>(deps: DependencyList) {
  const containerRef = useRef<T>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Suppresses scroll bookkeeping while a programmatic scroll animates, so the
  // jump control does not flicker as the viewport travels to the bottom.
  const programmatic = useRef(false);

  const handleScroll = useCallback(() => {
    if (programmatic.current) return;
    const el = containerRef.current;
    if (!el) return;
    setAtBottom(isNearBottom(el.scrollHeight, el.scrollTop, el.clientHeight));
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setAtBottom(true);
    window.setTimeout(() => {
      programmatic.current = false;
    }, 400);
  }, []);

  // Re-pin to the bottom when new content arrives, but only if the reader was
  // already there. `atBottom` reflects their last deliberate scroll, so reading
  // an earlier message is never interrupted.
  useEffect(() => {
    if (!atBottom) return;
    const t = setTimeout(() => scrollToBottom("smooth"), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    containerRef,
    atBottom,
    showJump: !atBottom,
    handleScroll,
    scrollToBottom,
  };
}
