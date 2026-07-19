import crypto from "crypto";
import type { RequestHandler } from "express";

/**
 * Assigns a correlation id to every request: honours an inbound `X-Request-Id`
 * (so a trace can span the proxy/frontend) or mints a UUID. Exposed on the
 * response header and stored on `req.id` for pino-http and the error handler.
 * Mounted first, before the logger, so every log line carries it.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.headers["x-request-id"];
  const id = typeof inbound === "string" && inbound.trim() ? inbound.trim().slice(0, 200) : crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};

export default requestId;
