import express from "express";
import * as leadController from "../controllers/lead.controller";
import { protect, requirePermission, requireFreshAuth } from "../middleware/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import {
  leadSchema,
  leadUpdateSchema,
  idParamSchema,
  paginationQuerySchema,
} from "../validations/schemas";

const router = express.Router();

// Customers can submit leads, admins can manage them
router.post("/", protect, validateBody(leadSchema), leadController.createLead);

// Everything below manages other people's enquiries, so it needs sign-in plus a
// capability. Reading and writing are separated: seeing the pipeline is not the
// same authority as altering somebody's record in it.
router.use(protect);

router.get("/", requirePermission("lead.read"), validateQuery(paginationQuerySchema), leadController.getLeads);
router.get("/:id", requirePermission("lead.read"), validateParams(idParamSchema), leadController.getLeadById);
// `validateBody` matters as much as the capability here: without it the update
// took whatever the body held, and `deletedAt` was as writable as `status` —
// a soft-delete for anyone with `lead.write`, which is not `lead.delete`.
router.put(
  "/:id",
  requirePermission("lead.write"),
  validateParams(idParamSchema),
  validateBody(leadUpdateSchema),
  leadController.updateLead
);

// Destroying a lead record is its own capability — it is the one action here
// that cannot be undone — and the one place we ask the person to confirm they
// are still the account holder before we do it.
router.delete(
  "/:id",
  requirePermission("lead.delete"),
  requireFreshAuth,
  validateParams(idParamSchema),
  leadController.deleteLead
);

export = router;
