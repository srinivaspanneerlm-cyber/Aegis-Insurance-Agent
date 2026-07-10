require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const { execSync } = require("child_process");
const env = require("./config/env");
const app = require("./app");
const { initSockets, socketAuthMiddleware } = require("./sockets/index");

const port = env.PORT;

// Optional dev-only convenience: force-release the port if occupied. Disabled
// by default because it issues `kill -9` against whatever PID holds the port,
// which is unsafe on shared machines. Enable with AUTO_RELEASE_PORT=true.
if (env.AUTO_RELEASE_PORT && !env.isProd && process.platform === "linux") {
  try {
    const pids = execSync(`lsof -t -i:${port}`, { stdio: ["pipe", "pipe", "ignore"] }).toString().trim();
    if (pids) {
      console.log(`🧹 Port ${port} occupied by PID(s): ${pids.split("\n").join(", ")}. Releasing (AUTO_RELEASE_PORT enabled)...`);
      execSync(`kill -9 ${pids}`);
      execSync("sleep 1");
      console.log(`✅ Port ${port} released.`);
    }
  } catch (err) {
    // Silent fallback if port is already free or lsof is unavailable.
  }
}

// Capture uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down server...");
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Boot HTTP Server
const server = http.createServer(app);

// Integrate Socket.io with a strict CORS allowlist (no wildcard).
const io = new Server(server, {
  cors: {
    origin: env.allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Require a valid JWT on the socket handshake before any events are processed.
io.use(socketAuthMiddleware);

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
