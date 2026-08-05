import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import AppError from "../utils/appError";
import { codeForStatus } from "../utils/errorCodes";
import { logger } from "../config/logger";

// The global handler receives whatever was thrown/forwarded — AppError, a
// Prisma error, a JWT error, or an unexpected programming error — so it works
// against a permissive shape and narrows on the fields it needs.
interface AppErrorLike extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  code?: string;
  meta?: { target?: string[] };
}

const handlePrismaUniqueConstraintError = (err: AppErrorLike): AppError => {
  const target = err.meta?.target ? err.meta.target.join(", ") : "field";
  return new AppError(`Duplicate value for target: ${target}. Please use another value.`, 409, "CONFLICT");
};

const handlePrismaValidationError = (err: AppErrorLike): AppError => {
  return new AppError(`Invalid database transaction parameter: ${err.message}`, 400, "VALIDATION_ERROR");
};

/**
 * Prisma's own error codes — `P2002`, `P2025` and so on. They are internal
 * database detail and must never reach a client, so they fall back to the
 * generic code for the status.
 *
 * Matched as "P followed by digits" rather than "starts with P", which is what
 * this used to be. That looser test silently swallowed any AppError code
 * beginning with the letter — `PORTAL_FORBIDDEN` came out as plain `FORBIDDEN`,
 * and every future `PASSWORD_*` or `PLATFORM_*` would have done the same. A
 * client that switches on a code cannot tell "forbidden" from "forbidden for
 * this specific, actionable reason".
 */
const PRISMA_CODE = /^P\d+$/;

/** Machine `code` for the response — AppError carries its own; others map by status. */
const resolveCode = (err: AppErrorLike, statusCode: number): string =>
  err.code && !PRISMA_CODE.test(err.code) ? err.code : codeForStatus(statusCode);

const sendErrorDev = (err: AppErrorLike, req: Request, res: Response): void => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: err.status || "error",
    code: resolveCode(err, statusCode),
    message: err.message,
    requestId: req.id,
    error: err,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppErrorLike, req: Request, res: Response): void => {
  const statusCode = err.statusCode || 500;
  if (err.isOperational) {
    // Trusted error: safe to surface the message + code.
    res.status(statusCode).json({
      status: err.status,
      code: resolveCode(err, statusCode),
      message: err.message,
      requestId: req.id,
    });
  } else {
    // Programming/unknown error: never leak details.
    res.status(500).json({
      status: "error",
      code: "INTERNAL",
      message: "Something went wrong on our end.",
      requestId: req.id,
    });
  }
};

const globalErrorHandler: ErrorRequestHandler = (
  err: AppErrorLike,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Structured, correlated error logging (replaces console.error). Expected
  // operational errors log at warn; unexpected ones at error with the stack.
  const logBase = { requestId: req.id, statusCode: err.statusCode, code: err.code, path: req.originalUrl, method: req.method };
  if (err.isOperational) {
    logger.warn(logBase, err.message);
  } else {
    logger.error({ ...logBase, err }, err.message || "Unhandled error");
  }

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, req, res);
  } else {
    let error: AppErrorLike = Object.assign(err);
    error.message = err.message;

    if (err.code === "P2002") error = handlePrismaUniqueConstraintError(error);
    if (err.name === "PrismaClientValidationError") error = handlePrismaValidationError(error);
    if (err.name === "JsonWebTokenError") error = new AppError("Invalid security token. Please log in again.", 401);
    if (err.name === "TokenExpiredError") error = new AppError("Your security token has expired. Please log in again.", 401);

    sendErrorProd(error, req, res);
  }
};

export = globalErrorHandler;
