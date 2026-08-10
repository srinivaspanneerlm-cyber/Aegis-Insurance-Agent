import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  userRepository,
  refreshTokenRepository,
  linkedIdentityRepository,
  loginEventRepository,
} from "../repositories";
import env from "../config/env";
import { AUTH } from "../config/constants";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { expiresInToMs, STEP_UP_TTL_MS } from "../utils/cookies";
import { getIdentityProvider } from "../auth/providers";
import type { VerifiedIdentity } from "../auth/providers";
import {
  isRealm,
  realmAcceptsMethod,
  policyForRealm,
  portalUrlForRealm,
  type Realm,
} from "../auth/realms";
import { entitlementsFor, getPortal, homePortalFor } from "../auth/portals";
import { checkPassword, type PasswordRealm } from "../auth/password";
import { clearFailures, lockStateOf, recordFailure } from "../auth/lockout";
import { recordLogin, type RequestContext } from "../auth/loginHistory";
import {
  closeAllSessions,
  closeSession,
  listSessions,
  openSession,
  touchSession,
} from "../auth/sessions";
import { consumeToken, issueToken } from "../auth/verification";
import { identityUrl, sendAuthMail } from "../auth/mailer";
import { DEFAULT_ROLE_FOR_REALM } from "../auth/permissions";

const signAccessToken = (id: string): string =>
  jwt.sign({ id }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN } as jwt.SignOptions);

// Only the SHA-256 hash of the opaque refresh token is ever persisted.
const hashToken = (raw: string): string => crypto.createHash("sha256").update(raw).digest("hex");

