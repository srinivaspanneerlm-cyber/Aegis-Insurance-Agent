import express from "express";
import * as chatController from "../controllers/chat.controller";
import { protect } from "../middleware/auth.middleware";
import { aiLimiter } from "../config/security";

const router = express.Router();

router.use(protect);

// Sending a message triggers a paid LLM call — throttle it per IP.
router.post("/", aiLimiter, chatController.createChatMessage);
// The advisor's SSE stream. Same paid LLM behind it, so the same throttle: the
// browser used to reach the AI engine directly and bypass this limiter
// entirely.
router.post("/stream", aiLimiter, chatController.streamChatMessage);
router.get("/", chatController.getChatHistory);

export = router;
