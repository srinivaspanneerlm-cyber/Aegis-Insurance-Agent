import { chatRepository } from "../repositories";
import { HISTORY } from "../config/constants";
import aiService = require("./ai.service");
import AppError from "../utils/appError";

interface CreateMessageInput {
  message: string;
  product_type?: string;
  session_id?: string;
  userId: string | null;
  userName: string;
}

export const chatService = {
  /**
   * Persist the customer message, query the multi-agent AI orchestrator, then
   * persist the advisor reply. The two writes intentionally straddle the AI
   * call (not one transaction) so the customer's message survives an AI failure.
   */
  async createMessage({ message, product_type, session_id, userId, userName }: CreateMessageInput) {
    const sessionIdToStore = session_id || null;

    const customerMessage = await chatRepository.create({
      message, sender: "customer", sessionId: sessionIdToStore, userId, agentDomain: product_type || null,
    });

    const aiResult = await aiService.getResponseFromAIService(
      message, userName, product_type, session_id, userId
    );

    const replyText = typeof aiResult === "string" ? aiResult : aiResult.reply || "";
    const agentName = typeof aiResult === "object" ? aiResult.agent_name || null : null;
    const agentDomain = typeof aiResult === "object" ? aiResult.agent_domain || product_type || null : null;
    const transferred = typeof aiResult === "object" ? aiResult.transferred : false;
    const newSessionId = typeof aiResult === "object" ? aiResult.session_id : session_id;

    const advisorMessage = await chatRepository.create({
      message: replyText, sender: "advisor", sessionId: sessionIdToStore, userId, agentName, agentDomain,
    });

    return { customerMessage, advisorMessage, agentName, transferred, sessionId: newSessionId };
  },

  /** History is always scoped to the authenticated user (no cross-user IDOR). */
  getHistory({ userId, session_id }: { userId: string | null; session_id?: unknown }) {
    if (!userId) throw new AppError("You are not logged in. Please log in to gain access.", 401);
    const where: Record<string, unknown> = { userId };
    if (session_id) where.sessionId = session_id;
    return chatRepository.findHistory(where, HISTORY.CHAT_PAGE_MAX);
  },
};
