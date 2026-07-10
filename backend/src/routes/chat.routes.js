const express = require("express");
const chatController = require("../controllers/chat.controller");
const { protect } = require("../middleware/auth.middleware");
const { aiLimiter } = require("../config/security");

const router = express.Router();

router.use(protect);

// Sending a message triggers a paid LLM call — throttle it per IP.
router.post("/", aiLimiter, chatController.createChatMessage);
router.get("/", chatController.getChatHistory);

module.exports = router;
