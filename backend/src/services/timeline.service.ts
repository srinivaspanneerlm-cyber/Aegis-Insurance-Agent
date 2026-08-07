/**
 * The activity timeline.
 *
 * Assembled at read time from the systems that already keep their own history:
 * work items, documents, intelligence runs, conversations and notifications.
 *
 * There is deliberately **no timeline table**. Copying those events into one
 * would create a second version of the truth, and the copy drifts from the
 * original the first time a write path forgets to fan out — which is not an
 * "if". The cost is a wider read; the benefit is that a timeline can never
 * disagree with the case it describes.
 *
 * Scope comes from the same place it does everywhere else: the caller's
 * identity, checked once, at the top.
 */
import prisma from "../config/db";
import AppError from "../utils/appError";
import { roleHasPermission } from "../auth/permissions";
import type { Actor, TimelineService } from "../communication/contracts";

export interface TimelineEntry {
  readonly at: Date;
  /** work | document | intelligence | message | notification | approval */
  readonly source: string;
  readonly kind: string;
  readonly summary: string;
  readonly actorId: string | null;
  readonly actorKind: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly deepLink: string | null;
}

const STAFF_REALMS = new Set(["EMPLOYEE", "ENTERPRISE", "PLATFORM"]);

/**
 * May this actor read this person's timeline?
 *
 * The same predicate as the intelligence engine's: yourself always, somebody
 * else only with `customer.read`. Kept as one function so a new caller cannot
 * invent a looser rule.
 */
function authorise(actor: Actor, targetUserId: string): void {
  if (actor.id === targetUserId) return;
  if (roleHasPermission(actor.role, "customer.read")) return;
  throw new AppError("You do not have access to that timeline.", 403, "FORBIDDEN");
}

