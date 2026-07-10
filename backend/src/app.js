const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const { corsOptions, apiLimiter } = require("./config/security");
const { protect } = require("./middleware/auth.middleware");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./middleware/error.middleware");

// Import Route modules
const authRoutes = require("./routes/auth.routes");
const leadRoutes = require("./routes/lead.routes");
const policyRoutes = require("./routes/policy.routes");
const chatRoutes = require("./routes/chat.routes");
const uploadRoutes = require("./routes/upload.routes");
const companyRoutes = require("./routes/company.routes");
const adminRoutes = require("./routes/admin.routes");
const uiActionRoutes = require("./routes/ui_action.routes");

const app = express();

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

// HTTP Request Logger
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Request parsers
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

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

module.exports = app;
