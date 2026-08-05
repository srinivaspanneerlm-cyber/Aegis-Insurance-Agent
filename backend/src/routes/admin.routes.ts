import express from "express";
import * as adminController from "../controllers/admin.controller";
import { protect, requirePermission } from "../middleware/auth.middleware";

const router = express.Router();

// Administrative endpoint for fetching real-time dashboard analytics
router.get("/stats", protect, requirePermission("analytics.read"), adminController.getDashboardStats);

export = router;