/** Mint a new opaque refresh token, persist its hash, return the raw value. */
async function issueRefreshToken(userId: string, sessionId: string | null): Promise<string> {
  const raw = crypto.randomBytes(48).toString("base64url");
  await refreshTokenRepository.create({
    tokenHash: hashToken(raw),
    userId,
    sessionId,
    expiresAt: new Date(Date.now() + expiresInToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
  });
  return raw;
}

async function issueTokens(
  userId: string,
  sessionId: string | null = null
): Promise<{ accessToken: string; refreshToken: string }> {
  return {
    accessToken: signAccessToken(userId),
    refreshToken: await issueRefreshToken(userId, sessionId),
  };
}

/**
 * Open a sitting and issue the credentials that belong to it.
 *
 * Every way in goes through here, so there is one description of what starting
 * a session means rather than four that can drift apart.
 */
async function startSitting(
  user: { id: string; realm: string },
  context?: RequestContext
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const realm = isRealm(user.realm) ? user.realm : "CUSTOMER";
  const session = await openSession({ userId: user.id, realm, ...(context ? { context } : {}) });
  const tokens = await issueTokens(user.id, session.id);
  return { ...tokens, sessionId: session.id };
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
    realm: "CUSTOMER",
    role: DEFAULT_ROLE_FOR_REALM.CUSTOMER,
    image: identity.pictureUrl,
    // The provider refuses to vouch for an unverified address, so this account
    // arrives with its email already proved. Asking again would send someone to
    // a mailbox to confirm something Google just confirmed.
    emailVerifiedAt: new Date(),
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

const STEP_UP_FAILED_MESSAGE = "We couldn't confirm it's you. Please try again.";

const INVALID_CREDENTIALS_MESSAGE = "Incorrect email address or password.";

/**
 * Enforce the workspace-domain restriction that separates "Google" from
 * "Google Workspace".
 *
 * Same protocol, same button, one difference: a staff realm only accepts an
 * address belonging to an organisation this deployment recognises. Without it,
 * anybody with a personal Google account who found the employee portal URL
 * would be handed an account in the employee realm.
 *
 * An empty allowlist in a realm that requires one **fails closed** — refusing
 * everybody is a visible, fixable misconfiguration, whereas admitting everybody
 * is an invisible one.
 */
function assertWorkspaceDomain(
  realm: Realm,
  email: string,
  providerId: string,
  context?: RequestContext
): void {
  if (!policyForRealm(realm).requiresWorkspaceDomain) return;

  const domain = email.split("@")[1]?.toLowerCase();
  const allowed = env.workspaceDomains;

  if (domain && allowed.includes(domain)) return;

  auditService.record({
    action: "authz.workspace_domain.refused",
    metadata: { realm, provider: providerId, domain: domain ?? "none" },
  });
  recordLogin({
    email,
    outcome: "METHOD_NOT_ALLOWED",
    method: providerId,
    realm,
    ...(context ? { context } : {}),
  });

  throw new AppError(
    "That account is not part of an organisation with access to this portal.",
    403,
    "DOMAIN_NOT_ALLOWED"
  );
}

/**
 * Is this person allowed through this door, and which realm are they in?
 *
 * Two separate refusals live here. Knocking on the wrong door is a routing
 * mistake — the account is fine, it simply belongs elsewhere — so it says so
 * plainly and the identity app can offer the right portal. An unverified
 * address in a realm that demands one is a policy refusal, and the caller is
 * told what to do about it.
 *
 * Neither leaks anything an attacker did not already have to know the password
 * to reach.
 */
async function assertRealmAdmits(
  user: { id: string; realm: string; emailVerifiedAt: Date | null },
  requested: Realm,
  fail: (outcome: "WRONG_REALM" | "UNVERIFIED", userId: string) => void
): Promise<Realm> {
  const actual: Realm = isRealm(user.realm) ? user.realm : "CUSTOMER";

  if (actual !== requested) {
    fail("WRONG_REALM", user.id);
    auditService.record({
      actorId: user.id,
      action: "authz.realm.mismatch",
      metadata: { requested, actual },
    });
    throw new AppError(
      `This account signs in through the ${policyForRealm(actual).label.toLowerCase()} portal.`,
      403,
      "WRONG_REALM"
    );
  }

  if (policyForRealm(actual).requiresVerifiedEmail && !user.emailVerifiedAt) {
    fail("UNVERIFIED", user.id);
    throw new AppError(
      "Please confirm your email address before signing in. We have sent you a new link.",
      403,
      "EMAIL_NOT_VERIFIED"
    );
  }

  return actual;
}

/**
 * The step-up token is a JWT rather than a row, because it needs to say only
 * one thing for a very short time and there is nothing worth keeping afterwards.
 *
 * `purpose` is what stops it being interchangeable with an access token. Both
 * are signed with the same key and both name a user, so without it a step-up
 * token would authenticate ordinary requests — and, worse, an access token
 * would satisfy the step-up check, which would make the whole gate decorative.
 */
const STEP_UP_PURPOSE = "step-up";

const signStepUpToken = (id: string): string =>
  jwt.sign({ id, purpose: STEP_UP_PURPOSE }, env.JWT_SECRET, {
    expiresIn: Math.floor(STEP_UP_TTL_MS / 1000),
  });

/**
 * Does this provider credential belong to the account being acted on?
 *
 * Both halves are needed. Verifying the credential proves the provider vouches
 * for somebody; checking the link proves that somebody is *this* customer. On
 * its own, the first would let anyone with any Google account step up as
 * anyone else.
 */
async function providerCredentialBelongsTo(
  userId: string,
  providerId: string | undefined,
  credential: string | undefined
): Promise<boolean> {
  if (!providerId || !credential) return false;

  const provider = getIdentityProvider(providerId);
  if (!provider?.isConfigured) return false;

  const identity = await provider.verify(credential);
  if (!identity) return false;

  const link = await linkedIdentityRepository.findBySubject(identity.provider, identity.subject);
  return link?.userId === userId;
}

/**
 * Every rejected renewal says the same thing. Which of the four reasons it was
 * is useful only to somebody testing tokens against us.
 */
const EXPIRED_SESSION_MESSAGE = "Invalid or expired session. Please log in again.";

/**
 * How long after a token is rotated its predecessor may still turn up
 * innocently.
 *
 * Two of the customer's tabs can start a renewal at the same moment. Rotation
 * is single-use, so one of them wins and the other arrives holding a token that
 * was spent milliseconds ago. That is not an attack, and treating it as one
 * would sign a customer out for the crime of comparing two policies
 * side by side.
 *
 * The window is the honest cost of this defence: a thief replaying a stolen
 * token within a few seconds of the real client using it escapes the sweep.
 * That is a much narrower opening than the one it closes, and it is the
 * trade-off the OAuth reuse-detection guidance settles on for the same reason.
 */
const REFRESH_REUSE_GRACE_MS = 10_000;

/**
 * Someone presented a refresh token that had already been spent.
 *
 * Beyond the grace window there are only two ways this happens, and both mean
 * the same thing: a token that should have been destroyed after one use is in
 * circulation. Since we cannot tell the thief from the victim — they hold
 * credentials from the same lineage — the safe move is to end every session
 * this user has. The customer signs in again, which costs them a password; the
 * thief is left holding tokens that no longer work, which costs them
 * everything.
 *
 * Doing nothing, which is what happened before, meant the *victim's* renewal
 * failed while the thief kept the freshly rotated token they had stolen.
 */
async function handleRefreshReuse(userId: string, revokedAt: Date): Promise<void> {
  const sinceRevoked = Date.now() - revokedAt.getTime();

  if (sinceRevoked <= REFRESH_REUSE_GRACE_MS) {
    // A benign race. The losing tab's next request renews normally against the
    // cookie the winning tab just set.
    auditService.record({ actorId: userId, action: "auth.refresh.race" });
    return;
  }

  // Ends the sittings as well as the credentials. Revoking tokens alone would
  // leave the session rows looking live in the "where am I signed in" list, so
  // a customer checking after a breach would be told the attacker is still there.
  const endedSessions = await closeAllSessions(userId, "REPLAY");
  await refreshTokenRepository.revokeAllForUser(userId);
  auditService.record({
    actorId: userId,
    action: "auth.refresh.replay",
    metadata: { endedSessions, msSinceRotation: sinceRevoked },
  });
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
  realm: true,
  emailVerifiedAt: true,
  createdAt: true,
  image: true,
  lastLoginAt: true,
  onboardedAt: true,
  preferredLanguage: true,
  insuranceInterests: true,
};

/**
 * Reject a password that does not meet the realm's policy.
 *
 * Every problem is reported at once. A form that surfaces one rule per attempt
 * teaches the rules by attrition, and people answer by appending `1!` until it
 * stops complaining — which is how complexity rules produce weak passwords.
 */
function assertPasswordAcceptable(
  password: string,
  realm: PasswordRealm,
  identity: { email?: string | undefined; name?: string | undefined }
): void {
  const check = checkPassword(password, realm, identity);
  if (!check.ok) {
    throw new AppError(check.problems.join(" "), 400, "WEAK_PASSWORD");
  }
}

/**
 * Start the email-verification flow.
 *
 * Never throws and never blocks the caller: a mail that fails to send must not
 * fail the registration that triggered it, or the customer is left with an
 * account they cannot retry creating.
 */
async function sendVerificationMail(user: { id: string; email: string }): Promise<void> {
  try {
    const { token, expiresAt } = await issueToken(user.id, user.email, "EMAIL_VERIFICATION");
    await sendAuthMail({
      to: user.email,
      kind: "EMAIL_VERIFICATION",
      subject: "Confirm your email address",
      actionUrl: identityUrl("/verify-email", { token }),
      expiresAt,
    });
  } catch (error) {
    auditService.record({
      actorId: user.id,
      action: "auth.verification.send_failed",
      metadata: { reason: error instanceof Error ? error.message : "unknown" },
    });
  }
}

export const authService = {
  /**
   * Public self-service registration. `role` is intentionally never read from
   * input — it is always "customer" (no privilege escalation via mass-assignment).
   * Returns the created user + access & refresh tokens; the caller sets cookies.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    context?: RequestContext;
  }) {
    const email = input.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new AppError("Email address already registered.", 400);

    // Public registration is always a customer, so the customer policy applies.
    // A staff account is provisioned, not registered, and gets a stricter one.
    assertPasswordAcceptable(input.password, "CUSTOMER", { email, name: input.name });

    const hashedPassword = await bcrypt.hash(input.password, AUTH.BCRYPT_ROUNDS);
    const user = await userRepository.create(
      // Registering signs the user in, so it is a login like any other.
      {
        name: input.name,
        email,
        password: hashedPassword,
        realm: "CUSTOMER",
        role: DEFAULT_ROLE_FOR_REALM.CUSTOMER,
        passwordChangedAt: new Date(),
        lastLoginAt: new Date(),
      },
      { select: PUBLIC_USER_SELECT }
    );

    const tokens = await startSitting({ id: user.id, realm: "CUSTOMER" }, input.context);
    auditService.record({ actorId: user.id, action: "auth.register", metadata: { email } });
    recordLogin({
      userId: user.id,
      email,
      outcome: "SUCCESS",
      method: "PASSWORD",
      realm: "CUSTOMER",
      ...(input.context ? { context: input.context } : {}),
    });

    // Deliberately not awaited into the response path: the account exists and
    // the customer is signed in whether or not the mail provider is reachable.
    void sendVerificationMail({ id: user.id, email });

    return { user, ...tokens };
  },

  /**
   * Sign in with an email address and a password.
   *
   * The order of the checks is the security property. Whether the realm accepts
   * passwords at all is decided before any credential is examined, so refusing a
   * platform operator at the customer door reveals nothing about the account.
   * Everything after that answers with the same message for the same reason.
   */
  async login(input: {
    email: string;
    password: string;
    /** Which door they knocked on. Absent means the customer portal. */
    realm?: Realm;
    context?: RequestContext;
  }) {
    const email = input.email.toLowerCase().trim();
    const requestedRealm: Realm = input.realm ?? "CUSTOMER";
    const context = input.context;
    const fail = (outcome: Parameters<typeof recordLogin>[0]["outcome"], userId?: string) => {
      recordLogin({
        ...(userId ? { userId } : {}),
        email,
        outcome,
        method: "PASSWORD",
        realm: requestedRealm,
        ...(context ? { context } : {}),
      });
    };

    if (!realmAcceptsMethod(requestedRealm, "PASSWORD")) {
      fail("METHOD_NOT_ALLOWED");
      throw new AppError(
        `${policyForRealm(requestedRealm).label} sign-in does not use a password.`,
        400,
        "METHOD_NOT_ALLOWED"
      );
    }

    const user = await userRepository.findByEmail(email);

    // Constant-time-ish: always run bcrypt (dummy hash when the user is absent).
    const passwordOk = await bcrypt.compare(input.password, user ? user.password : DUMMY_HASH);

    if (!user || !passwordOk) {
      auditService.record({ action: "auth.login.failure", metadata: { email } });
      if (user) {
        fail("BAD_CREDENTIALS", user.id);
        // Counted per account, because the attack that matters is a stolen
        // password list tried against one address from many addresses — which
        // the per-IP limiter in front of this route cannot see.
        await recordFailure(user);
      } else {
        fail("NO_ACCOUNT");
      }
      throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
    }

    // Checked after the password so a locked account cannot be used to confirm
    // that an address exists without knowing the credential.
    const lock = lockStateOf(user);
    if (lock.locked) {
      fail("LOCKED", user.id);
      throw new AppError(
        "Too many failed attempts. Please wait a few minutes and try again, or reset your password.",
        423,
        "ACCOUNT_LOCKED"
      );
    }

    if (!user.isActive) {
      fail("INACTIVE", user.id);
      throw new AppError("This account has been deactivated.", 403);
    }

    const sitting = await assertRealmAdmits(user, requestedRealm, fail);

    await clearFailures(user);
    const tokens = await startSitting({ id: user.id, realm: sitting }, context);
    auditService.record({ actorId: user.id, action: "auth.login.success", metadata: { realm: sitting } });
    recordLogin({
      userId: user.id,
      email,
      outcome: "SUCCESS",
      method: "PASSWORD",
      realm: sitting,
      ...(context ? { context } : {}),
    });

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
  async signInWithProvider(
    providerId: string,
    credential: string,
    options: { realm?: Realm; context?: RequestContext } = {}
  ) {
    const requestedRealm: Realm = options.realm ?? "CUSTOMER";
    const context = options.context;

    const provider = getIdentityProvider(providerId);
    if (!provider) {
      throw new AppError("That sign-in method isn't available.", 400);
    }

    // Asked before configuration, and before any credential is examined.
    // Whether this deployment happens to have Google keys is irrelevant to a
    // realm that would never accept Google anyway — and answering "not
    // configured" there would imply that configuring it would open the door.
    if (!realmAcceptsMethod(requestedRealm, "google")) {
      recordLogin({
        email: "",
        outcome: "METHOD_NOT_ALLOWED",
        method: providerId,
        realm: requestedRealm,
        ...(context ? { context } : {}),
      });
      throw new AppError(
        `${policyForRealm(requestedRealm).label} sign-in does not use ${provider.label}.`,
        400,
        "METHOD_NOT_ALLOWED"
      );
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
      recordLogin({
        email: "",
        outcome: "PROVIDER_REJECTED",
        method: providerId,
        realm: requestedRealm,
        ...(context ? { context } : {}),
      });
      throw new AppError(`Could not verify your ${provider.label} account. Please try again.`, 401);
    }

    // "Google Workspace" is Google, restricted to organisations we recognise.
    // Without this a staff realm would accept any personal Google account that
    // happened to know the portal URL.
    assertWorkspaceDomain(requestedRealm, identity.email, providerId, context);

    const { user, isNewAccount } = await resolveUserForIdentity(identity);

    if (!user.isActive) {
      recordLogin({
        userId: user.id,
        email: identity.email,
        outcome: "INACTIVE",
        method: providerId,
        realm: requestedRealm,
        ...(context ? { context } : {}),
      });
      throw new AppError("This account has been deactivated.", 403);
    }

    const sitting = await assertRealmAdmits(user, requestedRealm, (outcome, userId) => {
      recordLogin({
        userId,
        email: identity.email,
        outcome,
        method: providerId,
        realm: requestedRealm,
        ...(context ? { context } : {}),
      });
    });

    await clearFailures(user);
    const tokens = await startSitting({ id: user.id, realm: sitting }, context);
    auditService.record({
      actorId: user.id,
      action: isNewAccount ? "auth.register.provider" : "auth.login.provider.success",
      metadata: { provider: providerId, realm: sitting },
    });
    recordLogin({
      userId: user.id,
      email: identity.email,
      outcome: "SUCCESS",
      method: providerId,
      realm: sitting,
      ...(context ? { context } : {}),
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

    if (!record) {
      auditService.record({ action: "auth.refresh.rejected" });
      throw new AppError(EXPIRED_SESSION_MESSAGE, 401);
    }

    // A token that has already been spent is the one case worth investigating.
    if (record.revokedAt) {
      await handleRefreshReuse(record.userId, record.revokedAt);
      throw new AppError(EXPIRED_SESSION_MESSAGE, 401);
    }

    if (record.expiresAt < new Date()) {
      auditService.record({ actorId: record.userId, action: "auth.refresh.rejected" });
      throw new AppError(EXPIRED_SESSION_MESSAGE, 401);
    }

    // The refresh token proves nothing about the account's *current* standing —
    // only that this credential was issued once. A 15-minute access token means
    // a session naturally dies quickly, but refresh is exactly the path that
    // renews it, so it is where a deactivated or deleted account must actually
    // be stopped rather than 30 days later when the refresh token itself
    // expires. Not checked here on purpose: `lockedUntil`. That lock is a
    // transient anti-guessing measure at the *login* gate — it says nothing
    // about a session that was already legitimately established, and ending it
    // would let anyone who knows an address lock a stranger out of a session
    // they are actively using, just by failing that stranger's password
    // elsewhere.
    const user = await userRepository.findById(record.userId);
    if (!user || !user.isActive || user.deletedAt) {
      await refreshTokenRepository.revokeById(record.id);
      auditService.record({
        actorId: record.userId,
        action: "auth.refresh.rejected",
        metadata: { reason: !user ? "account_missing" : user.deletedAt ? "account_deleted" : "account_inactive" },
      });
      throw new AppError(EXPIRED_SESSION_MESSAGE, 401);
    }

    await refreshTokenRepository.revokeById(record.id); // rotate: single-use

    // The sitting outlives the credential — rotation replaces the token many
    // times over one session — so renewal is what keeps its "last seen" honest.
    // Without this, an actively used session looks abandoned in the session
    // list, and any idle sweep built on that would evict live users.
    await touchSession(record.sessionId);

    const tokens = await issueTokens(record.userId, record.sessionId);
    auditService.record({ actorId: record.userId, action: "auth.refresh" });
    return { userId: record.userId, ...tokens };
  },

  /**
   * Prove, again and just now, that the account holder is the one acting.
   *
   * Two ways to answer, because there are two ways in. Requiring a password
   * would permanently bar anyone whose account was created through a provider
   * — their password is random and was never disclosed — from the very actions
   * this is meant to guard. So a provider credential is accepted too, on the
   * condition that the identity it resolves to is already linked to *this*
   * account. Verifying it in isolation would only prove that somebody,
   * somewhere, can sign in to something.
   *
   * Returns a short-lived token; the caller puts it on the wire.
   */
  async stepUp(
    userId: string,
    input: { password?: string; provider?: string; credential?: string }
  ): Promise<string> {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError(STEP_UP_FAILED_MESSAGE, 401);

    const proven = input.password
      ? await bcrypt.compare(input.password, user.password)
      : await providerCredentialBelongsTo(userId, input.provider, input.credential);

    if (!proven) {
      auditService.record({
        actorId: userId,
        action: "auth.stepup.failed",
        metadata: { method: input.password ? "password" : "provider" },
      });
      throw new AppError(STEP_UP_FAILED_MESSAGE, 401);
    }

    auditService.record({
      actorId: userId,
      action: "auth.stepup.success",
      metadata: { method: input.password ? "password" : "provider" },
    });
    return signStepUpToken(userId);
  },

  /** Best-effort revoke on logout so the refresh token can't be reused. */
  async revokeRefreshToken(rawRefresh: string | null) {
    if (!rawRefresh) return;
    const record = await refreshTokenRepository.findByHash(hashToken(rawRefresh));
    if (record && !record.revokedAt) {
      await refreshTokenRepository.revokeById(record.id);
      // Close the sitting too. Revoking only the credential would leave the
      // session showing as live in "where am I signed in", so a customer who
      // signed out on a shared machine would be told they had not.
      if (record.sessionId) await closeSession(record.sessionId, "LOGOUT");
      auditService.record({ actorId: record.userId, action: "auth.logout" });
    }
  },

  /**
   * Sign out everywhere.
   *
   * Separate from `logout` because they answer different needs: one ends this
   * sitting, the other is what a person reaches for when they think somebody
   * else has their password. Conflating them would mean either logging a
   * customer out of their phone every time they close a laptop tab, or offering
   * no way to actually evict an intruder.
   */
  async logoutEverywhere(userId: string) {
    const endedSessions = await closeAllSessions(userId, "LOGOUT_ALL");
    return { endedSessions };
  },

  /**
   * Open a fresh sitting for someone who is already authenticated.
   *
   * Used after a password change, which deliberately ends every sitting
   * including the caller's. Without this they would be signed out for securing
   * their own account, which teaches people not to do it.
   */
  async reissueSession(userId: string, context?: RequestContext) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("Session no longer valid. Please log in again.", 401);
    return startSitting({ id: user.id, realm: user.realm }, context);
  },

  // ── Portal gateway ─────────────────────────────────────────────────────────

  /**
   * What the gateway should show this person.
   *
   * The realm is read from the stored record, never from the request. A client
   * that could name its own realm would be choosing its own authorisation.
   */
  async portalsFor(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("Session no longer valid. Please log in again.", 401);

    const realm: Realm = isRealm(user.realm) ? user.realm : "CUSTOMER";
    return {
      realm,
      home: homePortalFor(realm).id,
      portals: entitlementsFor(realm),
    };
  },

  /**
   * Ask to enter a portal, and be told where to go — or refused.
   *
   * The destination is returned by the server rather than assembled by the
   * client. That is what makes a hand-edited address bar useless: there is no
   * URL to tamper with, because the client never held one it was not entitled
   * to. Both outcomes are audited, because a refusal here is somebody trying a
   * door that is not theirs and that is worth being able to see later.
   */
  async enterPortal(userId: string, portalId: string, context?: RequestContext) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("Session no longer valid. Please log in again.", 401);
    if (!user.isActive) throw new AppError("This account has been deactivated.", 403);

    const realm: Realm = isRealm(user.realm) ? user.realm : "CUSTOMER";
    const portal = getPortal(portalId);

    // An unknown portal and a forbidden one answer identically. Telling somebody
    // that "enterprise" exists but is refused, while "warehouse" does not exist,
    // maps the estate out for whoever is guessing.
    if (!portal || portal.realm !== realm) {
      auditService.record({
        actorId: userId,
        action: "authz.portal.denied",
        metadata: {
          requested: portalId,
          realm,
          ip: context?.ipAddress ?? null,
        },
      });
      throw new AppError(
        "You do not have access to that workspace.",
        403,
        "PORTAL_FORBIDDEN"
      );
    }

    auditService.record({
      actorId: userId,
      action: "authz.portal.entered",
      metadata: { portal: portal.id, realm },
    });

    return { portal: portal.id, url: portalUrlForRealm(realm) };
  },

  /** What is signed in to this account right now. Carries no token material. */
  async listSessions(userId: string) {
    return listSessions(userId);
  },

  /** A customer's own sign-in history — successes and failures alike. */
  async loginHistory(userId: string, take = 50) {
    const events = await loginEventRepository.listForUser(userId, take);
    return events.map((event) => ({
      outcome: event.outcome,
      method: event.method,
      realm: event.realm,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      at: event.createdAt,
    }));
  },

  // ── Email verification ─────────────────────────────────────────────────────

  /**
   * Send (or re-send) a verification link.
   *
   * Answers identically whether or not the address belongs to an account. This
   * endpoint is otherwise a free membership oracle: anybody could enumerate who
   * has an Aegis account by watching which addresses produce a different reply.
   */
  async requestEmailVerification(rawEmail: string) {
    const email = rawEmail.toLowerCase().trim();
    const user = await userRepository.findByEmail(email);

    if (user && !user.emailVerifiedAt) {
      await sendVerificationMail({ id: user.id, email });
    }
  },

  /**
   * Confirm an address.
   *
   * Idempotent from the customer's point of view: a second click on the same
   * link finds the token spent and says so, rather than appearing to fail.
   */
  async verifyEmail(token: string) {
    const result = await consumeToken(token, "EMAIL_VERIFICATION");
    if (!result.ok) {
      throw new AppError(
        "That confirmation link is no longer valid. Please request a new one.",
        400,
        "INVALID_TOKEN"
      );
    }

    // The token is bound to the address it was issued for. `consumeToken`
    // offers this check as a caller-supplied `currentEmail`, but neither this
    // call nor resetPassword's can supply it *before* the lookup — the token
    // is the only thing that says whose account this is, which is exactly
    // what consuming it just resolved. So the same check runs here instead,
    // now that the account is known: if the stored address has since moved on
    // — corrected, or changed in settings — a link mailed to the old one must
    // not still confirm the new one on its behalf.
    const current = await userRepository.findById(result.userId);
    if (!current || current.email !== result.email) {
      auditService.record({
        actorId: result.userId,
        action: "auth.token.email_changed",
        metadata: { purpose: "EMAIL_VERIFICATION" },
      });
      throw new AppError(
        "That confirmation link is no longer valid. Please request a new one.",
        400,
        "INVALID_TOKEN"
      );
    }

    const user = await userRepository.update(result.userId, { emailVerifiedAt: new Date() });
    auditService.record({ actorId: result.userId, action: "auth.email.verified" });

    const { password: _pw, ...withoutPassword } = user;
    void _pw;
    return withoutPassword;
  },

  // ── Password reset ─────────────────────────────────────────────────────────

  /**
   * Begin a reset.
   *
   * Like verification, this answers identically for an address we do not know.
   * A different reply — or even a noticeably different response time — turns
   * the forgotten-password form into a list of who banks with us.
   */
  async requestPasswordReset(rawEmail: string, context?: RequestContext) {
    const email = rawEmail.toLowerCase().trim();
    const user = await userRepository.findByEmail(email);

    if (!user) return;

    try {
      const { token, expiresAt } = await issueToken(user.id, email, "PASSWORD_RESET");
      await sendAuthMail({
        to: email,
        kind: "PASSWORD_RESET",
        subject: "Reset your Aegis password",
        actionUrl: identityUrl("/reset-password", { token }),
        expiresAt,
      });
      auditService.record({
        actorId: user.id,
        action: "auth.password.reset_requested",
        metadata: { ip: context?.ipAddress ?? null },
      });
    } catch (error) {
      auditService.record({
        actorId: user.id,
        action: "auth.password.reset_send_failed",
        metadata: { reason: error instanceof Error ? error.message : "unknown" },
      });
    }
  },

  /**
   * Finish a reset.
   *
   * Every existing sitting ends. Whoever prompted this reset may be holding a
   * live session right now — that is the usual reason a person resets — and a
   * new password that leaves the intruder signed in has achieved nothing.
   */
  async resetPassword(token: string, newPassword: string, context?: RequestContext) {
    const result = await consumeToken(token, "PASSWORD_RESET");
    if (!result.ok) {
      throw new AppError(
        "That reset link is no longer valid. Please request a new one.",
        400,
        "INVALID_TOKEN"
      );
    }

    const user = await userRepository.findById(result.userId);
    if (!user) throw new AppError("That reset link is no longer valid.", 400, "INVALID_TOKEN");

    // Same reasoning as verifyEmail: bound to the address it was sent to, and
    // must stop working the moment that is no longer the account's — an
    // abandoned mailbox should not keep the power to control this account.
    if (user.email !== result.email) {
      auditService.record({
        actorId: user.id,
        action: "auth.token.email_changed",
        metadata: { purpose: "PASSWORD_RESET" },
      });
      throw new AppError("That reset link is no longer valid. Please request a new one.", 400, "INVALID_TOKEN");
    }

    const realm: PasswordRealm = isRealm(user.realm) ? user.realm : "CUSTOMER";
    assertPasswordAcceptable(newPassword, realm, { email: user.email, name: user.name });

    await userRepository.update(user.id, {
      password: await bcrypt.hash(newPassword, AUTH.BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
      // A completed reset proves control of the mailbox, which is the same
      // thing verification asks for. Making them do it twice serves nobody.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    const endedSessions = await closeAllSessions(user.id, "PASSWORD_CHANGED");
    await refreshTokenRepository.revokeAllForUser(user.id);

    auditService.record({
      actorId: user.id,
      action: "auth.password.reset",
      metadata: { endedSessions, ip: context?.ipAddress ?? null },
    });

    // Told, not asked. If this reset was not theirs, this message is how they
    // find out — so it goes even when everything succeeded.
    void sendAuthMail({
      to: user.email,
      kind: "PASSWORD_CHANGED",
      subject: "Your Aegis password was changed",
    });

    return { endedSessions };
  },

  /**
   * Change a password from inside a session.
   *
   * The current password is required even though the caller is already signed
   * in. Without it, a borrowed unlocked laptop is a permanent account takeover
   * — and the session cookie alone cannot tell the owner from whoever sat down.
   */
  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
    context?: RequestContext
  ) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("Session no longer valid. Please log in again.", 401);

    const currentOk = await bcrypt.compare(input.currentPassword, user.password);
    if (!currentOk) {
      auditService.record({ actorId: userId, action: "auth.password.change_rejected" });
      throw new AppError("That is not your current password.", 401);
    }

    if (input.currentPassword === input.newPassword) {
      throw new AppError("Please choose a password you have not used here before.", 400);
    }

    const realm: PasswordRealm = isRealm(user.realm) ? user.realm : "CUSTOMER";
    assertPasswordAcceptable(input.newPassword, realm, { email: user.email, name: user.name });

    await userRepository.update(user.id, {
      password: await bcrypt.hash(input.newPassword, AUTH.BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
    });

    // Ends other sittings, not this one — the caller keeps working. The route
    // re-issues their credentials immediately afterwards.
    const endedSessions = await closeAllSessions(user.id, "PASSWORD_CHANGED");
    await refreshTokenRepository.revokeAllForUser(user.id);

    auditService.record({
      actorId: user.id,
      action: "auth.password.changed",
      metadata: { endedSessions, ip: context?.ipAddress ?? null },
    });

    void sendAuthMail({
      to: user.email,
      kind: "PASSWORD_CHANGED",
      subject: "Your Aegis password was changed",
    });

    return { endedSessions };
  },
};
