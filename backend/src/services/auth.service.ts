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

/**
 * Record that a session just started. Bookkeeping, not authentication: if the
 * write fails the sign-in still succeeds, because refusing a user entry over a
 * timestamp would be the wrong trade.
 */
async function touchLastLogin<T extends { id: string }>(userId: string, fallback: T): Promise<T> {
  try {
    return (await userRepository.update(userId, { lastLoginAt: new Date() })) as unknown as T;
  } catch {
    return fallback;
  }
}

// Pre-computed bcrypt hash of a random string. A login for a non-existent email
// still runs a comparison against this dummy so success/failure take the same
// time — removing the user-enumeration timing side channel.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO.Vp9m9m4Zr1lJj0m2v0mQ9mE8xZ8yQK";

// Fields returned to clients on register (never the password hash). `onboardedAt`
// is included because the client routes on it: a user with none has not finished
// onboarding and is sent there instead of the dashboard.
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  image: true,
  lastLoginAt: true,
  onboardedAt: true,
  preferredLanguage: true,
  insuranceInterests: true,
};

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
      // Registering signs the user in, so it is a login like any other.
      {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: "customer",
        lastLoginAt: new Date(),
      },
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

    // Best-effort: a failed bookkeeping write must never fail a valid sign-in.
    const stamped = await touchLastLogin(user.id, user);

    const { password: _pw, ...userWithoutPassword } = stamped;
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
        googleId: payload.sub,
        image: payload.picture ?? null,
        lastLoginAt: new Date(),
      });
      auditService.record({ actorId: user.id, action: "auth.register.google", metadata: { email } });
    } else {
      // Existing account — link it to the Google identity the first time, and
      // keep the picture current. The account is still matched on the verified
      // email, so an account created before this column existed is adopted here
      // rather than being left permanently unlinked.
      const patch: Record<string, unknown> = { lastLoginAt: new Date() };
      if (!user.googleId) patch.googleId = payload.sub;
      if (payload.picture && payload.picture !== user.image) patch.image = payload.picture;

      try {
        user = await userRepository.update(user.id, patch);
      } catch {
        // A googleId unique-constraint clash means this Google account is already
        // linked elsewhere. Sign-in still proceeds on the verified email; the
        // link is simply not rewritten.
        user = (await userRepository.findByEmail(email)) ?? user;
      }
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
   * Finish first-time onboarding: store the customer's language and what they
   * came here for, and stamp `onboardedAt` so they are never asked again.
   *
   * Values are constrained to the ONBOARDING allowlists by the request schema,
   * so nothing arbitrary reaches the profile. Interests are persisted as a JSON
   * array string because the schema targets SQLite as well as Postgres.
   */
  async completeOnboarding(
    userId: string,
    input: { preferredLanguage: string; insuranceInterests: string[] }
  ) {
    const user = await userRepository.update(userId, {
      preferredLanguage: input.preferredLanguage,
      insuranceInterests: JSON.stringify(input.insuranceInterests),
      onboardedAt: new Date(),
    });

    auditService.record({
      actorId: userId,
      action: "auth.onboarding.completed",
      entity: "User",
      entityId: userId,
      metadata: {
        preferredLanguage: input.preferredLanguage,
        insuranceInterests: input.insuranceInterests,
      },
    });

    const { password: _pw, ...userWithoutPassword } = user;
    void _pw;
    return userWithoutPassword;
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
