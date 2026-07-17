"use client";

import { useState, useEffect } from "react";

interface AnimatedCounterProps {
  /** Target value. When `decimals > 0` this is a tenths integer (48 → "4.8"). */
  value: number;
  suffix?: string;
  decimals?: number;
  /** Larger divisor ⇒ smaller increments ⇒ slower ramp. */
  incrementDivisor?: number;
  /** Floor on the interval between ticks (ms). */
  minStepMs?: number;
  /** Total nominal animation duration used to derive the tick interval (ms). */
  durationMs?: number;
}

/**
 * Count-up animation shared by the marketing pages.
 *
 * Previously the About and landing pages each carried their own near-identical
 * copy that differed only in ramp speed. This single component preserves both
 * behaviours exactly via `incrementDivisor` / `minStepMs` props, removing the
 * duplication.
 */
export function AnimatedCounter({
  value,
  suffix = "",
  decimals = 0,
  incrementDivisor = 60,
  minStepMs = 30,
  durationMs = 2000,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) return;

    const stepTime = Math.abs(Math.floor(durationMs / end));
    const timer = setInterval(() => {
      start += Math.ceil(end / incrementDivisor);
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, Math.max(stepTime, minStepMs));

    return () => clearInterval(timer);
  }, [value, incrementDivisor, minStepMs, durationMs]);

  return (
    <span>
      {decimals > 0 ? (count / 10).toFixed(decimals) : count.toLocaleString()}
      {suffix}
    </span>
  );
}
