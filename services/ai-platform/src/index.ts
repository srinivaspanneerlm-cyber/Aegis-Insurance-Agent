import { createServer } from "node:http";
import { optionalEnv } from "./config";

/**
 * @aegis/ai-platform
 *
 * The TYPED GATEWAY in front of the existing Python engine in `ai-python/` — it does not replace or reimplement it. The multi-agent orchestrator is protected code (CLAUDE.md §6); this only gives the TypeScript side a contract to compile against.
 *
 * Sprint 1 scaffold: a real process with a real health endpoint, and no domain
 * logic. It boots, it answers a probe, and an orchestrator can schedule it —
 * which is everything the foundation needs to prove. Handlers arrive with the
 * sprint that owns them.
 */

const PORT = Number(optionalEnv("PORT", process.env, "4004"));

const server = createServer((req, res) => {
  // Liveness only. A readiness probe must also check the dependencies this
  // service cannot work without, and it gains those when it gains them.
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "@aegis/ai-platform" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "error", code: "NOT_FOUND" }));
});

server.listen(PORT, () => {
  console.warn(`[ai-platform] listening on :${PORT}`);
});
