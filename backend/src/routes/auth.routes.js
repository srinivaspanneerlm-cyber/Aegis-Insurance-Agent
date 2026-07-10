const express = require("express");
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { validateBody } = require("../middleware/validate.middleware");
const { registerSchema, loginSchema } = require("../validations/schemas");
const { authLimiter } = require("../config/security");

const router = express.Router();

router.post("/register", authLimiter, validateBody(registerSchema), authController.register);
router.post("/login", authLimiter, validateBody(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.get("/me", protect, authController.getMe);

module.exports = router;
