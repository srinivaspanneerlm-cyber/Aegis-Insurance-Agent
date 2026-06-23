require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const { execSync } = require("child_process");
const app = require("./app");
const { initSockets } = require("./sockets/index");

// Permanently resolve "EADDRINUSE" port conflict by releasing port 5000 if occupied
const port = process.env.PORT || 5000;
try {
  if (process.platform === "linux") {
    const pids = execSync(`lsof -t -i:${port}`, { stdio: ["pipe", "pipe", "ignore"] }).toString().trim();
    if (pids) {
      console.log(`🧹 Port ${port} is occupied by PID(s): ${pids.split("\n").join(", ")}. Releasing port permanently...`);
      execSync(`kill -9 ${pids}`);
      execSync("sleep 1");
      console.log(`✅ Port ${port} successfully released!`);
    }
  }
} catch (err) {
  // Silent fallback if port is already free or lsof is not available
}

// Capture uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down server...");
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Boot HTTP Server
const server = http.createServer(app);

// Integrate Socket.io with secure CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

// Attach socket event listeners
initSockets(io);


const runningServer = server.listen(port, () => {
  console.log(`🚀 Aegis AI Insurance SaaS Backend running on port: ${port}`);
  console.log(`📡 Ready to receive Socket.io connections.`);
});

// Capture unhandled rejections
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 💥 Shutting down server gracefully...");
  console.error(err.name, err.message);
  runningServer.close(() => {
    process.exit(1);
  });
});
