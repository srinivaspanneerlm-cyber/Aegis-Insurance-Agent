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

    // There is no `join_room` here on purpose. It used to let a client join any
    // room it named, with no check that the room was theirs — and every reply
    // below was broadcast to that room. Nothing joins rooms now, so a caller
    // cannot put itself in the path of someone else's conversation.
    //
    // An advisor conversation is between one customer and their advisor, so
    // replies go back to the socket that asked. If group chat is ever needed,
    // the room a socket may join has to be derived from `socket.data.user`
    // server-side — never accepted from the client.

    // Simple sliding-window throttle: cap AI-backed socket messages per client.
    const RATE_WINDOW_MS = 60 * 1000;
    const RATE_MAX = 20;
    let msgTimestamps = [];

    // Real-time chat messaging event
    socket.on("send_message", async (data) => {
      const { message, sender } = data;
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
        console.error("Socket chat processing failed:", err);
        socket.emit("error", { message: "Failed to process chat message." });
      }
    });

    // Disconnection cleanup
    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = {
  initSockets,
  socketAuthMiddleware,
};
