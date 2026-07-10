/**
 * httpOnly cookie helpers for JWT auth.
 *
 * Storing the token in an httpOnly cookie keeps it out of reach of JavaScript,
 * which neutralises XSS token-theft (localStorage was readable by any script).
 * A Bearer header is still accepted by the auth middleware for backward
 * compatibility (e.g. non-browser API clients).
 */
const env = require("../config/env");

const COOKIE_NAME = "aegis_token";

// Convert a JWT "expiresIn" style value ("30d", "12h", "3600") to milliseconds.
function expiresInToMs(value) {
  if (!value) return 30 * 24 * 60 * 60 * 1000; // default 30d
  const m = String(value).match(/^(\d+)([smhd])?$/);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2] || "s";
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return n * mult;
}

// `SameSite=None` is only valid alongside `Secure`; otherwise use `Lax`.
const sameSite = env.COOKIE_SECURE ? "none" : "lax";

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // not accessible to document.cookie / JS
    secure: env.COOKIE_SECURE, // HTTPS-only when enabled
    sameSite,
    maxAge: expiresInToMs(env.JWT_EXPIRES_IN),
    path: "/",
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    path: "/",
  });
}

// Minimal cookie-header parser so we don't need the cookie-parser dependency.
function readTokenFromCookies(req) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

module.exports = { COOKIE_NAME, setAuthCookie, clearAuthCookie, readTokenFromCookies };
