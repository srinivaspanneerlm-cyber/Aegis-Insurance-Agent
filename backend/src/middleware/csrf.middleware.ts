/**
 * Cross-site request forgery defence.
 *
 * The session cookie is `SameSite=None` in production (see `utils/cookies.ts`),
 * because the portal and this API are served from different origins there. That
 * is the setting that makes forgery possible: the browser attaches the
 * customer's cookie to a request made by *any* site they happen to be visiting.
 * CORS does not help — it blocks the attacker from reading our reply, long
 * after the request has already been carried out. And the app parses
 * `application/x-www-form-urlencoded`, which is exactly what a plain HTML form
 * on someone else's page can post without asking us first.
 *
 * The defence is to ask where the request came from. A browser attaches
 * `Origin` to every cross-site state-changing request and will not let script
 * on the page alter it, so a forged request either names the attacker's site or
 * cannot name ours.
 *
 * Two deliberate exemptions:
 *
 *  - **Safe methods.** `GET`/`HEAD`/`OPTIONS` change nothing, and blocking them
 *    would break ordinary navigation.
 *  - **Requests with no cookie of ours.** Forgery works by *riding* a cookie the
 *    browser sends automatically. A client that authenticates with a Bearer
 *    header has to attach that header on purpose, which an attacker's page
 *    cannot do — so API clients and the AI engine are unaffected by this.
 *
 * Where the origin cannot be established at all, the request is refused. A
 * browser doing something legitimate here always tells us where it came from,
 * so silence is not a case we need to serve — and guessing in the customer's
 * favour is how this defence would quietly stop existing.
 */
import type { Request, Response, NextFunction } from "express";
import env from "../config/env";
import AppError from "../utils/appError";
import { readTokenFromCookies, readRefreshFromCookies } from "../utils/cookies";
import { auditService } from "../services/audit.service";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Bound what we copy from a hostile header into the audit trail. */
const MAX_LOGGED_ORIGIN = 200;

/**
 * The origin of a `Referer`, or null if it is missing or unparseable.
 *
 * `Referer` is the fallback for the handful of cases where `Origin` is absent;
 * only its origin part is compared, since the path is neither trustworthy nor
 * relevant.
 */
function originOfReferer(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/** True when this request carries a credential the browser attached for us. */
function usesCookieAuth(req: Request): boolean {
  return Boolean(readTokenFromCookies(req) || readRefreshFromCookies(req));
}

export function verifyRequestOrigin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!usesCookieAuth(req)) return next();

  const stated = req.headers.origin || originOfReferer(req.headers.referer);

  if (stated && env.allowedOrigins.includes(stated)) return next();

  // Worth recording: a genuine hit here is either an attack on a signed-in
  // customer or a deployment whose CLIENT_URL no longer matches the portal.
  // Both are things someone needs to see.
  auditService.record({
    action: "security.csrf.blocked",
    metadata: {
      method: req.method,
      path: req.originalUrl?.slice(0, MAX_LOGGED_ORIGIN),
      origin: String(stated ?? "none").slice(0, MAX_LOGGED_ORIGIN),
    },
  });

  return next(
    new AppError(
      "We couldn't confirm this request came from Aegis, so we've stopped it. Please refresh the page and try again.",
      403
    )
  );
}

export default verifyRequestOrigin;
