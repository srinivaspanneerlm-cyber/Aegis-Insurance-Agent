/**
 * Every sign-in attempt, successful or not.
 *
 * Separate from `AuditLog` on purpose. This is the one trail a *customer* is
 * entitled to read about their own account — "where have I signed in from" is a
 * reasonable question, and answering it from the platform's audit stream would
 * mean serving them everything else in it too.
 *
 * Writes are best-effort. A failure to record history must never be the reason
 * a valid sign-in fails, and it must never turn a rejected one into a 500 —
 * which would tell an attacker they had found something interesting.
 */
import type { Request } from "express";
import { loginEventRepository } from "../repositories";
import type { Realm } from "./realms";

export type LoginOutcome =
  | "SUCCESS"
  | "BAD_CREDENTIALS"
  | "NO_ACCOUNT"
  | "LOCKED"
  | "INACTIVE"
  | "UNVERIFIED"
  | "WRONG_REALM"
  | "METHOD_NOT_ALLOWED"
  | "PROVIDER_REJECTED";

/** Bound what we copy from client-controlled headers into storage. */
const MAX_USER_AGENT = 400;

export interface RequestContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

/**
 * What we know about where a request came from.
 *
 * `x-forwarded-for` is only trustworthy behind a proxy that sets it, and Express
 * already gates `req.ip` on the `trust proxy` setting — so `req.ip` is preferred
 * and the header is a fallback rather than the other way round.
 */
export function contextFrom(req: Request): RequestContext {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedFirst =
    typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;

  const userAgent = req.headers["user-agent"];

  return {
    ipAddress: req.ip ?? forwardedFirst ?? null,
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, MAX_USER_AGENT) : null,
  };
}

export function recordLogin(input: {
  userId?: string | null;
  email: string;
  outcome: LoginOutcome;
  method: string;
  realm?: Realm | null;
  context?: RequestContext;
}): void {
  // Fire and forget. Awaiting this would put a write on the critical path of
  // every sign-in for a record nobody reads synchronously.
  void loginEventRepository
    .create({
      userId: input.userId ?? null,
      // Lower-cased so a customer's history reads as one account rather than
      // splitting on however they happened to type their address.
      email: input.email.toLowerCase().trim(),
      outcome: input.outcome,
      method: input.method,
      realm: input.realm ?? null,
      ipAddress: input.context?.ipAddress ?? null,
      userAgent: input.context?.userAgent ?? null,
    })
    .catch(() => {
      /* history is evidence, not a control */
    });
}
