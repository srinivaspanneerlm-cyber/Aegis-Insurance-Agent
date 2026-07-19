import express from "express";
import * as leadController from "../controllers/lead.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import { leadSchema, idParamSchema, paginationQuerySchema } from "../validations/schemas";

const router = express.Router();

// Customers can submit leads, admins can manage them
router.post("/", protect, validateBody(leadSchema), leadController.createLead);

// Restrict access to administrative staff
router.use(protect, restrictTo("admin", "superadmin"));

router.get("/", validateQuery(paginationQuerySchema), leadController.getLeads);
router.get("/:id", validateParams(idParamSchema), leadController.getLeadById);
router.put("/:id", validateParams(idParamSchema), leadController.updateLead);

// Only superadmins can hard delete qualified lead records
router.delete("/:id", restrictTo("superadmin"), validateParams(idParamSchema), leadController.deleteLead);

export = router;
