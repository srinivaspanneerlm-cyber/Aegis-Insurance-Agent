import type { Response } from "express";
import { authService } from "../services/auth.service";
import catchAsync from "../utils/catchAsync";
import {
  setAuthCookie,
  clearAuthCookie,
  setRefreshCookie,
  clearRefreshCookie,
  setSessionCookie,
  clearSessionCookie,
  readRefreshFromCookies,
} from "../utils/cookies";
import { sendSuccess } from "../utils/apiResponse";
import { enabledProviders } from "../auth/providers";

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
}

const register = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  startSession(res, accessToken, refreshToken);
  // `token` (access) stays at the top level for backward compatibility.
  sendSuccess(res, 201, { user }, { token: accessToken });
});

const login = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  startSession(res, accessToken, refreshToken);
  sendSuccess(res, 200, { user }, { token: accessToken });
});

// Sign in with an external identity provider. The provider comes from the URL,
// never from the body — the route is what decides who is trusted to identify a
// customer, and that should not be something a request body can rewrite.
const providerLogin = catchAsync(async (req, res) => {
  const { provider } = req.params;
  const providerId = typeof provider === "string" ? provider : "google";
  const { user, accessToken, refreshToken } = await authService.signInWithProvider(
    providerId,
    req.body.credential
  );
  startSession(res, accessToken, refreshToken);
  sendSuccess(res, 200, { user }, { token: accessToken });
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
  // req.user has already been verified and injected by the protect middleware.
  const { password: _pw, ...userWithoutPassword } = req.user!;
  void _pw;
  sendSuccess(res, 200, { user: userWithoutPassword });
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
  getMe,
  completeOnboarding,
};
