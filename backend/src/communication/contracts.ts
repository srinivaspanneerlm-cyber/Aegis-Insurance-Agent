/**
 * The communication platform, as interfaces.
 *
 * Eight capabilities, injected rather than imported, for the same reason the
 * document pipeline and the intelligence engine are: they will be replaced at
 * different times by different kinds of implementation. In-app notification is
 * a database write today. Email is a webhook. SMS and push are vendors nobody
 * has chosen. Realtime is Socket.io now and may be a managed service later.
 *
 * The rule that shapes all of it: **a channel that does not exist reports
 * itself unavailable rather than silently accepting.** A user who switches on
 * SMS alerts and never hears anything has been told a lie by the interface; one
 * who is told SMS is not connected has been informed. Every unimplemented
 * channel here returns `SUPPRESSED` with a reason that names what is missing.
 */

// ── Vocabulary ───────────────────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = [
  "POLICY",
  "CLAIM",
  "DOCUMENT",
  "RENEWAL",
  "SECURITY",
  "ANNOUNCEMENT",
  "MAINTENANCE",
  "AI_SUGGESTION",
  "TASK",
  "MESSAGE",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const isNotificationCategory = (v: unknown): v is NotificationCategory =>
  typeof v === "string" && (NOTIFICATION_CATEGORIES as readonly string[]).includes(v);

/**
 * Categories a user may never switch off.
 *
 * Security alerts tell somebody their password changed or a new device signed
 * in. A platform that lets those be muted has built a setting whose only
 * purpose is to help an attacker stay hidden.
 */
export const UNSUPPRESSIBLE: readonly NotificationCategory[] = ["SECURITY"];

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CHANNELS = ["IN_APP", "EMAIL", "SMS", "PUSH", "REALTIME"] as const;
export type Channel = (typeof CHANNELS)[number];

export type DeliveryStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "SUPPRESSED";

// ── Events ───────────────────────────────────────────────────────────────────

/**
 * Everything that happens on the platform worth telling somebody about.
 *
 * A closed union rather than a string, so a handler for an event that no longer
 * exists is a compile error rather than a subscription that silently never
 * fires — which is the failure mode of every string-keyed event bus.
 */
export const PLATFORM_EVENTS = [
  "document.uploaded",
  "document.verified",
  "document.rejected",
  "document.requested",
  "workitem.assigned",
  "workitem.status_changed",
  "workitem.escalated",
  "workitem.due_soon",
  "policy.renewal_due",
  "intelligence.report_ready",
  "intelligence.gap_found",
  "message.posted",
  "message.mentioned",
  "announcement.published",
  "security.alert",
  "system.maintenance",
] as const;
export type PlatformEventName = (typeof PLATFORM_EVENTS)[number];

export interface PlatformEvent<T = Record<string, unknown>> {
  readonly name: PlatformEventName;
  /** Who or what caused it. Null for scheduled work. */
  readonly actorId: string | null;
  readonly actorKind: "USER" | "AI" | "SYSTEM";
  /** What it happened to. */
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly payload: T;
  readonly occurredAt: Date;
  /** Ties every downstream effect back to the request that started it. */
  readonly correlationId?: string;
}

export type EventHandler = (event: PlatformEvent) => Promise<void> | void;

/**
 * The event bus.
 *
 * In-process by design, and deliberately not disguised as anything else. A bus
 * whose interface implies durability but whose implementation is an array is
 * worse than an honest one — somebody will eventually depend on delivery that
 * was never guaranteed. `publish` resolves when handlers have been *invoked*,
 * not when their work is durable.
 *
 * The seam is here so a queue can replace it without touching a publisher.
 */
export interface EventBusService {
  publish(event: PlatformEvent): Promise<void>;
  subscribe(name: PlatformEventName, handler: EventHandler): () => void;
  /** For tests and shutdown. */
  clear(): void;
}

// ── Notification ─────────────────────────────────────────────────────────────

export interface NotificationInput {
  readonly userId: string;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly body?: string;
  readonly priority?: Priority;
  /** Relative portal path. Absolute URLs are rejected — see the service. */
  readonly deepLink?: string;
  readonly subjectKind?: string;
  readonly subjectId?: string;
  /** Repeats within the dedupe window collapse onto the first. */
  readonly dedupeKey?: string;
}

export interface NotificationService {
  send(input: NotificationInput): Promise<{ id: string; delivered: Channel[]; suppressed: Array<{ channel: Channel; reason: string }> }>;
  list(userId: string, options?: { status?: string; category?: NotificationCategory; take?: number }): Promise<unknown>;
  markRead(userId: string, ids: string[]): Promise<{ updated: number }>;
  archive(userId: string, ids: string[]): Promise<{ updated: number }>;
  unreadCount(userId: string): Promise<{ total: number; byCategory: Record<string, number> }>;
}

/**
 * One delivery channel.
 *
 * `deliver` returns what happened rather than throwing, because a failed SMS
 * must not roll back the in-app notification that succeeded.
 */
export interface DeliveryChannel {
  readonly channel: Channel;
  readonly available: boolean;
  /** Why it is unavailable, and what would make it available. */
  readonly unavailableReason?: string;
  deliver(input: NotificationInput & { notificationId: string }): Promise<{
    status: DeliveryStatus;
    reason?: string;
  }>;
}

