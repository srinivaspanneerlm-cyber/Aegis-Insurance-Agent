import type { Response } from "express";

interface SuccessOptions {
  /** Number of items in a collection response (rendered as `results`). */
  results?: number;
  /** Pagination envelope from BaseRepository.paginate. */
  pagination?: unknown;
  /** Auth token echoed at the top level (register/login). */
  token?: string;
  /** Human-readable note (e.g. logout confirmation). */
  message?: string;
}

/**
 * Single source of truth for the success envelope. Produces exactly the shape
 * controllers were building by hand — `{ status: "success", token?, message?,
 * results?, data?, pagination? }` — so it is fully backward-compatible while
 * removing per-controller drift. The correlation id is exposed on the
 * `X-Request-Id` header (set by the requestId middleware) rather than the body.
 */
export function sendSuccess(
  res: Response,
  statusCode: number,
  data?: unknown,
  opts: SuccessOptions = {}
): void {
  const body: Record<string, unknown> = { status: "success" };
  if (opts.token !== undefined) body.token = opts.token;
  if (opts.message !== undefined) body.message = opts.message;
  if (opts.results !== undefined) body.results = opts.results;
  if (data !== undefined) body.data = data;
  if (opts.pagination !== undefined) body.pagination = opts.pagination;
  res.status(statusCode).json(body);
}
