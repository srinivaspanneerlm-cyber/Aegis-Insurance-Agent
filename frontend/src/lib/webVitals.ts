/**
 * Web-vitals shaping (Phase 9.4).
 *
 * Turns a raw Next/web-vitals metric into a small, stable payload for logging
 * or beaconing. Kept pure and separate from the reporter component so the
 * rounding rules are unit-testable without a browser.
 */

/** The subset of a Next web-vitals metric this app records. */
export interface WebVitalInput {
  name: string;
  value: number;
  id: string;
  rating?: string;
}

export interface WebVitalPayload {
  name: string;
  /** CLS is a small unitless ratio (4 dp); the rest are milliseconds (integer). */
  value: number;
  rating?: string;
  id: string;
}

export function formatWebVital(metric: WebVitalInput): WebVitalPayload {
  const isRatio = metric.name === "CLS";
  const value = isRatio
    ? Math.round(metric.value * 10000) / 10000
    : Math.round(metric.value);
  return { name: metric.name, value, rating: metric.rating, id: metric.id };
}
