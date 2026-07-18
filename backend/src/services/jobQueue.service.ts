/**
 * Background job queue — a clean interface for asynchronous / deferred work.
 *
 * Today it runs jobs in-process (immediate or delayed via timers). The
 * interface (`enqueue`, `schedule`, `register`, `process`) is queue-shaped, so
 * moving to BullMQ / SQS / RabbitMQ at scale is a single-file swap — controllers
 * that enqueue jobs never change.
 *
 * Why this exists: operations like lead auto-qualification, notifications,
 * emails, recommendation generation, and analytics must not block the request
 * or live only in a lost-on-restart `setTimeout`. They belong on a queue.
 *
 * NOTE: behaviour of existing jobs is preserved exactly (same effect, same
 * delay). Durability across restarts arrives when a real broker is plugged in.
 */
import { FEATURES } from "../config/constants";

// Job payloads are dynamic per job type, so the handler boundary is untyped by
// design; each handler narrows the shape it expects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobPayload = Record<string, any>;
type JobHandler = (payload: JobPayload) => Promise<void> | void;

class InMemoryJobQueue {
  private handlers: Map<string, JobHandler>;
  private timers: Set<NodeJS.Timeout>;
  private processed: number;
  private failed: number;

  constructor() {
    this.handlers = new Map();
    this.timers = new Set();
    this.processed = 0;
    this.failed = 0;
  }

  /** Register a named handler once at boot. */
  register<T extends JobPayload = JobPayload>(
    jobType: string,
    handler: (payload: T) => Promise<void> | void
  ): this {
    this.handlers.set(jobType, handler as JobHandler);
    return this;
  }

  private async _run(jobType: string, payload: JobPayload): Promise<void> {
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

  /** Enqueue a job to run as soon as the event loop is free (non-blocking). */
  enqueue(jobType: string, payload: JobPayload = {}): Promise<void> | void {
    if (!FEATURES.BACKGROUND_JOBS) return this._run(jobType, payload);
    setImmediate(() => this._run(jobType, payload));
  }

  /** Schedule a job to run after `delayMs` (replaces ad-hoc setTimeout). */
  schedule(jobType: string, payload: JobPayload = {}, delayMs = 0): Promise<void> | void {
    if (!FEATURES.BACKGROUND_JOBS || delayMs <= 0) {
      return this.enqueue(jobType, payload);
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this._run(jobType, payload);
    }, delayMs);
    if (timer.unref) timer.unref();
    this.timers.add(timer);
  }

  stats(): { handlers: number; pendingTimers: number; processed: number; failed: number } {
    return {
      handlers: this.handlers.size,
      pendingTimers: this.timers.size,
      processed: this.processed,
      failed: this.failed,
    };
  }
}

export = new InMemoryJobQueue();
