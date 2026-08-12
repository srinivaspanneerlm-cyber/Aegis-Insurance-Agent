import type { Response } from "express";
import { authService, PUBLIC_USER_SELECT } from "../services/auth.service";
import catchAsync from "../utils/catchAsync";
import {
  setAuthCookie,
  clearAuthCookie,
  setRefreshCookie,
  clearRefreshCookie,
  setSessionCookie,
  clearSessionCookie,
  readRefreshFromCookies,
  setStepUpCookie,
  clearStepUpCookie,
  STEP_UP_TTL_MS,
} from "../utils/cookies";
import { sendSuccess } from "../utils/apiResponse";
import { enabledProviders } from "../auth/providers";
import { permissionsForRole } from "../auth/permissions";
import { isRealm, portalUrlForRealm } from "../auth/realms";
import { contextFrom } from "../auth/loginHistory";

/**
 * Put a session on the wire. Every way in — register, password, Google, refresh
 * — issues the identical set of cookies, so there is one description of what a
 * session is rather than four that can drift apart.
 */
function startSession(res: Response, accessToken: string, refreshToken: string): void {
  setAuthCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
  setSessionCookie(res);
}

/** Take it back off the wire. The mirror of `startSession`. */
function endSession(res: Response): void {
  clearAuthCookie(res);
  clearRefreshCookie(res);
  clearSessionCookie(res);
  // A confirmation outlives the session it was granted in unless it is cleared
  // here — which on a shared device would hand the next person a head start.
  clearStepUpCookie(res);
}

/**
 * What a client is told about a signed-in person.
 *
 * One shape from every entry point — register, login, provider, refresh — so
 * the identity app has a single thing to read rather than four that can drift.
 * `portalUrl` is included because the client's next act is always to leave for
 * that portal, and making it derive the destination itself would put the
 * routing rules in two places.
 */
function sessionPayload(user: { role: string; realm: string }) {
  const realm = isRealm(user.realm) ? user.realm : "CUSTOMER";
  return {
    user,
    permissions: permissionsForRole(user.role),
    realm,
    portalUrl: portalUrlForRealm(realm),
  };
}

const register = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register({
    ...req.body,
    context: contextFrom(req),
  });
  startSession(res, accessToken, refreshToken);
  // `token` (access) stays at the top level for backward compatibility.
  sendSuccess(res, 201, sessionPayload(user), { token: accessToken });
});

const login = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login({
    email: req.body.email,
    password: req.body.password,
    ...(req.body.realm ? { realm: req.body.realm } : {}),
    context: contextFrom(req),
  });
  startSession(res, accessToken, refreshToken);
  sendSuccess(res, 200, sessionPayload(user), { token: accessToken });
});

// Sign in with an external identity provider. The provider comes from the URL,
// never from the body — the route is what decides who is trusted to identify a
// customer, and that should not be something a request body can rewrite.
const providerLogin = catchAsync(async (req, res) => {
  const { provider } = req.params;
  const providerId = typeof provider === "string" ? provider : "google";
  const { user, accessToken, refreshToken } = await authService.signInWithProvider(
    providerId,
    req.body.credential,
    {
      ...(req.body.realm ? { realm: req.body.realm } : {}),
      context: contextFrom(req),
    }
  );
  startSession(res, accessToken, refreshToken);
  sendSuccess(res, 200, sessionPayload(user), { token: accessToken });
});

// Which sign-in buttons this deployment can actually offer. Public: it reveals
// nothing that the login page does not already show.
const listProviders = catchAsync(async (_req, res) => {
  sendSuccess(res, 200, { providers: enabledProviders() });
});

// Exchange the refresh cookie for a fresh access token (rotates the refresh
// token). The refresh token itself is the credential — no access token needed.
const refresh = catchAsync(async (req, res) => {
  const { accessToken, refreshToken } = await authService.refresh(readRefreshFromCookies(req));
  startSession(res, accessToken, refreshToken);
  sendSuccess(res, 200, undefined, { token: accessToken, message: "Token refreshed." });
});

const logout = catchAsync(async (req, res) => {
  // Revoke the refresh token server-side, then clear every session cookie so
  // the session cannot be reused from the browser.
  await authService.revokeRefreshToken(readRefreshFromCookies(req));
  endSession(res);
  sendSuccess(res, 200, undefined, { message: "Logged out." });
});

const getMe = catchAsync(async (req, res) => {
  // req.user is the whole stored row, and dropping the password hash is not the
  // same as choosing what to publish: this was also returning failedLoginAttempts,
  // lockedUntil, mfaMethod, passwordChangedAt and the row version — account
  // internals the client has no use for, and which register and login already
  // decline to send. Project it through the same field list those use, so the
  // four entry points describe a person identically.
  const user = req.user!;
  const source = user as unknown as Record<string, unknown>;
  const userWithoutPassword = {
    ...Object.fromEntries(Object.keys(PUBLIC_USER_SELECT).map((f) => [f, source[f]])),
    // Named explicitly because `sessionPayload` derives permissions and the
    // portal from them, and a spread of string keys cannot promise they exist.
    role: user.role,
    realm: user.realm,
  };
  // Resolved capabilities travel with the user so the client can decide what to
  // *render*. It is never what decides what may happen: the API re-derives this
  // from the stored role on every request it serves.
  sendSuccess(res, 200, sessionPayload(userWithoutPassword));
});

