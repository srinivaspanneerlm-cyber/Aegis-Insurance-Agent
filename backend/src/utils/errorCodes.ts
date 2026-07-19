/**
 * Stable, machine-readable error codes returned in the error envelope
 * (`error.code`). Clients branch on these instead of parsing human messages.
 */
export const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Default code for an HTTP status when a specific one wasn't supplied. */
export function codeForStatus(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400: return ERROR_CODES.BAD_REQUEST;
    case 401: return ERROR_CODES.UNAUTHORIZED;
    case 403: return ERROR_CODES.FORBIDDEN;
    case 404: return ERROR_CODES.NOT_FOUND;
    case 409: return ERROR_CODES.CONFLICT;
    case 413: return ERROR_CODES.PAYLOAD_TOO_LARGE;
    case 429: return ERROR_CODES.RATE_LIMITED;
    default: return statusCode >= 500 ? ERROR_CODES.INTERNAL : ERROR_CODES.BAD_REQUEST;
  }
}
