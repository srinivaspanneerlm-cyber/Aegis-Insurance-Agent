/**
 * Assert something the code depends on but the types cannot prove.
 *
 * The value is the narrowing: after `invariant(user)`, TypeScript knows `user`
 * is not null for the rest of the scope. Used for genuine programmer errors —
 * a context consumed outside its provider, an environment variable that must
 * exist. Expected failures belong in a `Result`, not here.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (condition) return;
  throw new Error(`[aegis] Invariant failed: ${message}`);
}

/**
 * Prove a switch is exhaustive.
 *
 * Placed in the `default` branch, this turns "someone added a variant and
 * forgot this switch" from a runtime surprise into a compile error at every
 * site that handles the union.
 */
export function assertNever(value: never, context = "value"): never {
  throw new Error(`[aegis] Unhandled ${context}: ${JSON.stringify(value)}`);
}
