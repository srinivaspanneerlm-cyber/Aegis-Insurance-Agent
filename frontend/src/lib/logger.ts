/**
 * Small logging wrapper so the app has one place to route diagnostics.
 *
 * `debug`/`info` stay quiet in production; `warn`/`error` are always surfaced
 * and give a single choke point where a monitoring service (Sentry, etc.) can
 * later be wired in without touching every call site.
 */
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
