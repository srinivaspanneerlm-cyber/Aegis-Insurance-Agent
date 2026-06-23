const rateLimit = require("express-rate-limit");

const corsOptions = {
  origin: process.env.CLIENT_URL || "*",
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

module.exports = {
  corsOptions,
  apiLimiter,
  authLimiter,
};
