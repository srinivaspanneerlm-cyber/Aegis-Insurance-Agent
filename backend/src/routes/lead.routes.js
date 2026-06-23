const express = require("express");
const leadController = require("../controllers/lead.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { validateBody } = require("../middleware/validate.middleware");
const { leadSchema } = require("../validations/schemas");

const router = express.Router();

// Customers can submit leads, admins can manage them
router.post("/", protect, validateBody(leadSchema), leadController.createLead);

// Restrict access to administrative staff
router.use(protect, restrictTo("admin", "superadmin"));

router.get("/", leadController.getLeads);
router.get("/:id", leadController.getLeadById);
router.put("/:id", leadController.updateLead);

// Only superadmins can hard delete qualified lead records
router.delete("/:id", restrictTo("superadmin"), leadController.deleteLead);

module.exports = router;
