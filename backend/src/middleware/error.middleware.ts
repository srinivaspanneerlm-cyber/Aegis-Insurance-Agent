import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import AppError from "../utils/appError";

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
  return new AppError(`Duplicate value for target: ${target}. Please use another value.`, 400);
};

const handlePrismaValidationError = (err: AppErrorLike): AppError => {
  return new AppError(`Invalid database transaction parameter: ${err.message}`, 400);
};

const sendErrorDev = (err: AppErrorLike, req: Request, res: Response): void => {
  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppErrorLike, req: Request, res: Response): void => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak details
    console.error("ERROR 💥", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong on our end.",
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
