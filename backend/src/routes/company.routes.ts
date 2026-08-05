import express from "express";
import * as companyController from "../controllers/company.controller";
import { protect, requirePermission, requireFreshAuth } from "../middleware/auth.middleware";
import { validateQuery } from "../middleware/validate.middleware";
import { paginationQuerySchema } from "../validations/schemas";

const router = express.Router();

router.use(protect);

router.get("/", validateQuery(paginationQuerySchema), companyController.getCompanies);
// Adding an insurer changes what the whole platform will recommend, so it asks
// the person to confirm they are still there before it takes effect.
router.post(
  "/",
  requirePermission("company.write"),
  requireFreshAuth,
  companyController.createCompany
);

export = router;
