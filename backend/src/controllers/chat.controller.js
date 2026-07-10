const prisma = require("../config/db");
const aiService = require("../services/ai.service");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const createChatMessage = catchAsync(async (req, res, next) => {
  const { message, product_type, session_id } = req.body;

  // Store userId (from auth) and sessionId (from request)
  const userId = req.user?.id || null;
  const sessionIdToStore = session_id || null;

  // 1) Save customer message
  const customerMsg = await prisma.chat.create({
    data: { message, sender: "customer", sessionId: sessionIdToStore, userId, agentDomain: product_type || null },
  });

  // 2) Query AI Microservice (multi-agent orchestrator)
  const userName = req.user ? req.user.name : "Sri";
  const aiResult = await aiService.getResponseFromAIService(
    message,
    userName,
    product_type,
    session_id
  );

  const replyText = typeof aiResult === "string" ? aiResult : aiResult.reply || "";
  const agentName = typeof aiResult === "object" ? (aiResult.agent_name || null) : null;
  const agentDomain = typeof aiResult === "object" ? (aiResult.agent_domain || product_type || null) : null;
  const transferred = typeof aiResult === "object" ? aiResult.transferred : false;
  const newSessionId = typeof aiResult === "object" ? aiResult.session_id : session_id;

  // 3) Save AI message
  const aiMsg = await prisma.chat.create({
    data: { message: replyText, sender: "advisor", sessionId: sessionIdToStore, userId, agentName, agentDomain },
  });

  res.status(201).json({
    status: "success",
    data: {
      customerMessage: customerMsg,
      advisorMessage: aiMsg,
      // Multi-agent metadata — frontend can use these to update advisor header
      agentName,
      transferred,
      sessionId: newSessionId,
    },
  });
});

const getChatHistory = catchAsync(async (req, res, next) => {
  const { session_id } = req.query;
  const userId = req.user?.id || null;

  // Always scope history to the authenticated user so a caller cannot read
  // another user's conversation by supplying an arbitrary session_id (IDOR).
  if (!userId) {
    return next(new AppError("You are not logged in. Please log in to gain access.", 401));
  }

  const where = { userId };
  if (session_id) where.sessionId = session_id;

  const history = await prisma.chat.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  res.status(200).json({
    status: "success",
    results: history.length,
    data: { chat: history },
  });
});

module.exports = { createChatMessage, getChatHistory };
