import express from "express";
import * as companyController from "../controllers/company.controller";
import { protect, requirePermission } from "../middleware/auth.middleware";
import { validateQuery } from "../middleware/validate.middleware";
import { paginationQuerySchema } from "../validations/schemas";

const router = express.Router();

router.use(protect);

router.get("/", validateQuery(paginationQuerySchema), companyController.getCompanies);
router.post("/", requirePermission("company.write"), companyController.createCompany);

export = router;
