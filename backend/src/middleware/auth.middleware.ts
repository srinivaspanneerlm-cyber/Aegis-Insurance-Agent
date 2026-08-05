import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { userRepository } from "../repositories";
import env from "../config/env";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { readTokenFromCookies, readStepUpFromCookies } from "../utils/cookies";
import { auditService } from "../services/audit.service";
import { roleHasPermission, type Permission } from "../auth/permissions";

const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // 1) Prefer the httpOnly cookie (XSS-safe); fall back to the Bearer header
  //    so non-browser API clients keep working.
  let token: string | null | undefined = readTokenFromCookies(req);
  if (
    !token &&
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to gain access.", 401)
    );
  }

  // 2) Validate token signature
  let decoded: JwtPayload & { id: string };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { id: string };
  } catch {
    return next(new AppError("Invalid security token. Please log in again.", 401));
  }

  // 3) Check if user still exists
  const user = await userRepository.findById(decoded.id);

  if (!user) {
    return next(
      new AppError("The user belonging to this token no longer exists.", 401)
    );
  }

  // Grant Access
  req.user = user;
  next();
});

/**
 * Gate a route on a capability rather than on a job title.
 *
 * The permission is resolved from the stored role on every request, never from
 * anything the client sent — `protect` has already replaced whatever the token
 * claimed with the record in the database, and this reads only that.
 *
 * The denial is deliberately uninformative to the caller and fully informative
 * to the audit trail. Telling someone which capability they lack maps out the
 * permission model for them; not recording it leaves nobody able to answer why
 * a legitimate colleague was refused.
 */
const requirePermission = (required: Permission): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user || !roleHasPermission(req.user.role, required)) {
      auditService.record({
        actorId: req.user?.id,
        action: "authz.permission.denied",
        metadata: { role: req.user?.role, required, path: req.originalUrl },
      });
      return next(
        new AppError("You do not have permission to perform this action.", 403)
      );
    }
    next();
  };
};

/**
 * Demand that the account holder proved themselves in the last few minutes.
 *
 * A session establishes that somebody signed in. It says nothing about who is
 * at the keyboard an hour later, on an office machine that was left unlocked or
 * a shared device in a family home. For actions that cannot be undone, that gap
 * is worth one more question.
 *
 * Deliberately a *separate* gate from `requirePermission`, not a stricter
 * version of it. They answer different questions — may this role do it, and is
 * this really them — and collapsing the two would mean every capability check
 * had to decide about freshness too.
 *
 * The 401 carries `REAUTH_REQUIRED` so the portal can tell "prompt for a
 * password" apart from "the session is over", which look identical otherwise
 * and would otherwise sign the customer out mid-task.
 */
const requireFreshAuth: RequestHandler = (req, _res, next) => {
  const token = readStepUpFromCookies(req);
  const failed = () => {
    auditService.record({
      actorId: req.user?.id,
      action: "authz.stepup.required",
      metadata: { path: req.originalUrl },
    });
    return next(
      new AppError(
        "Please confirm it's you before completing this action.",
        401,
        "REAUTH_REQUIRED"
      )
    );
  };

  if (!req.user || !token) return failed();

  try {
    const claims = jwt.verify(token, env.JWT_SECRET) as JwtPayload & {
      id?: string;
      purpose?: string;
    };
    // Both checks matter. Without `purpose`, an ordinary access token — same
    // key, same shape, and already in the browser — would satisfy this gate and
    // the confirmation would never actually be asked for.
    if (claims.purpose !== "step-up" || claims.id !== req.user.id) return failed();
  } catch {
    return failed(); // expired or tampered with: ask again
  }

  next();
};

export { protect, requirePermission, requireFreshAuth };
