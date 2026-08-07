/**
 * The event bus, and the realtime bridge.
 *
 * In-process, and honest about it. Handlers run after the publisher's response
 * has already been decided, so a failing notification never fails the upload
 * that triggered it — but that also means delivery is not guaranteed across a
 * restart, and the interface says so rather than implying otherwise.
 *
 * One handler failing does not stop the others. That is the whole reason this
 * indirection exists: an employee's notification must not be lost because the
 * analytics counter threw.
 */
import { logger } from "../config/logger";
import type {
  EventBusService,
  EventHandler,
  PlatformEvent,
  PlatformEventName,
  RealtimeService,
} from "./contracts";

class InProcessEventBus implements EventBusService {
  private readonly handlers = new Map<PlatformEventName, Set<EventHandler>>();

  subscribe(name: PlatformEventName, handler: EventHandler): () => void {
    const set = this.handlers.get(name) ?? new Set<EventHandler>();
    set.add(handler);
    this.handlers.set(name, set);
    return () => {
      set.delete(handler);
    };
  }

  async publish(event: PlatformEvent): Promise<void> {
    const subscribers = this.handlers.get(event.name);
    if (!subscribers || subscribers.size === 0) return;

    // `allSettled`, not `all`. A rejected handler is logged and the rest still
    // run — the alternative is that whichever handler happens to be registered
    // first can silently cancel every other consequence of an event.
    const results = await Promise.allSettled(
      [...subscribers].map(async (handler) => handler(event))
    );

    for (const result of results) {
      if (result.status === "rejected") {
        logger.error(
          { event: event.name, subject: `${event.subjectKind}:${event.subjectId}`, err: result.reason },
          "A subscriber failed while handling a platform event"
        );
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

let bus: EventBusService = new InProcessEventBus();

export const eventBus = (): EventBusService => bus;
export function registerEventBus(next: EventBusService): void {
  bus = next;
}
export function resetEventBus(): void {
  bus = new InProcessEventBus();
}

/**
 * Raises an event without making the caller wait for its consequences.
 *
 * The publisher's job is to record that something happened. Whether an email
 * goes out is not its concern and must not be on its critical path — a slow
 * notification handler would otherwise show up as a slow document upload.
 */
export function emit(event: Omit<PlatformEvent, "occurredAt"> & { occurredAt?: Date }): void {
  const full: PlatformEvent = { ...event, occurredAt: event.occurredAt ?? new Date() };
  void bus.publish(full).catch((err: unknown) => {
    logger.error({ event: full.name, err }, "Event publication failed");
  });
}

// ── Realtime ─────────────────────────────────────────────────────────────────

/**
 * Realtime delivery over Socket.io, addressed by user.
 *
 * The room name is derived from the user id here and in the socket layer, and
 * is never accepted from a client. That is the constraint the socket module
 * documents for itself: "the room a socket may join has to be derived from
 * `socket.data.user` server-side — never accepted from the client."
 */
export const userRoom = (userId: string): string => `user:${userId}`;

interface MinimalIo {
  to(room: string): { emit(event: string, payload: unknown): void };
}

class SocketRealtime implements RealtimeService {
  constructor(private io: MinimalIo | null) {}

  get connected(): boolean {
    return this.io !== null;
  }

  toUser(userId: string, event: string, payload: unknown): void {
    // A missing io is normal — tests, scripts, and the window before the server
    // finishes starting. Notifications are already persisted by the time this
    // is called, so a dropped realtime nudge costs the user a refresh, not a
    // message.
    if (!this.io) return;
    this.io.to(userRoom(userId)).emit(event, payload);
  }

  toUsers(userIds: readonly string[], event: string, payload: unknown): void {
    for (const id of new Set(userIds)) this.toUser(id, event, payload);
  }
}

let realtimeImpl: RealtimeService = new SocketRealtime(null);

export const realtime = (): RealtimeService => realtimeImpl;

/** Called once by the socket layer when the server is up. */
export function attachRealtime(io: MinimalIo): void {
  realtimeImpl = new SocketRealtime(io);
}

export function registerRealtime(service: RealtimeService): void {
  realtimeImpl = service;
}

export function resetRealtime(): void {
  realtimeImpl = new SocketRealtime(null);
}
