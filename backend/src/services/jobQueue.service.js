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
const { FEATURES } = require("../config/constants");

class InMemoryJobQueue {
  constructor() {
    /** @type {Map<string, (payload:any)=>Promise<void>|void>} */
    this.handlers = new Map();
    this.timers = new Set();
    this.processed = 0;
    this.failed = 0;
  }

  /** Register a named handler once at boot. */
  register(jobType, handler) {
    this.handlers.set(jobType, handler);
    return this;
  }

  async _run(jobType, payload) {
    const handler = this.handlers.get(jobType);
    if (!handler) {
      // eslint-disable-next-line no-console
      console.warn(`[jobQueue] no handler registered for "${jobType}" — dropping job`);
      return;
    }
    try {
      await handler(payload);
      this.processed++;
    } catch (err) {
      this.failed++;
      // eslint-disable-next-line no-console
      console.error(`[jobQueue] job "${jobType}" failed:`, err.message);
    }
  }

  /** Enqueue a job to run as soon as the event loop is free (non-blocking). */
  enqueue(jobType, payload = {}) {
    if (!FEATURES.BACKGROUND_JOBS) return this._run(jobType, payload);
    setImmediate(() => this._run(jobType, payload));
  }

  /** Schedule a job to run after `delayMs` (replaces ad-hoc setTimeout). */
  schedule(jobType, payload = {}, delayMs = 0) {
    if (!FEATURES.BACKGROUND_JOBS || delayMs <= 0) {
      return this.enqueue(jobType, payload);
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this._run(jobType, payload);
    }, delayMs);
    if (timer.unref) timer.unref();
    this.timers.add(timer);
  }

  stats() {
    return {
      handlers: this.handlers.size,
      pendingTimers: this.timers.size,
      processed: this.processed,
      failed: this.failed,
    };
  }
}

module.exports = new InMemoryJobQueue();
