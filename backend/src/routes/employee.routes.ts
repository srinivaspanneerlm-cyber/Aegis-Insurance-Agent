import express from "express";
import * as employeeController from "../controllers/employee.controller";
import { protect, requirePermission, requireRealm } from "../middleware/auth.middleware";

const router = express.Router();

/**
 * Everything here is employee-only, twice over.
 *
 * `requireRealm("EMPLOYEE")` is the wall: a customer's session cannot reach any
 * of it, whatever capabilities somebody managed to attach to their role. The
 * per-route `requirePermission` is the second question — which of these an
 * employee may do — and the two are separate because they answer different
 * things. A realm check alone would let any employee approve any claim; a
 * permission check alone would let a customer with a stray capability in.
 */
router.use(protect, requireRealm("EMPLOYEE"));

// The signed-in employee and how their queue is doing.
router.get("/me", employeeController.me);

// Work.
router.get("/work", requirePermission("work.read"), employeeController.queue);
router.post("/work", requirePermission("work.write"), employeeController.createWork);
router.get("/work/:id", requirePermission("work.read"), employeeController.workItem);
router.post(
  "/work/:id/advance",
  requirePermission("workflow.advance"),
  employeeController.advanceWorkflow
);

// The operations manager's view. Needs the wider read by definition.
router.get("/escalations", requirePermission("work.read.all"), employeeController.escalations);

router.get("/analytics", requirePermission("analytics.read"), employeeController.analytics);
router.get("/knowledge", requirePermission("knowledge.read"), employeeController.knowledge);
router.get("/workflows", employeeController.definitions);

export = router;
