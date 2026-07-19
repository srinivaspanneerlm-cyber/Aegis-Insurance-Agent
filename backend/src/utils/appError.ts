import { codeForStatus, type ErrorCode } from "./errorCodes";

/**
 * Operational (expected) error carrying an HTTP status, a stable machine
 * `code`, and a client-safe message. Thrown from services/controllers and
 * rendered by the global error handler.
 */
class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code: string;

  constructor(message: string, statusCode: number, code?: ErrorCode | string) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.code = code ?? codeForStatus(statusCode);

    Error.captureStackTrace(this, this.constructor);
  }
}

export = AppError;
