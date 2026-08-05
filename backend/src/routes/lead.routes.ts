import express from "express";
import * as leadController from "../controllers/lead.controller";
import { protect, requirePermission } from "../middleware/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import { leadSchema, idParamSchema, paginationQuerySchema } from "../validations/schemas";

const router = express.Router();

// Customers can submit leads, admins can manage them
router.post("/", protect, validateBody(leadSchema), leadController.createLead);

// Everything below manages other people's enquiries, so it needs sign-in plus a
// capability. Reading and writing are separated: seeing the pipeline is not the
// same authority as altering somebody's record in it.
router.use(protect);

router.get("/", requirePermission("lead.read"), validateQuery(paginationQuerySchema), leadController.getLeads);
router.get("/:id", requirePermission("lead.read"), validateParams(idParamSchema), leadController.getLeadById);
router.put("/:id", requirePermission("lead.write"), validateParams(idParamSchema), leadController.updateLead);

// Destroying a lead record is its own capability — it is the one action here
// that cannot be undone.
router.delete("/:id", requirePermission("lead.delete"), validateParams(idParamSchema), leadController.deleteLead);

export = router;
