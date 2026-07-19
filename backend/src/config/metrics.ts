/**
 * Prometheus metrics for the backend. Exposes default process metrics (CPU,
 * memory, event-loop lag, GC) plus per-request HTTP latency, and a histogram
 * for backend->AI-engine call latency. Scraped at `GET /metrics` (kept off the
 * public `/api` surface — Prometheus reaches it on the internal network).
 */
import client from "prom-client";
import type { Request, Response, NextFunction } from "express";

const register = new client.Registry();
register.setDefaultLabels({ service: "aegis-backend" });

// CPU, RAM (RSS/heap), event-loop lag, GC, open FDs.
client.collectDefaultMetrics({ register });

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

/** Latency of backend calls to the AI engine (observed by ai.service). */
const aiCallDuration = new client.Histogram({
  name: "aegis_ai_call_duration_seconds",
  help: "Latency of backend calls to the AI engine, in seconds",
  labelNames: ["endpoint", "status"] as const,
  buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

/**
 * Times every request and records it against the *matched route pattern* (not
 * the raw URL) so label cardinality stays bounded. Unmatched requests (404s)
 * collapse to "unmatched".
 */
function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    const pattern = req.route?.path ? `${req.baseUrl}${req.route.path}` : "unmatched";
    end({ method: req.method, route: pattern, status: String(res.statusCode) });
  });
  next();
}

export { register, httpMetricsMiddleware, aiCallDuration };