// ── Email verification ───────────────────────────────────────────────────────

// Answers identically whether or not the address belongs to an account.
// Anything else turns this endpoint into a list of who has an Aegis account.
const requestEmailVerification = catchAsync(async (req, res) => {
  await authService.requestEmailVerification(req.body.email);
  sendSuccess(res, 202, undefined, {
    message: "If that address needs confirming, we have sent a link to it.",
  });
});

const verifyEmail = catchAsync(async (req, res) => {
  const user = await authService.verifyEmail(req.body.token);
  sendSuccess(res, 200, { user }, { message: "Email address confirmed." });
});

// ── Password reset ───────────────────────────────────────────────────────────

const requestPasswordReset = catchAsync(async (req, res) => {
  await authService.requestPasswordReset(req.body.email, contextFrom(req));
  sendSuccess(res, 202, undefined, {
    message: "If we have an account for that address, we have sent a reset link.",
  });
});

// A completed reset ends every sitting, including any the attacker held — so
// the person resetting is signed out too and lands on the sign-in page. That is
// the correct outcome: they have just proved the mailbox, not the browser.
const resetPassword = catchAsync(async (req, res) => {
  const { endedSessions } = await authService.resetPassword(
    req.body.token,
    req.body.password,
    contextFrom(req)
  );
  endSession(res);
  sendSuccess(res, 200, { endedSessions }, { message: "Password changed. Please sign in." });
});

/**
 * Change a password from inside a session.
 *
 * Other sittings end; this one is re-issued immediately, so the person who
 * changed it keeps working and everybody else is evicted.
 */
const changePassword = catchAsync(async (req, res) => {
  const { endedSessions } = await authService.changePassword(
    req.user!.id,
    { currentPassword: req.body.currentPassword, newPassword: req.body.newPassword },
    contextFrom(req)
  );

  const { accessToken, refreshToken } = await authService.reissueSession(
    req.user!.id,
    contextFrom(req)
  );
  startSession(res, accessToken, refreshToken);
  sendSuccess(res, 200, { endedSessions }, { token: accessToken, message: "Password changed." });
});

// ── Portal gateway ───────────────────────────────────────────────────────────

// What the gateway shows: every portal, with a URL only on the one this person
// may enter. A client cannot construct a destination it was never given.
const listPortals = catchAsync(async (req, res) => {
  sendSuccess(res, 200, await authService.portalsFor(req.user!.id));
});

/**
 * Ask to enter a portal.
 *
 * A POST rather than a GET because it is not a lookup — it records that
 * somebody entered, and a refusal here is somebody trying a door that is not
 * theirs. Neither belongs in a cacheable, prefetchable, link-shareable request.
 */
const enterPortal = catchAsync(async (req, res) => {
  const { portal } = req.params;
  const result = await authService.enterPortal(
    req.user!.id,
    typeof portal === "string" ? portal : "",
    contextFrom(req)
  );
  sendSuccess(res, 200, result);
});

// ── Session monitoring ───────────────────────────────────────────────────────

const listSessions = catchAsync(async (req, res) => {
  sendSuccess(res, 200, { sessions: await authService.listSessions(req.user!.id) });
});

const loginHistory = catchAsync(async (req, res) => {
  sendSuccess(res, 200, { events: await authService.loginHistory(req.user!.id) });
});

// Sign out everywhere. Distinct from logout because this is what a person
// reaches for when they think somebody else has their password.
const logoutEverywhere = catchAsync(async (req, res) => {
  const { endedSessions } = await authService.logoutEverywhere(req.user!.id);
  endSession(res);
  sendSuccess(res, 200, { endedSessions }, { message: "Signed out on every device." });
});

// Re-confirm the account holder before an action that cannot be undone. The
// user comes from `protect`, so this can only ever raise the caller's own
// confidence level — never somebody else's.
const stepUp = catchAsync(async (req, res) => {
  const token = await authService.stepUp(req.user!.id, {
    password: req.body.password,
    provider: req.body.provider,
    credential: req.body.credential,
  });
  setStepUpCookie(res, token);
  // The client is told how long the confirmation lasts so it can avoid
  // prompting again inside the window — the cookie itself is httpOnly and
  // unreadable to it.
  sendSuccess(res, 200, { expiresInMs: STEP_UP_TTL_MS }, { message: "Confirmed." });
});

// Finish first-time onboarding. The user comes from `protect`, never from the
// body, so nobody can complete somebody else's onboarding.
const completeOnboarding = catchAsync(async (req, res) => {
  const user = await authService.completeOnboarding(req.user!.id, {
    preferredLanguage: req.body.preferredLanguage,
    insuranceInterests: req.body.insuranceInterests,
  });
  sendSuccess(res, 200, { user });
});

export {
  register,
  login,
  providerLogin,
  listProviders,
  refresh,
  logout,
  logoutEverywhere,
  getMe,
  stepUp,
  completeOnboarding,
  requestEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  listSessions,
  loginHistory,
  listPortals,
  enterPortal,
};
