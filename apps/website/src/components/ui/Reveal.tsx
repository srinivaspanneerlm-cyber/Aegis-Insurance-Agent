"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@aegis/utils";

export interface RevealProps {
  children: ReactNode;
  /** Stagger within a group, in milliseconds. Keep the total under ~300ms. */
  delay?: number;
  className?: string;
}

/**
 * Fades a block in as it enters the viewport.
 *
 * `IntersectionObserver` rather than a scroll listener: the browser does the
 * work off the main thread, which is the difference between a smooth page and a
 * janky one on the low-end Android hardware much of this audience uses.
 *
 * Two things it deliberately does not do. It never hides content from a reader
 * who has motion turned down — the check runs before the first paint decision,
 * so those visitors get the finished state immediately rather than an animation
 * played at 0.01ms. And it never hides content when JavaScript has not run:
 * the initial class is applied by the effect, so a page that fails to hydrate
 * is still fully readable. An animation that can swallow the content is worse
 * than no animation.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"pending" | "armed" | "shown">("pending");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setState("shown");
      return;
    }

    // Already on screen at mount (above the fold): show it without waiting for
    // a scroll that may never come.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState("shown");
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    setState("armed");
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={state === "armed" ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "motion-safe:transition-all motion-safe:duration-slow motion-safe:ease-enter",
        state === "armed" && "translate-y-3 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
