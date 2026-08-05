import express from "express";
import * as authController from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  registerSchema,
  loginSchema,
  providerCredentialSchema,
  onboardingSchema,
} from "../validations/schemas";
import { authLimiter } from "../config/security";

const router = express.Router();

router.post("/register", authLimiter, validateBody(registerSchema), authController.register);
router.post("/login", authLimiter, validateBody(loginSchema), authController.login);
// Which providers this deployment offers, for the sign-in screen.
router.get("/providers", authController.listProviders);
// One route per provider, chosen by path. `/google` predates the registry and
// is kept because the portal in the field still calls it.
router.post("/google", authLimiter, validateBody(providerCredentialSchema), authController.providerLogin);
router.post(
  "/oauth/:provider",
  authLimiter,
  validateBody(providerCredentialSchema),
  authController.providerLogin
);
// The refresh cookie is the credential here (not the access token), so no
// `protect` — but the auth throttle still applies.
router.post("/refresh", authLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", protect, authController.getMe);
router.patch(
  "/me/onboarding",
  protect,
  validateBody(onboardingSchema),
  authController.completeOnboarding
);

export = router;
