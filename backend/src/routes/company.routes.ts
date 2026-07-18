import express from "express";
import * as companyController from "../controllers/company.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

router.use(protect);

router.get("/", companyController.getCompanies);
router.post("/", restrictTo("superadmin"), companyController.createCompany);

export = router;
