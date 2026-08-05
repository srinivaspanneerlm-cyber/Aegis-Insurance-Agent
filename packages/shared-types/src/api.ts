/**
 * The shape of every response the platform returns.
 *
 * One envelope, declared once, shared by the apps that read it and the services
 * that write it. When the contract lives in a package rather than in prose, a
 * service that changes its response shape fails to compile against the app that
 * consumes it — at build time, in CI, instead of at 2am in production.
 */

/** Discriminated on `status` so narrowing works without a type guard. */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface ApiSuccess<T> {
  status: "success";
  data: T;
  meta?: ResponseMeta;
}

export interface ApiFailure {
  status: "error";
  /** Stable, machine-readable. Clients branch on this, never on `message`. */
  code: ApiErrorCode;
  /**
   * Human-readable and safe to show. Server-side detail never travels in here
   * — it is logged against `requestId` instead.
   */
  message: string;
  /** Field-level detail for form validation. */
  details?: FieldError[];
  /** Correlates a customer's screenshot with the server log that explains it. */
  requestId?: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ResponseMeta {
  requestId?: string;
  pagination?: PageInfo;
}

/**
 * Cursor pagination, not offset.
 *
 * Offset pagination silently repeats and skips rows whenever the underlying set
 * changes between requests — which for a claims or policy list is constantly.
 * A cursor is stable under insertion, and it stays fast at depth because the
 * database never counts past the rows it returns.
 */
export interface PageInfo {
  /** Opaque. Clients pass it back verbatim and never parse it. */
  nextCursor: string | null;
  hasMore: boolean;
  /** Present only where a count is cheap; never assume it exists. */
  totalCount?: number;
}

export interface PageRequest {
  cursor?: string;
  /** Bounded server-side regardless of what arrives here. */
  limit?: number;
}

export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "CSRF_REJECTED",
  "UPSTREAM_UNAVAILABLE",
  "INTERNAL",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Narrowing helpers, so callers never reach for `as`. */
export const isSuccess = <T>(res: ApiResponse<T>): res is ApiSuccess<T> => res.status === "success";

export const isFailure = <T>(res: ApiResponse<T>): res is ApiFailure => res.status === "error";
