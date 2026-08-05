import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { userRepository } from "../repositories";
import env from "../config/env";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { readTokenFromCookies } from "../utils/cookies";
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

export { protect, requirePermission };
