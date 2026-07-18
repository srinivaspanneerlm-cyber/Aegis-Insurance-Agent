import express from "express";
import { dispatchUIAction } from "../controllers/ui_action.controller";
import { protect } from "../middleware/auth.middleware";
import { aiLimiter } from "../config/security";

const router = express.Router();

router.use(protect);

router.post("/", aiLimiter, dispatchUIAction);

export = router;
