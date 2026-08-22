import type { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import aiService = require("../services/ai.service");
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";

const createChatMessage = catchAsync(async (req, res) => {
  const result = await chatService.createMessage({
    message: req.body.message,
    product_type: req.body.product_type,
    session_id: req.body.session_id,
    userId: req.user?.id || null,
    userName: req.user ? req.user.name : "Sri",
    requestId: req.id as string,
  });
  sendSuccess(res, 201, result);
});

const getChatHistory = catchAsync(async (req, res) => {
  const history = await chatService.getHistory({
    userId: req.user?.id || null,
    session_id: req.query.session_id,
  });
  sendSuccess(res, 200, { chat: history }, { results: history.length });
});

/**
 * Proxy the advisor's SSE stream, so the browser never talks to the AI engine
 * directly and the engine is never told who the customer is by the browser.
 *
 * Not wrapped in `catchAsync`: SSE headers go out before the upstream call, so
 * the error middleware could not send its JSON body afterwards. Failures are
 * reported in-band as an `error` event, which is what the client already
 * handles. Kept in the controller — it is the protected streaming path.
 */
const streamChatMessage = async (req: Request, res: Response): Promise<void> => {
  const { message, history, product_type, session_id, force_transfer_to, declined_domains, voice } = req.body;

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
      userId: req.user!.id,
      productType: product_type,
      sessionId: session_id,
      forceTransferTo: force_transfer_to,
      declinedDomains: declined_domains,
      // How the customer spoke this turn, when they spoke it. Narrowed in
      // ai.service before it leaves this process; it controls phrasing only.
      voice,
      signal: upstreamAbort.signal,
      requestId: req.id as string,
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
