import { invariant } from "./invariant";

/**
 * Read configuration, and fail at startup rather than at the first request.
 *
 * A missing environment variable that surfaces as `undefined` deep inside a
 * request handler becomes a 500 for one unlucky customer, hours after the
 * deploy that caused it. Read through here and the process refuses to start
 * instead — the failure lands on whoever is deploying, which is where it
 * belongs.
 */
export function requireEnv(name: string, source: Record<string, string | undefined>): string {
  const value = source[name];
  invariant(
    value !== undefined && value !== "",
    `Missing required environment variable ${name}. See .env.example.`
  );
  return value;
}

export function optionalEnv(
  name: string,
  source: Record<string, string | undefined>,
  fallback: string
): string {
  const value = source[name];
  return value === undefined || value === "" ? fallback : value;
}

/**
 * Parse a boolean-ish setting.
 *
 * Only an explicit "true"/"1" enables anything. A typo therefore leaves a
 * feature off rather than silently on, which is the safer direction for
 * anything gated by configuration.
 */
export function booleanEnv(
  name: string,
  source: Record<string, string | undefined>,
  fallback = false
): boolean {
  const value = source[name];
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}
