/**
 * Resolve and validate the HTTP server keep-alive timeouts.
 *
 * Node's default `keepAliveTimeout` is 5s. When the app runs behind a proxy or
 * load balancer that holds idle upstream connections longer (nginx, AWS ALB —
 * commonly a 60s idle timeout), Node can close a socket at the exact moment the
 * proxy reuses it, surfacing as intermittent 502s under load. The fix is to
 * keep Node's timeout *above* the upstream idle timeout, and to keep
 * `headersTimeout` above `keepAliveTimeout` so the header-read timer never fires
 * during a live keep-alive connection.
 *
 * Kept as a pure function (env injected, no process.exit, no singleton) so the
 * invariant is unit-testable in isolation; `config/env` calls it at boot and
 * routes any error through the existing fail-fast reporter.
 */

// Local (not exported): an `export =` module cannot also carry named exports
// without breaking the tsx transpile — see the interop notes in env.ts.
interface ServerTimeouts {
  keepAliveTimeoutMs: number;
  headersTimeoutMs: number;
  /** Non-fatal here; the caller decides whether to warn or fail. */
  errors: string[];
}

// Defaults beat a typical 60s upstream idle timeout, with headers above it.
const DEFAULT_KEEPALIVE_MS = 61000;
const DEFAULT_HEADERS_MS = 65000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt((raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveServerTimeouts(
  source: NodeJS.ProcessEnv = process.env
): ServerTimeouts {
  const keepAliveTimeoutMs = parsePositiveInt(
    source.KEEPALIVE_TIMEOUT_MS,
    DEFAULT_KEEPALIVE_MS
  );
  const headersTimeoutMs = parsePositiveInt(
    source.HEADERS_TIMEOUT_MS,
    DEFAULT_HEADERS_MS
  );

  const errors: string[] = [];
  if (headersTimeoutMs <= keepAliveTimeoutMs) {
    errors.push(
      `HEADERS_TIMEOUT_MS (${headersTimeoutMs}) must be greater than ` +
        `KEEPALIVE_TIMEOUT_MS (${keepAliveTimeoutMs}); otherwise the header-read ` +
        `timer can fire during a live keep-alive connection and cut requests short.`
    );
  }

  return { keepAliveTimeoutMs, headersTimeoutMs, errors };
}

export = resolveServerTimeouts;
