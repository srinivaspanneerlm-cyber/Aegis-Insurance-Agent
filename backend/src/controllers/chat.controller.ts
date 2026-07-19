import type { Request, Response } from "express";
import { chatRepository } from "../repositories";
import { HISTORY } from "../config/constants";
import aiService = require("../services/ai.service");
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";

const createChatMessage = catchAsync(async (req, res) => {
  const { message, product_type, session_id } = req.body;

  // Store userId (from auth) and sessionId (from request)
  const userId = req.user?.id || null;
  const sessionIdToStore = session_id || null;

  // 1) Save customer message
  const customerMsg = await chatRepository.create({
    message, sender: "customer", sessionId: sessionIdToStore, userId, agentDomain: product_type || null,
  });

  // 2) Query AI Microservice (multi-agent orchestrator)
  const userName = req.user ? req.user.name : "Sri";
  const aiResult = await aiService.getResponseFromAIService(
    message,
    userName,
    product_type,
    session_id,
    userId
  );

  const replyText = typeof aiResult === "string" ? aiResult : aiResult.reply || "";
  const agentName = typeof aiResult === "object" ? (aiResult.agent_name || null) : null;
  const agentDomain = typeof aiResult === "object" ? (aiResult.agent_domain || product_type || null) : null;
  const transferred = typeof aiResult === "object" ? aiResult.transferred : false;
  const newSessionId = typeof aiResult === "object" ? aiResult.session_id : session_id;

  // 3) Save AI message
  const aiMsg = await chatRepository.create({
    message: replyText, sender: "advisor", sessionId: sessionIdToStore, userId, agentName, agentDomain,
  });

  sendSuccess(res, 201, {
    customerMessage: customerMsg,
    advisorMessage: aiMsg,
    // Multi-agent metadata — frontend can use these to update advisor header
    agentName,
    transferred,
    sessionId: newSessionId,
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

  const where: Record<string, unknown> = { userId };
  if (session_id) where.sessionId = session_id;

  const history = await chatRepository.findHistory(where, HISTORY.CHAT_PAGE_MAX);

  sendSuccess(res, 200, { chat: history }, { results: history.length });
});

/**
 * Proxy the advisor's SSE stream, so the browser never talks to the AI engine
 * directly and the engine is never told who the customer is by the browser.
 *
 * Not wrapped in `catchAsync`: SSE headers go out before the upstream call, so
 * the error middleware could not send its JSON body afterwards. Failures are
 * reported in-band as an `error` event, which is what the client already
 * handles.
 */
const streamChatMessage = async (req: Request, res: Response): Promise<void> => {
  const { message, history, product_type, session_id, force_transfer_to, declined_domains } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Stop reverse proxies buffering the stream into one lump at the end.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // A customer who closes the tab or hits stop should not leave a paid LLM
  // call running upstream.
  const upstreamAbort = new AbortController();
  res.on("close", () => upstreamAbort.abort());

  try {
    const upstream = await aiService.openAIStream({
      message,
      history,
      // Identity comes from the verified session. Anything the body claims
      // about who this is gets dropped here.
      userName: req.user!.name,
      productType: product_type,
      sessionId: session_id,
      forceTransferTo: force_transfer_to,
      declinedDomains: declined_domains,
      signal: upstreamAbort.signal,
    });

    upstream.on("error", () => res.end());
    upstream.pipe(res);
  } catch (err) {
    if (upstreamAbort.signal.aborted) return; // customer left; nothing to report
    console.error("[AI Stream] Upstream failed:", (err as Error).message);
    // Generic in-band error — never echo the upstream's message to the client.
    res.write(`data: ${JSON.stringify({ type: "error", message: "The advisor is unavailable right now. Please try again." })}\n\n`);
    res.end();
  }
};

export { createChatMessage, getChatHistory, streamChatMessage };
