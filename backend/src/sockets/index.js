const jwt = require("jsonwebtoken");
const { userRepository, chatRepository } = require("../repositories");
const env = require("../config/env");
const aiService = require("../services/ai.service");

/**
 * Socket.io handshake authentication.
 * Rejects any connection that does not present a valid JWT, so realtime chat
 * (which can write DB rows and invoke the paid AI service) can no longer be
 * driven by anonymous clients. The verified user is attached to socket.data.
 *
 * Token is read from `socket.handshake.auth.token` (preferred) or the
 * `Authorization: Bearer <token>` handshake header.
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    let token = socket.handshake?.auth?.token || null;
    if (!token) {
      const header = socket.handshake?.headers?.authorization || "";
      if (header.startsWith("Bearer ")) token = header.split(" ")[1];
    }
    if (!token) return next(new Error("Unauthorized: authentication token required."));

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await userRepository.findById(decoded.id);
    if (!user) return next(new Error("Unauthorized: user no longer exists."));

    // Trusted identity — never rely on client-supplied sender/name after this.
    socket.data.user = { id: user.id, name: user.name, role: user.role };
    return next();
  } catch (err) {
    return next(new Error("Unauthorized: invalid or expired token."));
  }
};

const initSockets = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected to Aegis socket server: ${socket.id}`);

    // Join room scope
    socket.on("join_room", (data) => {
      const { roomId } = data;
      socket.join(roomId);
      console.log(`👥 Socket ${socket.id} joined room: ${roomId}`);
    });

    // Simple sliding-window throttle: cap AI-backed socket messages per client.
    const RATE_WINDOW_MS = 60 * 1000;
    const RATE_MAX = 20;
    let msgTimestamps = [];

    // Real-time chat messaging event
    socket.on("send_message", async (data) => {
      const { roomId, message, sender } = data;
      const authUser = socket.data.user; // trusted identity from handshake

      // Rate limit — drop bursts that would fan out to the paid AI engine.
      const now = Date.now();
      msgTimestamps = msgTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (msgTimestamps.length >= RATE_MAX) {
        socket.emit("error", { message: "Rate limit exceeded. Please slow down." });
        return;
      }
      msgTimestamps.push(now);

      try {
        // Save message to database — bound to the authenticated user so the
        // sender cannot be spoofed to write rows as someone else.
        const savedMsg = await chatRepository.create({
          message,
          sender: sender || "customer",
          userId: authUser.id,
        });

        // Broadcast user's message to everyone in the room
        io.to(roomId).emit("message_received", savedMsg);

        // If the message is from a customer, trigger AI underwriting assistant
        if (sender === "customer") {
          // Emit typing status in room
          socket.to(roomId).emit("typing_state", { isTyping: true });

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

          // Stop typing indicator and broadcast AI's response
          socket.to(roomId).emit("typing_state", { isTyping: false });
          io.to(roomId).emit("message_received", savedAiMsg);
        }
      } catch (err) {
        console.error("Socket chat processing failed:", err);
        socket.emit("error", { message: "Failed to process chat message." });
      }
    });

    // Real-time typing indicators
    socket.on("typing", (data) => {
      const { roomId, isTyping } = data;
      socket.to(roomId).emit("typing_state", { isTyping });
    });

    // Disconnection cleanup
    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
};

// Real-time push notification helper for underwriting statuses
const notifyUnderwritingStatus = (io, leadId, status) => {
  if (io) {
    io.emit("notify_underwriting", {
      leadId,
      status,
      timestamp: new Date(),
    });
    console.log(`🔔 Broadcasted underwriting notification for Lead ${leadId}: ${status}`);
  }
};

module.exports = {
  initSockets,
  socketAuthMiddleware,
  notifyUnderwritingStatus,
};
