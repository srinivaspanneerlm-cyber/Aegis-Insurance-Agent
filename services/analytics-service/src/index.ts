import { createServer } from "node:http";
import { optionalEnv } from "./config";

/**
 * @aegis/analytics-service
 *
 * Builds read models from the event stream. Keeps reporting queries off the transactional database, where a wide dashboard aggregate would otherwise compete with a customer trying to buy a policy.
 *
 * Sprint 1 scaffold: a real process with a real health endpoint, and no domain
 * logic. It boots, it answers a probe, and an orchestrator can schedule it —
 * which is everything the foundation needs to prove. Handlers arrive with the
 * sprint that owns them.
 */

const PORT = Number(optionalEnv("PORT", process.env, "4003"));

const server = createServer((req, res) => {
  // Liveness only. A readiness probe must also check the dependencies this
  // service cannot work without, and it gains those when it gains them.
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "@aegis/analytics-service" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "error", code: "NOT_FOUND" }));
});

server.listen(PORT, () => {
  console.warn(`[analytics-service] listening on :${PORT}`);
});
