/**
 * Background job queue — a clean, broker-shaped interface for async / deferred
 * work.
 *
 * Two interchangeable backings implement the same `JobQueue` contract:
 *   • InMemoryJobQueue — runs jobs in-process (immediate or delayed via timers).
 *     Zero dependencies; jobs are lost on restart. The default.
 *   • BullMqJobQueue   — a durable Redis-backed queue (BullMQ). Jobs survive
 *     restarts / deploys and can be processed by any worker. Selected when
 *     REDIS_URL is set.
 *
 * Controllers enqueue jobs by type; handlers are registered once at boot. Which
 * backing runs is a boot-time decision — enqueue sites never change.
 */
import { Queue, Worker } from "bullmq";
import { FEATURES } from "../config/constants";
import env from "../config/env";

// Job payloads are dynamic per job type, so the handler boundary is untyped by
// design; each handler narrows the shape it expects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobPayload = Record<string, any>;
type JobHandler = (payload: JobPayload) => Promise<void> | void;

interface JobStats {
  handlers: number;
  pendingTimers: number;
  processed: number;
  failed: number;
}

interface JobQueue {
  register<T extends JobPayload = JobPayload>(
    jobType: string,
    handler: (payload: T) => Promise<void> | void
  ): this;
  enqueue(jobType: string, payload?: JobPayload): Promise<void> | void;
  schedule(jobType: string, payload?: JobPayload, delayMs?: number): Promise<void> | void;
  stats(): JobStats;
}

class InMemoryJobQueue implements JobQueue {
  private handlers: Map<string, JobHandler> = new Map();
  private timers: Set<NodeJS.Timeout> = new Set();
  private processed = 0;
  private failed = 0;

  register<T extends JobPayload = JobPayload>(
    jobType: string,
    handler: (payload: T) => Promise<void> | void
  ): this {
    this.handlers.set(jobType, handler as JobHandler);
    return this;
  }

  private async run(jobType: string, payload: JobPayload): Promise<void> {
    const handler = this.handlers.get(jobType);
    if (!handler) {
      console.warn(`[jobQueue] no handler registered for "${jobType}" — dropping job`);
      return;
    }
    try {
      await handler(payload);
      this.processed++;
    } catch (err) {
      this.failed++;
      console.error(`[jobQueue] job "${jobType}" failed:`, (err as Error).message);
    }
  }

  enqueue(jobType: string, payload: JobPayload = {}): Promise<void> | void {
    if (!FEATURES.BACKGROUND_JOBS) return this.run(jobType, payload);
    setImmediate(() => this.run(jobType, payload));
  }

  schedule(jobType: string, payload: JobPayload = {}, delayMs = 0): Promise<void> | void {
    if (!FEATURES.BACKGROUND_JOBS || delayMs <= 0) {
      return this.enqueue(jobType, payload);
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.run(jobType, payload);
    }, delayMs);
    if (timer.unref) timer.unref();
    this.timers.add(timer);
  }

  stats(): JobStats {
    return {
      handlers: this.handlers.size,
      pendingTimers: this.timers.size,
      processed: this.processed,
      failed: this.failed,
    };
  }
}

// BullMQ forbids ":" in queue names (it is their Redis key separator); it
// namespaces our keys under "bull:aegis-jobs:" on its own.
const QUEUE_NAME = "aegis-jobs";

// BullMQ needs its own ioredis connection options with maxRetriesPerRequest set
// to null (its blocking worker commands require it).
function connectionFromUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
  };
}

class BullMqJobQueue implements JobQueue {
  private handlers: Map<string, JobHandler> = new Map();
  private queue: Queue;
  private worker: Worker;
  private processed = 0;
  private failed = 0;
  private errorLogged = false;

  constructor(url: string) {
    const connection = connectionFromUrl(url);
    this.queue = new Queue(QUEUE_NAME, { connection });

    // One worker dispatches by job name to the handler registered at boot.
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          console.warn(`[jobQueue] no handler registered for "${job.name}" — dropping job`);
          return;
        }
        await handler(job.data as JobPayload);
      },
      { connection }
    );

    this.worker.on("completed", () => {
      this.processed++;
    });
    this.worker.on("failed", (_job, err) => {
      this.failed++;
      console.error(`[jobQueue] job failed:`, err?.message);
    });

    const onError = (err: Error): void => {
      if (!this.errorLogged) {
        console.error("[jobQueue] Redis unavailable — jobs will retry on reconnect:", err.message);
        this.errorLogged = true;
      }
    };
    this.queue.on("error", onError);
    this.worker.on("error", onError);
    this.worker.on("ready", () => {
      this.errorLogged = false;
      console.log("[jobQueue] BullMQ worker ready.");
    });
  }

  register<T extends JobPayload = JobPayload>(
    jobType: string,
    handler: (payload: T) => Promise<void> | void
  ): this {
    this.handlers.set(jobType, handler as JobHandler);
    return this;
  }

  async enqueue(jobType: string, payload: JobPayload = {}): Promise<void> {
    await this.add(jobType, payload, 0);
  }

  async schedule(jobType: string, payload: JobPayload = {}, delayMs = 0): Promise<void> {
    await this.add(jobType, payload, delayMs > 0 ? delayMs : 0);
  }

  private async add(jobType: string, payload: JobPayload, delay: number): Promise<void> {
    try {
      await this.queue.add(jobType, payload, {
        delay,
        // Keep Redis from growing without bound as jobs churn.
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    } catch (err) {
      // A brief outage is buffered by ioredis and flushed on reconnect; a hard
      // failure is logged rather than crashing the request path.
      console.error(`[jobQueue] failed to enqueue "${jobType}":`, (err as Error).message);
    }
  }

  stats(): JobStats {
    return {
      handlers: this.handlers.size,
      pendingTimers: 0, // delayed-job count is async in BullMQ; not reported here
      processed: this.processed,
      failed: this.failed,
    };
  }
}

// Pick the backing once at boot. REDIS_URL present → durable BullMQ; else the
// in-process queue. Enqueue sites depend only on the JobQueue contract.
const jobQueue: JobQueue = env.REDIS_URL ? new BullMqJobQueue(env.REDIS_URL) : new InMemoryJobQueue();
if (env.REDIS_URL) console.log("[jobQueue] Using BullMQ (Redis) backing.");

export = jobQueue;
