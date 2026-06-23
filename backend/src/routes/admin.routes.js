const express = require("express");
const adminController = require("../controllers/admin.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

const router = express.Router();

// Administrative endpoint for fetching real-time dashboard analytics
router.get("/stats", protect, restrictTo("admin", "superadmin"), adminController.getDashboardStats);

module.exports = router;
