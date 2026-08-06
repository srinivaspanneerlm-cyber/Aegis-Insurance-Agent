/**
 * What the platform can actually tell you about itself.
 *
 * Every figure here is read from the running process, the operating system or a
 * live dependency check. Nothing is sampled from a metrics service, because
 * there is not one — and inventing plausible CPU curves for a console an
 * operator would page on is worse than admitting the gap.
 *
 * The distinction that matters throughout: a *probe* answers "is this reachable
 * right now", which is real; a *time series* answers "what has it been doing",
 * which needs a store this platform does not have. Probes are reported;
 * histories are declared missing.
 */
import os from "os";
import fs from "fs/promises";
import path from "path";
import prisma from "../config/db";
import cache from "../services/cache.service";
import env from "../config/env";

export type ComponentStatus = "UP" | "DEGRADED" | "DOWN" | "NOT_CONFIGURED";

export interface ComponentHealth {
  readonly id: string;
  readonly name: string;
  readonly status: ComponentStatus;
  /** Round-trip of the probe, in milliseconds. Null when nothing was probed. */
  readonly latencyMs: number | null;
  readonly detail: string;
  /** What is backing it — an in-memory fallback is not the same as Redis. */
  readonly implementation: string;
}

const ms = (start: bigint): number => Number(process.hrtime.bigint() - start) / 1_000_000;

/**
 * Probe every dependency the platform needs to serve a request.
 *
 * Run together rather than in sequence: an operator opening this page during an
 * incident should not wait for a healthy component's probe before seeing the
 * unhealthy one.
 */
export async function componentHealth(): Promise<ComponentHealth[]> {
  const [database, cacheHealth, storage] = await Promise.all([
    probeDatabase(),
    probeCache(),
    probeStorage(),
  ]);

  return [
    {
      id: "api",
      name: "API",
      // If this code is running, the API is up. Saying so is not a probe — it
      // is a tautology — and the honest framing is that it self-reports.
      status: "UP",
      latencyMs: null,
      detail: `Node ${process.version} · up ${formatUptime(process.uptime())}`,
      implementation: `express · ${env.NODE_ENV}`,
    },
    database,
    cacheHealth,
    storage,
    {
      id: "queue",
      name: "Job queue",
      status: process.env.REDIS_URL ? "UP" : "NOT_CONFIGURED",
      latencyMs: null,
      detail: process.env.REDIS_URL
        ? "Backed by BullMQ on Redis."
        : "Running on the in-process fallback. Jobs are lost when the process restarts, which is fine in development and not in production.",
      implementation: process.env.REDIS_URL ? "bullmq" : "in-memory",
    },
    {
      id: "workers",
      name: "Workers",
      status: "NOT_CONFIGURED",
      latencyMs: null,
      detail:
        "No separate worker process is deployed. Jobs run inside the API process, so a long job competes with request handling.",
      implementation: "in-process",
    },
  ];
}

async function probeDatabase(): Promise<ComponentHealth> {
  const started = process.hrtime.bigint();
  try {
    // The cheapest query that proves a round trip actually happened. `SELECT 1`
    // rather than a count, so the probe's cost does not grow with the data.
    await prisma.$queryRaw`SELECT 1`;
    const latency = ms(started);
    return {
      id: "database",
      name: "Database",
      status: latency > 500 ? "DEGRADED" : "UP",
      latencyMs: Math.round(latency),
      detail:
        latency > 500
          ? "Responding, but slowly enough that requests will be feeling it."
          : "Responding normally.",
      // Only the scheme is read. A connection string carries credentials and
      // must never reach an operator's browser, however privileged they are.
      implementation: (process.env.DATABASE_URL ?? "").startsWith("postgres")
        ? "postgresql"
        : "sqlite",
    };
  } catch (error) {
    return {
      id: "database",
      name: "Database",
      status: "DOWN",
      latencyMs: null,
      detail: error instanceof Error ? error.message : "Unreachable.",
      implementation: "unknown",
    };
  }
}

