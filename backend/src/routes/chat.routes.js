const express = require("express");
const chatController = require("../controllers/chat.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.post("/", chatController.createChatMessage);
router.get("/", chatController.getChatHistory);

module.exports = router;
