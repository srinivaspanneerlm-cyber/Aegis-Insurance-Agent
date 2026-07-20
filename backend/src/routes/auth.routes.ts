import express from "express";
import * as authController from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { registerSchema, loginSchema } from "../validations/schemas";
import { authLimiter } from "../config/security";

const router = express.Router();

router.post("/register", authLimiter, validateBody(registerSchema), authController.register);
router.post("/login", authLimiter, validateBody(loginSchema), authController.login);
// The refresh cookie is the credential here (not the access token), so no
// `protect` — but the auth throttle still applies.
router.post("/refresh", authLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", protect, authController.getMe);

export = router;