async function probeCache(): Promise<ComponentHealth> {
  const started = process.hrtime.bigint();
  try {
    const healthy = await cache.health();
    const usingRedis = Boolean(process.env.REDIS_URL);
    return {
      id: "cache",
      name: "Cache",
      status: healthy ? "UP" : "DOWN",
      latencyMs: Math.round(ms(started)),
      detail: usingRedis
        ? "Shared cache. Survives a restart and is consistent across instances."
        : "In-process cache. Each instance holds its own copy, so a multi-instance deployment will serve inconsistent reads.",
      implementation: usingRedis ? "redis" : "in-memory",
    };
  } catch {
    return {
      id: "cache",
      name: "Cache",
      status: "DOWN",
      latencyMs: null,
      detail: "The cache did not answer its health check.",
      implementation: "unknown",
    };
  }
}

/**
 * Storage is the uploads directory, measured rather than estimated.
 *
 * Walked with a depth limit: an operator's dashboard must not turn into an
 * unbounded filesystem crawl because somebody nested directories.
 */
async function probeStorage(): Promise<ComponentHealth> {
  const dir = path.resolve(process.cwd(), "src/uploads");
  const started = process.hrtime.bigint();

  try {
    const { files, bytes } = await measureDirectory(dir, 3);
    return {
      id: "storage",
      name: "Document storage",
      status: "UP",
      latencyMs: Math.round(ms(started)),
      detail: `${files} file(s), ${formatBytes(bytes)} on local disk.`,
      // Named plainly because it is the single least production-ready part of
      // the deployment: local disk does not survive a container restart.
      implementation: "local filesystem",
    };
  } catch {
    return {
      id: "storage",
      name: "Document storage",
      status: "NOT_CONFIGURED",
      latencyMs: null,
      detail: "No upload directory exists yet.",
      implementation: "local filesystem",
    };
  }
}

async function measureDirectory(dir: string, depth: number): Promise<{ files: number; bytes: number }> {
  if (depth < 0) return { files: 0, bytes: 0 };
  const entries = await fs.readdir(dir, { withFileTypes: true });

  let files = 0;
  let bytes = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await measureDirectory(full, depth - 1);
      files += nested.files;
      bytes += nested.bytes;
    } else {
      const stat = await fs.stat(full).catch(() => null);
      if (stat) {
        files += 1;
        bytes += stat.size;
      }
    }
  }
  return { files, bytes };
}

/**
 * Host and process resources, read from the operating system.
 *
 * `loadavg` is the honest CPU figure available without sampling — it is what
 * the kernel already tracks, and it means nothing on Windows, which is stated
 * rather than hidden. A synthetic "CPU %" computed from two `cpuUsage` reads a
 * few milliseconds apart would look more precise and be less true.
 */
export function resourceUsage() {
  const memory = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const [load1, load5, load15] = os.loadavg();
  const cores = os.cpus().length;

  return {
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      rssBytes: memory.rss,
      pid: process.pid,
      nodeVersion: process.version,
    },
    host: {
      platform: process.platform,
      cores,
      totalMemoryBytes: totalMemory,
      freeMemoryBytes: freeMemory,
      usedMemoryPercent: Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
      // Load average is per-core-agnostic; dividing by cores is what makes it
      // comparable between a 2-core box and a 32-core one.
      loadAverage: { one: load1, five: load5, fifteen: load15 },
      loadPerCore: cores ? Math.round(((load1 ?? 0) / cores) * 100) / 100 : null,
      loadAverageMeaningful: process.platform !== "win32",
      uptimeSeconds: Math.round(os.uptime()),
    },
  };
}

/**
 * The metrics an operator would expect and this platform does not keep.
 *
 * Returned alongside the live figures so the console can show the gap in place
 * rather than leaving an operator to wonder why a panel is empty.
 */
export const missingTelemetry = [
  {
    id: "request-rate",
    label: "Requests per second, over time",
    reason: "Nothing stores a time series. Each figure here is a point-in-time reading.",
    needs: "A metrics store — Prometheus, or a time-series table written by the request logger.",
  },
  {
    id: "error-rate",
    label: "Error rate trend",
    reason: "Errors are logged individually but never aggregated or retained as counts.",
    needs: "Counters exported from the error middleware into a metrics store.",
  },
  {
    id: "latency-percentiles",
    label: "Request latency p50/p95/p99",
    reason: "Response times reach the log, not a histogram.",
    needs: "A histogram in the request logger, exported per route.",
  },
  {
    id: "ai-token-usage",
    label: "AI token usage and cost",
    reason: "The AI engine does not report token counts back to this API.",
    needs: "Usage returned on each completion and persisted per request.",
  },
] as const;

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
