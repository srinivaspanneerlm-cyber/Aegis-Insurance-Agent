import express from "express";
import * as authController from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  registerSchema,
  loginSchema,
  providerCredentialSchema,
  stepUpSchema,
  emailOnlySchema,
  verifyEmailSchema,
  resetPasswordSchema,
  changePasswordSchema,
  onboardingSchema,
} from "../validations/schemas";
import { authLimiter } from "../config/security";

const router = express.Router();

// ── Entry ────────────────────────────────────────────────────────────────────

router.post("/register", authLimiter, validateBody(registerSchema), authController.register);
router.post("/login", authLimiter, validateBody(loginSchema), authController.login);

// Which providers this deployment offers, for the sign-in screen.
router.get("/providers", authController.listProviders);
// One route per provider, chosen by path. `/google` predates the registry and
// is kept because the portal in the field still calls it.
router.post(
  "/google",
  authLimiter,
  validateBody(providerCredentialSchema),
  authController.providerLogin
);
router.post(
  "/oauth/:provider",
  authLimiter,
  validateBody(providerCredentialSchema),
  authController.providerLogin
);

// ── Session ──────────────────────────────────────────────────────────────────

// The refresh cookie is the credential here (not the access token), so no
// `protect` — but the auth throttle still applies.
router.post("/refresh", authLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.post("/logout-all", protect, authController.logoutEverywhere);
router.get("/me", protect, authController.getMe);
// What is signed in to this account, and the history behind it. Both are the
// customer's own data, which is why they sit here rather than behind a
// staff-only capability.
router.get("/sessions", protect, authController.listSessions);

// ── Portal gateway ───────────────────────────────────────────────────────────
// Which workspaces this person may enter, and the act of entering one. Both
// require a session; entering is a POST because it records an event and can be
// refused, neither of which belongs in a prefetchable GET.
router.get("/portals", protect, authController.listPortals);
router.post("/portals/:portal/enter", protect, authController.enterPortal);
router.get("/login-history", protect, authController.loginHistory);

// Re-confirm the account holder. Throttled with the other credential-testing
// endpoints, because that is exactly what it is.
router.post("/step-up", authLimiter, protect, validateBody(stepUpSchema), authController.stepUp);

// ── Email verification ───────────────────────────────────────────────────────

// Unauthenticated on purpose: somebody who cannot sign in because their address
// is unverified still needs to be able to ask for a new link.
router.post(
  "/verify-email/request",
  authLimiter,
  validateBody(emailOnlySchema),
  authController.requestEmailVerification
);
router.post(
  "/verify-email",
  authLimiter,
  validateBody(verifyEmailSchema),
  authController.verifyEmail
);

// ── Password ─────────────────────────────────────────────────────────────────

router.post(
  "/forgot-password",
  authLimiter,
  validateBody(emailOnlySchema),
  authController.requestPasswordReset
);
router.post(
  "/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword
);
// Requires a session *and* the current password. The session alone cannot tell
// the account holder from whoever borrowed an unlocked laptop.
router.patch(
  "/password",
  authLimiter,
  protect,
  validateBody(changePasswordSchema),
  authController.changePassword
);

// ── Profile ──────────────────────────────────────────────────────────────────

router.patch(
  "/me/onboarding",
  protect,
  validateBody(onboardingSchema),
  authController.completeOnboarding
);

export = router;
