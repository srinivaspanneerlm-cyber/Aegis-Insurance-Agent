import express from "express";
import * as leadController from "../controllers/lead.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { leadSchema } from "../validations/schemas";

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

export = router;
