import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { userRepository, refreshTokenRepository, linkedIdentityRepository } from "../repositories";
import env from "../config/env";
import { AUTH } from "../config/constants";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { expiresInToMs } from "../utils/cookies";
import { getIdentityProvider } from "../auth/providers";
import type { VerifiedIdentity } from "../auth/providers";

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

/**
 * Which Aegis account does this external identity belong to?
 *
 * Three answers, tried in order, and the order is the security property:
 *
 *  1. **An existing link.** The (provider, subject) pair is durable, so this is
 *     the only answer that stays right after someone changes their email
 *     address at the provider. Trying it first is what stops that change from
 *     stranding a customer outside their own policies.
 *  2. **A verified email.** Someone who registered with a password and later
 *     uses the provider button should land on the account they already have,
 *     not a duplicate holding none of their history. Safe only because the
 *     provider stated the address is verified — see `VerifiedIdentity.email`.
 *  3. **A new account.** Nothing matched, so this is a new customer.
 *
 * Note there is no fourth answer where an unverified email creates or adopts
 * anything: `verify()` never returns one.
 */
async function resolveUserForIdentity(identity: VerifiedIdentity) {
  const existingLink = await linkedIdentityRepository.findBySubject(
    identity.provider,
    identity.subject
  );

  if (existingLink) {
    const linked = await userRepository.findById(existingLink.userId);
    if (linked) {
      await linkedIdentityRepository.markUsed(existingLink.id);
      return { user: await refreshProfileFromIdentity(linked, identity), isNewAccount: false };
    }
    // A link whose user is gone. Fall through and treat this as a fresh
    // sign-in; the upsert below re-points the row at whoever it resolves to.
  }

  const byEmail = await userRepository.findByEmail(identity.email);

  if (byEmail) {
    await linkedIdentityRepository.link({
      userId: byEmail.id,
      provider: identity.provider,
      subject: identity.subject,
      email: identity.email,
    });
    return { user: await refreshProfileFromIdentity(byEmail, identity), isNewAccount: false };
  }

  // The password is random and never disclosed, so this account is
  // provider-only by construction rather than by a flag someone can flip.
  const unusableSecret = crypto.randomBytes(32).toString("base64url");
  const created = await userRepository.create({
    name: identity.displayName || identity.email.split("@")[0],
    email: identity.email,
    password: await bcrypt.hash(unusableSecret, AUTH.BCRYPT_ROUNDS),
    role: "customer",
    image: identity.pictureUrl,
    lastLoginAt: new Date(),
  });

  await linkedIdentityRepository.link({
    userId: created.id,
    provider: identity.provider,
    subject: identity.subject,
    email: identity.email,
  });

  return { user: created, isNewAccount: true };
}

/**
 * Stamp the sign-in and take a newer profile picture if the provider has one.
 *
 * Best-effort like `touchLastLogin`: a customer is not turned away because a
 * profile picture URL failed to save.
 */
async function refreshProfileFromIdentity<T extends { id: string; image: string | null }>(
  user: T,
  identity: VerifiedIdentity
): Promise<T> {
  const patch: Record<string, unknown> = { lastLoginAt: new Date() };
  if (identity.pictureUrl && identity.pictureUrl !== user.image) {
    patch.image = identity.pictureUrl;
  }
  try {
    return (await userRepository.update(user.id, patch)) as unknown as T;
  } catch {
    return user;
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
   * Sign in (or transparently sign up) with any registered identity provider.
   *
   * The provider verifies the credential and answers with an identity; from
   * there this is the same session every other route produces. New accounts are
   * always "customer" — a provider can say who someone is, never what they are
   * allowed to do — and get an unusable random password, so an account created
   * this way simply cannot be signed into with one.
   */
  async signInWithProvider(providerId: string, credential: string) {
    const provider = getIdentityProvider(providerId);
    if (!provider) {
      throw new AppError("That sign-in method isn't available.", 400);
    }
    if (!provider.isConfigured) {
      throw new AppError(`${provider.label} sign-in is not configured on this server.`, 400);
    }

    const identity = await provider.verify(credential);
    if (!identity) {
      // Every rejection reason reaches the customer identically. The difference
      // between "expired" and "not yours" is only useful to someone probing.
      auditService.record({
        action: "auth.login.provider.rejected",
        metadata: { provider: providerId },
      });
      throw new AppError(`Could not verify your ${provider.label} account. Please try again.`, 401);
    }

    const { user, isNewAccount } = await resolveUserForIdentity(identity);

    if (!user.isActive) {
      throw new AppError("This account has been deactivated.", 403);
    }

    const tokens = await issueTokens(user.id);
    auditService.record({
      actorId: user.id,
      action: isNewAccount ? "auth.register.provider" : "auth.login.provider.success",
      metadata: { provider: providerId },
    });

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
