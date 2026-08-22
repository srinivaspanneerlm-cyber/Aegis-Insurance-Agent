import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import pinoHttp from "pino-http";
import path from "path";

import { corsOptions, apiLimiter } from "./config/security";
import { protect } from "./middleware/auth.middleware";
import { verifyRequestOrigin } from "./middleware/csrf.middleware";
import { FEATURES, API_VERSION } from "./config/constants";
import AppError from "./utils/appError";
import globalErrorHandler from "./middleware/error.middleware";

// Import Route modules
import authRoutes from "./routes/auth.routes";
import leadRoutes from "./routes/lead.routes";
import policyRoutes from "./routes/policy.routes";
import chatRoutes from "./routes/chat.routes";
import uploadRoutes from "./routes/upload.routes";
import voiceRoutes from "./routes/voice.routes";
import companyRoutes from "./routes/company.routes";
import employeeRoutes from "./routes/employee.routes";
import enterpriseRoutes from "./routes/enterprise.routes";
import platformRoutes from "./routes/platform.routes";
import documentRoutes from "./routes/documents.routes";
import intelligenceRoutes from "./routes/intelligence.routes";
import communicationRoutes from "./routes/communication.routes";
import knowledgeRoutes from "./routes/knowledge.routes";
import { registerWorkflowCommunication } from "./communication/workflows";
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
//
// The advisor is the one endpoint that legitimately posts more than a form's
// worth of data: every turn carries the recent conversation so the agent can
// answer in context, and a consultation that has reached a recommendation
// carries several kilobytes of it. Against the 10kb limit those requests were
// rejected with a 413 and the advisor stopped answering mid-conversation —
// right after a recommendation, which is exactly when somebody has follow-up
// questions. Parsed first with a larger ceiling, so the general limit below
// sees the body already read and leaves it alone; every other route keeps 10kb,
// which is what makes an oversized-payload flood expensive for an attacker.
const CHAT_BODY_LIMIT = "256kb";
app.use("/api/v1/chat", express.json({ limit: CHAT_BODY_LIMIT }));
app.use("/api/chat", express.json({ limit: CHAT_BODY_LIMIT }));

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

// Rate Limiter (covers both /api/v1 and the bare /api alias below).
app.use("/api", apiLimiter);

// Cross-site request forgery defence. Mounted here so it covers both the
// versioned router and its bare `/api` alias, and runs before anything acts on
// the request. Only touches state-changing requests that carry one of our
// cookies — see the middleware for why that is the whole attack surface.
app.use("/api", verifyRequestOrigin);

// 2) API ROUTER — one definition, mounted at the versioned prefix (canonical)
// and aliased at the bare /api path so existing clients keep working unchanged.
const apiRouter = express.Router();
apiRouter.use((_req, res, next) => {
  res.setHeader("X-API-Version", API_VERSION);
  next();
});
apiRouter.use("/auth", authRoutes);
apiRouter.use("/leads", leadRoutes);
// Employee operations. Realm-walled as a whole — see employee.routes.ts.
apiRouter.use("/employee", employeeRoutes);
// Enterprise administration. Realm-walled as a whole — see enterprise.routes.ts.
apiRouter.use("/enterprise", enterpriseRoutes);
// Platform administration. The narrowest door: PLATFORM realm + platform.configure.
apiRouter.use("/platform", platformRoutes);
// The document platform. Scoped by caller rather than realm-walled — a customer
// legitimately manages their own documents. See documents.routes.ts.
apiRouter.use("/documents", documentRoutes);
apiRouter.use("/intelligence", intelligenceRoutes);
apiRouter.use("/communication", communicationRoutes);
apiRouter.use("/knowledge", knowledgeRoutes);

// Wire the event subscribers that turn platform events into notifications.
// Idempotent, and done here rather than in server.ts so the test suite — which
// imports the app without booting a server — exercises the same wiring.
registerWorkflowCommunication();
apiRouter.use("/policies", policyRoutes);
apiRouter.use("/chat", chatRoutes);
apiRouter.use("/upload", uploadRoutes);
// Voice turns: audio in, transcript out. Behind the same auth and the same AI
// rate limit as the chat routes, because it spends the same paid quota.
apiRouter.use("/voice", voiceRoutes);
apiRouter.use("/company", companyRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/ui-action", uiActionRoutes);

app.use(`/api/${API_VERSION}`, apiRouter); // canonical: /api/v1/*
app.use("/api", apiRouter); // backward-compatible alias: /api/*

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
