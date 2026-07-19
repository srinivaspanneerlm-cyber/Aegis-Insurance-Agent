import type { User } from "@prisma/client";

// Augment Express' Request with the authenticated user that `protect`
// attaches after verifying the JWT. Optional because it is only present on
// routes that run behind the auth middleware.
declare global {
  namespace Express {
    interface Request {
      user?: User;
      // Correlation id set by the requestId middleware (and reused by pino-http
      // + the error handler) so a request can be traced across logs/responses.
      id?: string;
    }
  }
}

export {};
