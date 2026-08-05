/**
 * An outcome that might have failed, expressed in the type rather than thrown.
 *
 * Exceptions are invisible to the type system: a function that throws looks
 * identical to one that cannot, so the failure path is discovered in
 * production. Across a package boundary — where the caller cannot read the
 * implementation — that guess is not good enough. `Result` makes the failure
 * part of the signature, and TypeScript then refuses to let a caller ignore it.
 *
 * Reserved for expected failures: validation, a rejected request, a missing
 * record. Genuine bugs should still throw, loudly.
 */

export type Result<T, E = Error> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

/** Apply a function to the value, leaving a failure untouched. */
export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

/** Read the value, or fall back. The only sanctioned way to leave a `Result`. */
export const unwrapOr = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;
