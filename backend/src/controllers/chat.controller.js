const prisma = require("../config/db");
const aiService = require("../services/ai.service");
const catchAsync = require("../utils/catchAsync");

const createChatMessage = catchAsync(async (req, res, next) => {
  const { message, product_type } = req.body;

  // 1) Save customer message
  const customerMsg = await prisma.chat.create({
    data: {
      message,
      sender: "customer",
    },
  });

  // 2) Query AI Microservice with dynamic user personalization
  const userName = req.user ? req.user.name : "Sri";
  const aiReplyText = await aiService.getResponseFromAIService(message, userName, product_type);

  // 3) Save AI message in database
  const aiMsg = await prisma.chat.create({
    data: {
      message: aiReplyText,
      sender: "advisor",
    },
  });

  res.status(201).json({
    status: "success",
    data: {
      customerMessage: customerMsg,
      advisorMessage: aiMsg,
    },
  });
});

const getChatHistory = catchAsync(async (req, res, next) => {
  const history = await prisma.chat.findMany({
    orderBy: { createdAt: "asc" },
  });

  res.status(200).json({
    status: "success",
    results: history.length,
    data: {
      chat: history,
    },
  });
});

module.exports = {
  createChatMessage,
  getChatHistory,
};
