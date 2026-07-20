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
 *
 * Reliability: a failed job is retried with exponential backoff up to
 * JOBS.ATTEMPTS; when attempts are exhausted it is dead-lettered — logged as a
 * structured `job.deadletter` record (and, on BullMQ, kept in the failed set for
 * inspection / replay).
 */
import { Queue, Worker } from "bullmq";
import { FEATURES, JOBS } from "../config/constants";
import env from "../config/env";
import { logger } from "../config/logger";

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

const backoffMs = (attempt: number): number => JOBS.BACKOFF_MS * 2 ** (attempt - 1);

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
      logger.warn({ jobType }, "[jobQueue] no handler registered — dropping job");
      return;
    }
    for (let attempt = 1; attempt <= JOBS.ATTEMPTS; attempt++) {
      try {
        await handler(payload);
        this.processed++;
        return;
      } catch (err) {
        const message = (err as Error).message;
        if (attempt >= JOBS.ATTEMPTS) {
          this.failed++;
          logger.error(
            { event: "job.deadletter", jobType, attempts: attempt, payload, err: message },
            "[jobQueue] job dead-lettered after retries"
          );
          return;
        }
        logger.warn({ jobType, attempt, err: message }, "[jobQueue] job failed — retrying");
        await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
      }
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
          logger.warn({ jobType: job.name }, "[jobQueue] no handler registered — dropping job");
          return;
        }
        await handler(job.data as JobPayload);
      },
      { connection }
    );

    this.worker.on("completed", () => {
      this.processed++;
    });
    // Fires on every attempt failure. When attempts are exhausted the job is
    // dead-lettered (kept in the failed set for inspection/replay) and logged;
    // earlier failures are logged as retriable.
    this.worker.on("failed", (job, err) => {
      const attemptsAllowed = job?.opts?.attempts ?? 1;
      const finalFailure = !job || job.attemptsMade >= attemptsAllowed;
      if (finalFailure) {
        this.failed++;
        logger.error(
          {
            event: "job.deadletter",
            jobName: job?.name,
            jobId: job?.id,
            attemptsMade: job?.attemptsMade,
            data: job?.data,
            err: err?.message,
          },
          "[jobQueue] job dead-lettered (attempts exhausted)"
        );
      } else {
        logger.warn(
          { jobName: job?.name, jobId: job?.id, attemptsMade: job?.attemptsMade, err: err?.message },
          "[jobQueue] job attempt failed — will retry"
        );
      }
    });

    const onError = (err: Error): void => {
      if (!this.errorLogged) {
        logger.error({ err: err.message }, "[jobQueue] Redis unavailable — jobs retry on reconnect");
        this.errorLogged = true;
      }
    };
    this.queue.on("error", onError);
    this.worker.on("error", onError);
    this.worker.on("ready", () => {
      this.errorLogged = false;
      logger.info("[jobQueue] BullMQ worker ready.");
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
        // Retry transient failures with exponential backoff before dead-lettering.
        attempts: JOBS.ATTEMPTS,
        backoff: { type: "exponential", delay: JOBS.BACKOFF_MS },
        // Keep Redis from growing without bound as jobs churn (failed set is the
        // dead-letter store for inspection/replay).
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    } catch (err) {
      // A brief outage is buffered by ioredis and flushed on reconnect; a hard
      // failure is logged rather than crashing the request path.
      logger.error({ jobType, err: (err as Error).message }, "[jobQueue] failed to enqueue");
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
if (env.REDIS_URL) logger.info("[jobQueue] Using BullMQ (Redis) backing.");

export = jobQueue;
