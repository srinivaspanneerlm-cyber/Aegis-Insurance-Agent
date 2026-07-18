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

// Convert a JWT "expiresIn" style value ("30d", "12h", "3600") to milliseconds.
function expiresInToMs(value: string): number {
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
    maxAge: expiresInToMs(env.JWT_EXPIRES_IN),
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

// Minimal cookie-header parser so we don't need the cookie-parser dependency.
export function readTokenFromCookies(req: Request): string | null {
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
