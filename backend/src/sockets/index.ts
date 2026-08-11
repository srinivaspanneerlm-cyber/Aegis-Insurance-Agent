import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Server, Socket } from "socket.io";
import { userRepository, chatRepository } from "../repositories";
import env from "../config/env";
import { logger } from "../config/logger";
import aiService = require("../services/ai.service");
import { attachRealtime, userRoom } from "../communication/eventBus";

type SocketNext = (err?: Error) => void;

/**
 * Socket.io handshake authentication.
 * Rejects any connection that does not present a valid JWT, so realtime chat
 * (which can write DB rows and invoke the paid AI service) can no longer be
 * driven by anonymous clients. The verified user is attached to socket.data.
 *
 * Token is read from `socket.handshake.auth.token` (preferred) or the
 * `Authorization: Bearer <token>` handshake header.
 */
const socketAuthMiddleware = async (socket: Socket, next: SocketNext): Promise<void> => {
  try {
    let token: string | null = socket.handshake?.auth?.token || null;
    if (!token) {
      const header = socket.handshake?.headers?.authorization || "";
      if (header.startsWith("Bearer ")) token = header.split(" ")[1];
    }
    if (!token) return next(new Error("Unauthorized: authentication token required."));

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { id: string };
    const user = await userRepository.findById(decoded.id);
    if (!user) return next(new Error("Unauthorized: user no longer exists."));

    // Trusted identity — never rely on client-supplied sender/name after this.
    socket.data.user = { id: user.id, name: user.name, role: user.role };
    return next();
  } catch {
    return next(new Error("Unauthorized: invalid or expired token."));
  }
};

// Sliding-window throttle for AI-backed socket messages, keyed by the
// authenticated user id rather than the connection. Scoping it to the socket
// instead let a client reset its allowance for free by disconnecting and
// reconnecting — the handshake only costs a JWT it already holds — which
// defeated the cost-abuse protection this exists for entirely.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;
const socketMessageTimestamps = new Map<string, number[]>();

const withinSocketRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const recent = (socketMessageTimestamps.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    socketMessageTimestamps.set(userId, recent);
    return false;
  }
  recent.push(now);
  socketMessageTimestamps.set(userId, recent);
  return true;
};

const initSockets = (io: Server): void => {
  // Hand the server to the communication platform so notifications raised
  // anywhere in the process can reach a connected portal.
  attachRealtime(io);

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket client connected");

    // There is still no `join_room` here, and there never will be. It used to
    // let a client join any room it named, with no check that the room was
    // theirs — and every reply below was broadcast to that room.
    //
    // The one room a socket occupies is its own, derived from the authenticated
    // identity attached during the handshake. That is exactly the shape this
    // comment previously specified as the only safe way to add rooms: the room
    // is computed server-side from `socket.data.user` and the client never
    // names it, so a caller cannot put itself in the path of someone else's
    // conversation. Delivery to that room is addressed by user id through
    // `RealtimeService`, which has no way to express "any room".
    const identity = socket.data.user as { id: string } | undefined;
    if (identity?.id) {
      void socket.join(userRoom(identity.id));
    }

    // Real-time chat messaging event
    socket.on("send_message", async (data: { message: string; sender?: string }) => {
      const { message, sender } = data;
      const authUser = socket.data.user; // trusted identity from handshake

      // Rate limit — drop bursts that would fan out to the paid AI engine.
      if (!withinSocketRateLimit(authUser.id)) {
        socket.emit("error", { message: "Rate limit exceeded. Please slow down." });
        return;
      }

      try {
        // Save message to database — bound to the authenticated user so the
        // sender cannot be spoofed to write rows as someone else.
        const savedMsg = await chatRepository.create({
          message,
          sender: sender || "customer",
          userId: authUser.id,
        });

        // Echo back to the customer who sent it — not to a room they named.
        socket.emit("message_received", savedMsg);

        // If the message is from a customer, trigger AI underwriting assistant
        if (sender === "customer") {
          socket.emit("typing_state", { isTyping: true });

          // Fetch AI response — scope history to the authenticated user.
          const aiReplyText = await aiService.getResponseFromAIService(
            message,
            authUser.name,
            null,
            null,
            authUser.id
          );

          // Save AI response to database
          const savedAiMsg = await chatRepository.create({
            message: aiReplyText,
            sender: "advisor",
            userId: authUser.id,
          });

          socket.emit("typing_state", { isTyping: false });
          socket.emit("message_received", savedAiMsg);
        }
      } catch (err) {
        logger.error({ err }, "Socket chat processing failed");
        socket.emit("error", { message: "Failed to process chat message." });
      }
    });

    // Disconnection cleanup
    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket client disconnected");
    });
  });
};

export { initSockets, socketAuthMiddleware };
