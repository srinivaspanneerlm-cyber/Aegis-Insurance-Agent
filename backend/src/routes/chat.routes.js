const express = require("express");
const chatController = require("../controllers/chat.controller");
const { protect } = require("../middleware/auth.middleware");
const { aiLimiter } = require("../config/security");

const router = express.Router();

router.use(protect);

// Sending a message triggers a paid LLM call — throttle it per IP.
router.post("/", aiLimiter, chatController.createChatMessage);
// The advisor's SSE stream. Same paid LLM behind it, so the same throttle: the
// browser used to reach the AI engine directly and bypass this limiter
// entirely.
router.post("/stream", aiLimiter, chatController.streamChatMessage);
router.get("/", chatController.getChatHistory);

module.exports = router;
