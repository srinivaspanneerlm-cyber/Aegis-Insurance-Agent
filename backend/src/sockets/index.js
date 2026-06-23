const prisma = require("../config/db");
const aiService = require("../services/ai.service");

const initSockets = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected to Aegis socket server: ${socket.id}`);

    // Join room scope
    socket.on("join_room", (data) => {
      const { roomId } = data;
      socket.join(roomId);
      console.log(`👥 Socket ${socket.id} joined room: ${roomId}`);
    });

    // Real-time chat messaging event
    socket.on("send_message", async (data) => {
      const { roomId, message, sender } = data;

      try {
        // Save message to database
        const savedMsg = await prisma.chat.create({
          data: {
            message,
            sender: sender || "customer",
          },
        });

        // Broadcast user's message to everyone in the room
        io.to(roomId).emit("message_received", savedMsg);

        // If the message is from a customer, trigger AI underwriting assistant
        if (sender === "customer") {
          // Emit typing status in room
          socket.to(roomId).emit("typing_state", { isTyping: true });

          // Fetch AI response
          const aiReplyText = await aiService.getResponseFromAIService(message);

          // Save AI response to database
          const savedAiMsg = await prisma.chat.create({
            data: {
              message: aiReplyText,
              sender: "advisor",
            },
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
  notifyUnderwritingStatus,
};
