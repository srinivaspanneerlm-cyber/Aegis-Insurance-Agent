import { createServer } from "node:http";
import { optionalEnv } from "./config";

/**
 * @aegis/notification-service
 *
 * Consumes platform events and delivers email/SMS/push. A consumer, not a peer: nothing calls it synchronously, so a slow SMS provider can never make issuing a policy slow.
 *
 * Sprint 1 scaffold: a real process with a real health endpoint, and no domain
 * logic. It boots, it answers a probe, and an orchestrator can schedule it —
 * which is everything the foundation needs to prove. Handlers arrive with the
 * sprint that owns them.
 */

const PORT = Number(optionalEnv("PORT", process.env, "4002"));

const server = createServer((req, res) => {
  // Liveness only. A readiness probe must also check the dependencies this
  // service cannot work without, and it gains those when it gains them.
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "@aegis/notification-service" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "error", code: "NOT_FOUND" }));
});

server.listen(PORT, () => {
  console.warn(`[notification-service] listening on :${PORT}`);
});
