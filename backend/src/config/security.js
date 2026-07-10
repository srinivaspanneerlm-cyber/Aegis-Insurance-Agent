const rateLimit = require("express-rate-limit");
const env = require("./env");

// Strict CORS: only browser origins on the validated allowlist may send
// credentialed requests. A wildcard origin is never combined with
// `credentials: true` (which is invalid and unsafe).
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser / same-origin requests (no Origin header): curl,
    // server-to-server, health checks.
    if (!origin) return callback(null, true);
    if (env.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    status: "fail",
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 login/register requests per hour
  message: {
    status: "fail",
    message: "Too many authentication attempts, please try again after an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limiter for endpoints that fan out to the paid LLM engine
// (chat + UI actions). Protects against cost-abuse / scraping bursts.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI-backed calls per IP per minute
  message: {
    status: "fail",
    message: "Too many AI requests. Please slow down and try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  corsOptions,
  apiLimiter,
  authLimiter,
  aiLimiter,
};
