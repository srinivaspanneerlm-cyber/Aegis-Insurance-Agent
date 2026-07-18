import express from "express";
import * as policyController from "../controllers/policy.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { policySchema } from "../validations/schemas";

const router = express.Router();

// Publicly viewable insurance products
router.get("/", policyController.getPolicies);
router.get("/:id", policyController.getPolicyById);

// Administrative creation
router.post(
  "/",
  protect,
  restrictTo("admin", "superadmin"),
  validateBody(policySchema),
  policyController.createPolicy
);

export = router;
