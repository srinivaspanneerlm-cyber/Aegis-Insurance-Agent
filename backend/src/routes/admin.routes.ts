import express from "express";
import * as adminController from "../controllers/admin.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

// Administrative endpoint for fetching real-time dashboard analytics
router.get("/stats", protect, restrictTo("admin", "superadmin"), adminController.getDashboardStats);

export = router;
