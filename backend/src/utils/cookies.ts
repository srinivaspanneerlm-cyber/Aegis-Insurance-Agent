/**
 * httpOnly cookie helpers for JWT auth.
 *
 * Storing the token in an httpOnly cookie keeps it out of reach of JavaScript,
 * which neutralises XSS token-theft (localStorage was readable by any script).
 * A Bearer header is still accepted by the auth middleware for backward
 * compatibility (e.g. non-browser API clients).
 */
import type { Request, Response } from "express";
import env from "../config/env";

export const COOKIE_NAME = "aegis_token";
// Refresh cookie is scoped to /api so it is only sent to the auth endpoints
// (covers both /api/auth/refresh and /api/v1/auth/refresh).
export const REFRESH_COOKIE_NAME = "aegis_refresh";
const REFRESH_COOKIE_PATH = "/api";

/**
 * Marks that a session exists, for the frontend's route guard.
 *
 * It carries **no credential** — its presence is the entire message. The guard
 * needs to answer "is this visitor worth rendering a protected page for?" before
 * any request reaches this API, and neither real token can answer it: the access
 * cookie expires with the short-lived token it holds (so a perfectly refreshable
 * session looks signed out minutes after sign-in), and the refresh cookie is
 * scoped to /api, so the browser never sends it to the frontend at all.
 *
 * It tracks the refresh token's lifetime because that is the true length of the
 * session. Authorisation is still decided here, on every request — this only
 * saves the customer a redirect they would not have deserved.
 */
export const SESSION_COOKIE_NAME = "aegis_session";

// Convert a JWT "expiresIn" style value ("30d", "12h", "3600") to milliseconds.
export function expiresInToMs(value: string): number {
  if (!value) return 30 * 24 * 60 * 60 * 1000; // default 30d
  const m = String(value).match(/^(\d+)([smhd])?$/);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2] || "s";
  const mult: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * (mult[unit] ?? 1000);
}

// `SameSite=None` is only valid alongside `Secure`; otherwise use `Lax`.
const sameSite: "none" | "lax" = env.COOKIE_SECURE ? "none" : "lax";

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // not accessible to document.cookie / JS
    secure: env.COOKIE_SECURE, // HTTPS-only when enabled
    sameSite,
    maxAge: expiresInToMs(env.ACCESS_TOKEN_EXPIRES_IN),
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    path: "/",
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    maxAge: expiresInToMs(env.REFRESH_TOKEN_EXPIRES_IN),
    path: REFRESH_COOKIE_PATH,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    path: REFRESH_COOKIE_PATH,
  });
}

export function setSessionCookie(res: Response): void {
  res.cookie(SESSION_COOKIE_NAME, "1", {
    // Still httpOnly: the frontend reads this server-side in its route guard,
    // never from JS, so there is no reason to widen its reach.
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    maxAge: expiresInToMs(env.REFRESH_TOKEN_EXPIRES_IN),
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    path: "/",
  });
}

export function readRefreshFromCookies(req: Request): string | null {
  return readCookie(req, REFRESH_COOKIE_NAME);
}

// Minimal cookie-header parser so we don't need the cookie-parser dependency.
function readCookie(req: Request, name: string): string | null {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function readTokenFromCookies(req: Request): string | null {
  return readCookie(req, COOKIE_NAME);
}