export const timelineService: TimelineService = {
  /**
   * Everything that has happened to one thing.
   *
   * `subjectKind` is validated against a closed set rather than passed to a
   * query — an open-ended subject would let a caller aim this at any table.
   */
  async forSubject(actor: Actor, subjectKind: string, subjectId: string) {
    if (subjectKind === "workItem") return workItemTimeline(actor, subjectId);
    if (subjectKind === "user") return this.forUser(actor, subjectId);
    throw new AppError("We do not keep a timeline for that.", 400, "UNKNOWN_SUBJECT");
  },

  /** Everything that has happened to one person, across every subsystem. */
  async forUser(actor: Actor, userId: string, options = {}) {
    authorise(actor, userId);
    const take = Math.min(Math.max(Number(options.take ?? 50), 1), 100);
    const isStaff = STAFF_REALMS.has(actor.realm ?? "") || roleHasPermission(actor.role, "customer.read");

    const [documents, work, runs, notifications, messages] = await Promise.all([
      prisma.documentEvent.findMany({
        where: { document: { ownerId: userId } },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          createdAt: true,
          stage: true,
          actorKind: true,
          actorId: true,
          summary: true,
          documentId: true,
        },
      }),
      prisma.workItem.findMany({
        where: { customerId: userId },
        orderBy: { openedAt: "desc" },
        take,
        select: {
          id: true,
          kind: true,
          reference: true,
          title: true,
          status: true,
          openedAt: true,
          resolvedAt: true,
        },
      }),
      prisma.intelligenceRun.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, kind: true, createdAt: true, confidence: true },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          category: true,
          title: true,
          createdAt: true,
          deepLink: true,
          priority: true,
        },
      }),
      // Message activity, without message bodies. A timeline says a
      // conversation happened; reading it requires opening the thread, where
      // the internal-note filter applies.
      prisma.message.findMany({
        where: {
          conversation: { participants: { some: { userId } } },
          deletedAt: null,
          ...(isStaff ? {} : { internal: false }),
        },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          senderKind: true,
          createdAt: true,
          internal: true,
        },
      }),
    ]);

    const entries: TimelineEntry[] = [
      ...documents.map((d) => ({
        at: d.createdAt,
        source: "document",
        kind: d.stage,
        summary: d.summary,
        actorId: d.actorId,
        actorKind: d.actorKind,
        subjectKind: "document",
        subjectId: d.documentId,
        deepLink: `/documents/${d.documentId}`,
      })),
      ...work.flatMap((w) => {
        const opened: TimelineEntry = {
          at: w.openedAt,
          source: "work",
          kind: "OPENED",
          summary: `${w.kind} opened — ${w.title} (${w.reference})`,
          actorId: null,
          actorKind: "SYSTEM",
          subjectKind: "workItem",
          subjectId: w.id,
          deepLink: `/work/${w.id}`,
        };
        return w.resolvedAt
          ? [
              opened,
              {
                ...opened,
                at: w.resolvedAt,
                kind: "RESOLVED",
                summary: `${w.kind} resolved — ${w.reference}`,
              },
            ]
          : [opened];
      }),
      ...runs.map((r) => ({
        at: r.createdAt,
        source: "intelligence",
        kind: r.kind,
        summary: `Insurance analysis run${r.confidence !== null ? ` (confidence ${Math.round(r.confidence * 100)}%)` : ""}`,
        actorId: null,
        actorKind: "AI",
        subjectKind: "intelligenceRun",
        subjectId: r.id,
        deepLink: "/advice",
      })),
      ...notifications.map((n) => ({
        at: n.createdAt,
        source: "notification",
        kind: n.category,
        summary: n.title,
        actorId: null,
        actorKind: "SYSTEM",
        subjectKind: "notification",
        subjectId: n.id,
        deepLink: n.deepLink,
      })),
      ...messages.map((m) => ({
        at: m.createdAt,
        source: "message",
        kind: m.internal ? "INTERNAL_NOTE" : "MESSAGE",
        summary: m.internal ? "An internal note was added" : "A message was sent",
        actorId: m.senderId,
        actorKind: m.senderKind,
        subjectKind: "conversation",
        subjectId: m.conversationId,
        deepLink: `/inbox/${m.conversationId}`,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, take);

    return {
      userId,
      entries,
      sources: {
        // Named so a portal can say "nothing from documents yet" rather than
        // showing an empty feed that looks like a failure.
        document: documents.length,
        work: work.length,
        intelligence: runs.length,
        notification: notifications.length,
        message: messages.length,
      },
    };
  },
};

/** One case, end to end: its own events plus the documents and threads on it. */
async function workItemTimeline(actor: Actor, workItemId: string) {
  const item = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: { id: true, customerId: true, reference: true, title: true, kind: true, status: true },
  });
  if (!item) throw new AppError("That case does not exist.", 404, "NOT_FOUND");

  // Either it is your case, or you can read customers. Same rule as above.
  const mine = item.customerId === actor.id;
  if (!mine && !roleHasPermission(actor.role, "work.read") && !roleHasPermission(actor.role, "customer.read")) {
    throw new AppError("That case does not exist.", 404, "NOT_FOUND");
  }

  const isStaff = STAFF_REALMS.has(actor.realm ?? "") || roleHasPermission(actor.role, "work.read");

  const [events, conversations] = await Promise.all([
    prisma.workItemEvent.findMany({
      where: { workItemId },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { createdAt: true, kind: true, actorId: true, summary: true },
    }),
    prisma.conversation.findMany({
      where: {
        workItemId,
        // A customer sees the case thread, never the internal one.
        ...(isStaff ? {} : { kind: { not: "INTERNAL" } }),
      },
      select: { id: true, kind: true, subject: true, lastMessageAt: true },
    }),
  ]);

  const entries: TimelineEntry[] = [
    ...events.map((e) => ({
      at: e.createdAt,
      source: "work",
      kind: e.kind,
      summary: e.summary,
      actorId: e.actorId,
      actorKind: e.actorId ? "USER" : "SYSTEM",
      subjectKind: "workItem",
      subjectId: workItemId,
      deepLink: `/work/${workItemId}`,
    })),
    ...conversations.map((c) => ({
      at: c.lastMessageAt,
      source: "message",
      kind: c.kind,
      summary: c.subject ?? "Conversation",
      actorId: null,
      actorKind: "SYSTEM",
      subjectKind: "conversation",
      subjectId: c.id,
      deepLink: `/inbox/${c.id}`,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return { workItem: item, entries };
}
