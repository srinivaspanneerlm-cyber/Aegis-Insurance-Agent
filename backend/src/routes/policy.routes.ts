import express from "express";
import * as policyController from "../controllers/policy.controller";
import { protect, requirePermission, requireFreshAuth } from "../middleware/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import { policySchema, idParamSchema, paginationQuerySchema } from "../validations/schemas";

const router = express.Router();

// Publicly viewable insurance products
router.get("/", validateQuery(paginationQuerySchema), policyController.getPolicies);
router.get("/:id", validateParams(idParamSchema), policyController.getPolicyById);

// Administrative creation. A policy published here is what customers are shown
// and priced against, so it asks for confirmation the way the other
// catalogue-changing actions do.
router.post(
  "/",
  protect,
  requirePermission("policy.write"),
  requireFreshAuth,
  validateBody(policySchema),
  policyController.createPolicy
);

export = router;
