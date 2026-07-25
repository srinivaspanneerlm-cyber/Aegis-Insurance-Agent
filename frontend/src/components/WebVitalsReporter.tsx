"use client";

import { useReportWebVitals } from "next/web-vitals";

import { logger } from "@/lib/logger";
import { formatWebVital } from "@/lib/webVitals";

/**
 * Core Web Vitals reporter (Phase 9.4).
 *
 * Mounted once at the root. It logs each metric through the shared logger (quiet
 * in production) and, when NEXT_PUBLIC_WEBVITALS_URL is set, beacons the shaped
 * payload to that endpoint via `navigator.sendBeacon` (fire-and-forget, never
 * blocks the page). With the env unset it is log-only, so it adds no network
 * cost by default. Renders nothing.
 */
export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const payload = formatWebVital(metric);
    logger.debug("[web-vitals]", payload);

    const url = process.env.NEXT_PUBLIC_WEBVITALS_URL;
    if (url && typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(url, JSON.stringify(payload));
      } catch {
        /* best-effort telemetry — never surface to the user */
      }
    }
  });

  return null;
}
