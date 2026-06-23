const express = require("express");
const policyController = require("../controllers/policy.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { validateBody } = require("../middleware/validate.middleware");
const { policySchema } = require("../validations/schemas");

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

module.exports = router;
