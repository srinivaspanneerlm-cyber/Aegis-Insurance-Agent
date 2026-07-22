import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { userRepository, refreshTokenRepository } from "../repositories";
import env from "../config/env";
import { AUTH } from "../config/constants";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { expiresInToMs } from "../utils/cookies";

// Verifies Google ID tokens against our OAuth client ID. Instantiated once when
// GOOGLE_CLIENT_ID is configured; null otherwise so the route fails closed.
const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const signAccessToken = (id: string): string =>
  jwt.sign({ id }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN } as jwt.SignOptions);

// Only the SHA-256 hash of the opaque refresh token is ever persisted.
const hashToken = (raw: string): string => crypto.createHash("sha256").update(raw).digest("hex");

/** Mint a new opaque refresh token, persist its hash, return the raw value. */
async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString("base64url");
  await refreshTokenRepository.create({
    tokenHash: hashToken(raw),
    userId,
    expiresAt: new Date(Date.now() + expiresInToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
  });
  return raw;
}

async function issueTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  return { accessToken: signAccessToken(userId), refreshToken: await issueRefreshToken(userId) };
}

// Pre-computed bcrypt hash of a random string. A login for a non-existent email
// still runs a comparison against this dummy so success/failure take the same
// time — removing the user-enumeration timing side channel.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO.Vp9m9m4Zr1lJj0m2v0mQ9mE8xZ8yQK";

// Fields returned to clients on register (never the password hash).
const PUBLIC_USER_SELECT = { id: true, name: true, email: true, role: true, createdAt: true };

export const authService = {
  /**
   * Public self-service registration. `role` is intentionally never read from
   * input — it is always "customer" (no privilege escalation via mass-assignment).
   * Returns the created user + access & refresh tokens; the caller sets cookies.
   */
  async register(input: { name: string; email: string; password: string }) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new AppError("Email address already registered.", 400);

    const hashedPassword = await bcrypt.hash(input.password, AUTH.BCRYPT_ROUNDS);
    const user = await userRepository.create(
      { name: input.name, email: input.email, password: hashedPassword, role: "customer" },
      { select: PUBLIC_USER_SELECT }
    );

    const tokens = await issueTokens(user.id);
    auditService.record({ actorId: user.id, action: "auth.register", metadata: { email: input.email } });
    return { user, ...tokens };
  },

  async login(input: { email: string; password: string }) {
    const user = await userRepository.findByEmail(input.email);

    // Constant-time-ish: always run bcrypt (dummy hash when the user is absent).
    const passwordOk = await bcrypt.compare(input.password, user ? user.password : DUMMY_HASH);

    if (!user || !passwordOk) {
      auditService.record({ action: "auth.login.failure", metadata: { email: input.email } });
      throw new AppError("Incorrect email address or password.", 401);
    }

    const tokens = await issueTokens(user.id);
    auditService.record({ actorId: user.id, action: "auth.login.success" });

    const { password: _pw, ...userWithoutPassword } = user;
    void _pw;
    return { user: userWithoutPassword, ...tokens };
  },

  /**
   * Sign in (or transparently sign up) with a Google ID token. The frontend
   * obtains the token from Google Identity Services and posts it here; we verify
   * its signature and audience with Google's library, then find-or-create the
   * user by their verified email and issue our own access + refresh tokens — the
   * same session the password flow produces. New accounts are always "customer"
   * (no privilege escalation) and get an unusable random password, so the User
   * schema is unchanged and Google users simply cannot log in with a password.
   */
  async googleLogin(idToken: string) {
    if (!googleClient) {
      throw new AppError("Google sign-in is not configured on this server.", 400);
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      payload = undefined;
    }

    // Reject anything Google didn't vouch for: bad signature/audience, or an
    // unverified email (which we must not trust for account matching).
    if (!payload || !payload.email || !payload.email_verified) {
      auditService.record({ action: "auth.login.google.rejected" });
      throw new AppError("Could not verify your Google account. Please try again.", 401);
    }

    const email = payload.email.toLowerCase();
    let user = await userRepository.findByEmail(email);

    if (!user) {
      // Google-verified email → transparent signup. The password is random and
      // never disclosed, so these accounts are Google-only by construction.
      const randomSecret = crypto.randomBytes(32).toString("base64url");
      const hashedPassword = await bcrypt.hash(randomSecret, AUTH.BCRYPT_ROUNDS);
      user = await userRepository.create({
        name: payload.name || email.split("@")[0],
        email,
        password: hashedPassword,
        role: "customer",
      });
      auditService.record({ actorId: user.id, action: "auth.register.google", metadata: { email } });
    }

    if (!user.isActive) {
      throw new AppError("This account has been deactivated.", 403);
    }

    const tokens = await issueTokens(user.id);
    auditService.record({ actorId: user.id, action: "auth.login.google.success" });

    const { password: _pw, ...userWithoutPassword } = user;
    void _pw;
    return { user: userWithoutPassword, ...tokens };
  },

  /**
   * Exchange a valid refresh token for a fresh access + refresh pair. Rotation:
   * the presented token is revoked and a new one issued, so a stolen-and-reused
   * refresh token is detectable and short-lived.
   */
  async refresh(rawRefresh: string | null) {
    if (!rawRefresh) throw new AppError("Missing refresh token. Please log in again.", 401);

    const record = await refreshTokenRepository.findByHash(hashToken(rawRefresh));
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      auditService.record({ action: "auth.refresh.rejected" });
      throw new AppError("Invalid or expired session. Please log in again.", 401);
    }

    await refreshTokenRepository.revokeById(record.id); // rotate: single-use
    const tokens = await issueTokens(record.userId);
    auditService.record({ actorId: record.userId, action: "auth.refresh" });
    return { userId: record.userId, ...tokens };
  },

  /** Best-effort revoke on logout so the refresh token can't be reused. */
  async revokeRefreshToken(rawRefresh: string | null) {
    if (!rawRefresh) return;
    const record = await refreshTokenRepository.findByHash(hashToken(rawRefresh));
    if (record && !record.revokedAt) {
      await refreshTokenRepository.revokeById(record.id);
      auditService.record({ actorId: record.userId, action: "auth.logout" });
    }
  },
};
