const express = require("express");
const companyController = require("../controllers/company.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.get("/", companyController.getCompanies);
router.post("/", restrictTo("superadmin"), companyController.createCompany);

module.exports = router;
