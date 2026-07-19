import { authService } from "../services/auth.service";
import catchAsync from "../utils/catchAsync";
import { setAuthCookie, clearAuthCookie } from "../utils/cookies";
import { sendSuccess } from "../utils/apiResponse";

const register = catchAsync(async (req, res) => {
  const { user, token } = await authService.register(req.body);
  setAuthCookie(res, token);
  sendSuccess(res, 201, { user }, { token });
});

const login = catchAsync(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  setAuthCookie(res, token);
  sendSuccess(res, 200, { user }, { token });
});

const logout = catchAsync(async (_req, res) => {
  // Clear the auth cookie so the session cannot be reused from the browser.
  clearAuthCookie(res);
  sendSuccess(res, 200, undefined, { message: "Logged out." });
});

const getMe = catchAsync(async (req, res) => {
  // req.user has already been verified and injected by the protect middleware.
  const { password: _pw, ...userWithoutPassword } = req.user!;
  void _pw;
  sendSuccess(res, 200, { user: userWithoutPassword });
});

export { register, login, logout, getMe };
