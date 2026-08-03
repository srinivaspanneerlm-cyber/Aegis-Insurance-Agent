import { authService } from "../services/auth.service";
import catchAsync from "../utils/catchAsync";
import {
  setAuthCookie,
  clearAuthCookie,
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshFromCookies,
} from "../utils/cookies";
import { sendSuccess } from "../utils/apiResponse";

const register = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  setAuthCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
  // `token` (access) stays at the top level for backward compatibility.
  sendSuccess(res, 201, { user }, { token: accessToken });
});

const login = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  setAuthCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, 200, { user }, { token: accessToken });
});

const googleLogin = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.googleLogin(req.body.credential);
  setAuthCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, 200, { user }, { token: accessToken });
});

// Exchange the refresh cookie for a fresh access token (rotates the refresh
// token). The refresh token itself is the credential — no access token needed.
const refresh = catchAsync(async (req, res) => {
  const { accessToken, refreshToken } = await authService.refresh(readRefreshFromCookies(req));
  setAuthCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, 200, undefined, { token: accessToken, message: "Token refreshed." });
});

const logout = catchAsync(async (req, res) => {
  // Revoke the refresh token server-side, then clear both cookies so the
  // session cannot be reused from the browser.
  await authService.revokeRefreshToken(readRefreshFromCookies(req));
  clearAuthCookie(res);
  clearRefreshCookie(res);
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

export { register, login, googleLogin, refresh, logout, getMe, completeOnboarding };
