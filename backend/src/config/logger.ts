/**
 * Structured application logger (pino). Emits JSON to stdout so the container
 * runtime captures and rotates it (12-factor); the compose json-file driver
 * caps size/rotation. Import this instead of using `console.*` in new code.
 *
 * `audit` is a dedicated child for security events (auth, RBAC). It is tagged
 * `category:"audit"` so it can be filtered/shipped separately downstream while
 * still riding the same stdout stream.
 */
import pino from "pino";
import env from "./env";

// Exported separately from the singleton below so a test can build its own
// pino instance against a capturable stream with the exact same redaction
// config, rather than trying to intercept the real logger's stdout.
const loggerOptions: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { service: "aegis-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Serialize Error objects passed as `{ err }` into message/stack/type rather
  // than the empty `{}` pino would otherwise emit (Error props aren't enumerable).
  serializers: { err: pino.stdSerializers.err },
  // Belt-and-suspenders: strip anything secret-bearing if an object carrying
  // these keys is ever logged (e.g. a serialized request).
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
};

const logger = pino(loggerOptions);

const audit = logger.child({ category: "audit" });

export { logger, audit, loggerOptions };
