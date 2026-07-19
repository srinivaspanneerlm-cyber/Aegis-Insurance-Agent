import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import pinoHttp from "pino-http";
import path from "path";

import { corsOptions, apiLimiter } from "./config/security";
import { protect } from "./middleware/auth.middleware";
import { FEATURES } from "./config/constants";
import AppError from "./utils/appError";
import globalErrorHandler from "./middleware/error.middleware";

// Import Route modules
import authRoutes from "./routes/auth.routes";
import leadRoutes from "./routes/lead.routes";
import policyRoutes from "./routes/policy.routes";
import chatRoutes from "./routes/chat.routes";
import uploadRoutes from "./routes/upload.routes";
import companyRoutes from "./routes/company.routes";
import adminRoutes from "./routes/admin.routes";
import uiActionRoutes from "./routes/ui_action.routes";
import healthRoutes from "./routes/health.routes";

import env from "./config/env";
import { register, httpMetricsMiddleware } from "./config/metrics";
import { logger } from "./config/logger";
import { requestId } from "./middleware/requestId.middleware";

const app = express();

// Trust only the configured number of front proxies so req.ip (and therefore
// the rate limiter's per-client key) reflects the real client address without
// letting arbitrary clients spoof X-Forwarded-For. Defaults to false.
app.set("trust proxy", env.TRUST_PROXY);

// 1) GLOBAL SECURITY & LOGGING MIDDLEWARES
app.use(
  helmet({
    // Enforce HTTPS for one year (browsers only honour this over TLS).
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    // Do not leak full URLs to third-party origins in the Referer header.
    referrerPolicy: { policy: "no-referrer" },
    // Prevent other origins from hot-linking served resources (e.g. uploads).
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);
app.disable("x-powered-by");
app.use(cors(corsOptions));

// Correlation id for every request (before the logger, so every line carries
// it). Also set on the X-Request-Id response header and used in error bodies.
app.use(requestId);

// Response compression (gzip/deflate) for large JSON/text payloads — a major
// bandwidth win at scale. Loaded defensively so the app runs with or without
// the optional dependency installed; toggle via FEATURE_COMPRESSION.
if (FEATURES.COMPRESSION) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const compression = require("compression");
    app.use(compression());
  } catch {
    console.warn("[app] 'compression' not installed — running uncompressed. Run `npm install` to enable.");
  }
}

// HTTP Request Logger. LOG_FORMAT=json → structured pino-http (request id +
// JSON, for prod aggregation); otherwise morgan's dev output. Health/metrics
// probes are not access-logged to keep the signal clean.
if (env.LOG_FORMAT === "json") {
  app.use(
    pinoHttp({
      logger,
      // Reuse the correlation id from the requestId middleware.
      genReqId: (req) => (req as { id?: string }).id ?? "",
      autoLogging: {
        ignore: (req) => req.url === "/metrics" || req.url.startsWith("/health"),
      },
    })
  );
} else {
  app.use(morgan("dev"));
}

// Request parsers
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Time every request for the Prometheus histogram (records the matched route
// pattern, so SSE/finish events are captured without unbounded cardinality).
app.use(httpMetricsMiddleware);

// Liveness/readiness probe for load balancers & orchestrators. Kept outside
// `/api` so it is unthrottled, and intentionally minimal (no info disclosure).
// `/health` (legacy) is preserved; `/health/live` + `/health/ready` add the
// orchestrator-grade split.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});
app.use("/health", healthRoutes);

// Prometheus scrape endpoint. Deliberately NOT under `/api` (so nginx never
// exposes it publicly); Prometheus reaches it over the internal network.
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Rate Limiter
app.use("/api", apiLimiter);

// 2) ROUTE MOUNTINGS
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ui-action", uiActionRoutes);

// Static uploads serving path — these are private customer documents, so the
// directory is gated behind authentication instead of being world-readable.
app.use(
  "/uploads",
  protect,
  express.static(path.join(__dirname, "uploads"), {
    dotfiles: "deny",
    index: false,
  })
);

// 3) UNHANDLED ROUTE HANDLERS
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 4) GLOBAL ERROR MIDDLEWARE
app.use(globalErrorHandler);

export = app;