// ── Communication ────────────────────────────────────────────────────────────

export interface CommunicationService {
  startConversation(actor: Actor, input: StartConversationInput): Promise<{ id: string }>;
  post(actor: Actor, conversationId: string, input: PostMessageInput): Promise<unknown>;
  thread(actor: Actor, conversationId: string, options?: { take?: number }): Promise<unknown>;
  addParticipant(actor: Actor, conversationId: string, userId: string, role?: string): Promise<unknown>;
  markRead(actor: Actor, conversationId: string): Promise<unknown>;
}

export interface Actor {
  readonly id: string;
  readonly role: string;
  readonly realm?: string;
}

export interface StartConversationInput {
  readonly kind: "DIRECT" | "CASE" | "INTERNAL" | "ANNOUNCEMENT";
  readonly subject?: string;
  readonly participantIds: readonly string[];
  readonly workItemId?: string;
  readonly customerId?: string;
}

export interface PostMessageInput {
  readonly body: string;
  readonly internal?: boolean;
  readonly kind?: "NOTE" | "REPLY" | "SUMMARY" | "SUGGESTION" | "SYSTEM_EVENT";
  readonly mentionIds?: readonly string[];
  readonly attachmentIds?: readonly string[];
}

// ── Inbox, timeline, tasks, collaboration ────────────────────────────────────

export interface InboxService {
  /** One list across conversations, notifications and announcements. */
  unified(actor: Actor, options?: InboxQuery): Promise<unknown>;
}

export interface InboxQuery {
  readonly search?: string;
  readonly category?: string;
  readonly unreadOnly?: boolean;
  readonly take?: number;
}

/**
 * The activity timeline.
 *
 * Assembled at read time from the systems that already record their own
 * history — work items, documents, intelligence runs, messages, notifications.
 * There is deliberately no timeline *table*: copying those events into one
 * would create a second version of the truth, and the copy would drift from
 * the original the first time a backfill missed something.
 */
export interface TimelineService {
  forSubject(actor: Actor, subjectKind: string, subjectId: string): Promise<unknown>;
  forUser(actor: Actor, userId: string, options?: { take?: number }): Promise<unknown>;
}

export interface TaskService {
  create(actor: Actor, input: TaskInput): Promise<unknown>;
  suggest(input: TaskInput & { rationale: string }): Promise<unknown>;
  assign(actor: Actor, taskId: string, assigneeId: string): Promise<unknown>;
}

export interface TaskInput {
  readonly kind: string;
  readonly title: string;
  readonly summary?: string;
  readonly priority?: Priority;
  readonly department?: string;
  readonly dueAt?: Date;
  readonly assigneeId?: string;
  readonly customerId?: string;
}

export interface CollaborationService {
  announce(actor: Actor, input: AnnouncementInput): Promise<unknown>;
  announcements(actor: Actor): Promise<unknown>;
  activityFeed(actor: Actor, options?: { take?: number }): Promise<unknown>;
}

export interface AnnouncementInput {
  readonly title: string;
  readonly body: string;
  readonly audienceRealm?: string;
  readonly audienceDepartment?: string;
  readonly priority?: Priority;
  readonly category?: string;
  readonly expiresAt?: Date;
}

/**
 * Realtime delivery.
 *
 * Addressed by user, never by room name. The socket layer derives a person's
 * room from their authenticated identity; nothing that calls this can name a
 * room, so nothing can put itself in the path of somebody else's conversation.
 */
export interface RealtimeService {
  readonly connected: boolean;
  toUser(userId: string, event: string, payload: unknown): void;
  toUsers(userIds: readonly string[], event: string, payload: unknown): void;
}

// ── The Communication AI ─────────────────────────────────────────────────────

/**
 * Drafts, summarises, and flags. Never sends.
 *
 * Every method returns something a person then chooses to use. A suggested
 * reply is stored as a SUGGESTION message and is not delivered until somebody
 * sends it — the difference between an assistant and an impersonation, and the
 * reason a customer can trust that a message signed by their advisor was
 * written by their advisor.
 */
export interface CommunicationAssistant {
  readonly available: boolean;
  readonly unavailableReason?: string;
  summarise(conversationId: string): Promise<AssistantResult<{ summary: string; points: string[] }>>;
  draftReply(conversationId: string, intent?: string): Promise<AssistantResult<{ draft: string }>>;
  triage(conversationId: string): Promise<AssistantResult<{ urgency: Priority; why: string }>>;
  translate(text: string, target: string): Promise<AssistantResult<{ text: string }>>;
}

export interface AssistantResult<T> {
  readonly available: boolean;
  readonly data: T | null;
  readonly reason?: string;
  /** What the caller would need to provide for this to work. */
  readonly needs?: string;
}

// ── The registry ─────────────────────────────────────────────────────────────

export interface CommunicationPlatform {
  readonly events: EventBusService;
  readonly notifications: NotificationService;
  readonly conversations: CommunicationService;
  readonly inbox: InboxService;
  readonly timeline: TimelineService;
  readonly tasks: TaskService;
  readonly collaboration: CollaborationService;
  readonly realtime: RealtimeService;
  readonly assistant: CommunicationAssistant;
}
