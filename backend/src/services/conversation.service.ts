/**
 * Conversations, and the inbox built on them.
 *
 * The rule that governs every read here: **membership decides visibility, and
 * membership is a row.** Not a permission, not a role check computed at read
 * time. Somebody who was in a conversation last March can still be shown to
 * have been in it, and somebody promoted yesterday does not retroactively gain
 * sight of a discussion they were never part of.
 *
 * The second rule: **an internal note is never visible to a customer.** Case
 * threads carry both — an advisor's note to a colleague and a reply to the
 * customer live on the same thread, because splitting them means an advisor
 * reading two screens to follow one conversation. The filter is applied in the
 * query, on the server, based on the reader's realm.
 */
import prisma from "../config/db";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { notificationService } from "./notification.service";
import { emit, realtime } from "../communication/eventBus";
import type {
  Actor,
  CommunicationService,
  InboxQuery,
  InboxService,
  PostMessageInput,
  StartConversationInput,
} from "../communication/contracts";

const KINDS = new Set(["DIRECT", "CASE", "INTERNAL", "ANNOUNCEMENT"]);
const MESSAGE_KINDS = new Set(["NOTE", "REPLY", "SUMMARY", "SUGGESTION", "SYSTEM_EVENT"]);
const MAX_BODY = 8_000;

/** Staff realms. A customer is anybody who is not one of these. */
const STAFF_REALMS = new Set(["EMPLOYEE", "ENTERPRISE", "PLATFORM"]);

async function realmOf(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { realm: true } });
  return user?.realm ?? "CUSTOMER";
}

/**
 * Confirms the actor is in this conversation and may act on it.
 *
 * Returns 404 rather than 403 for a conversation they are not in — the same
 * non-disclosure rule the document platform uses. A 403 confirms the thread
 * exists, which on a thread whose subject is a person's claim is itself a leak.
 */
async function membership(actor: Actor, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  if (!conversation) throw new AppError("That conversation does not exist.", 404, "NOT_FOUND");

  const participant = conversation.participants.find(
    (p) => p.userId === actor.id && p.leftAt === null
  );
  if (!participant) {
    auditService.record({
      actorId: actor.id,
      action: "authz.conversation.denied",
      metadata: { conversationId },
    });
    throw new AppError("That conversation does not exist.", 404, "NOT_FOUND");
  }

  return { conversation, participant };
}

export const conversationService: CommunicationService = {
  async startConversation(actor: Actor, input: StartConversationInput) {
    if (!KINDS.has(input.kind)) {
      throw new AppError("That is not a kind of conversation we support.", 400, "UNKNOWN_KIND");
    }

    const actorRealm = actor.realm ?? (await realmOf(actor.id));

    // Only staff open internal threads. A customer who could would have created
    // a discussion about themselves that they can read and staff assume is
    // private.
    if (input.kind === "INTERNAL" && !STAFF_REALMS.has(actorRealm)) {
      throw new AppError("Only staff can start an internal discussion.", 403, "STAFF_ONLY");
    }

    const ids = [...new Set([actor.id, ...input.participantIds])].slice(0, 50);
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, realm: true },
    });
    if (users.length !== ids.length) {
      throw new AppError("One of those people does not exist.", 400, "UNKNOWN_PARTICIPANT");
    }

    // An internal thread with a customer in it is a contradiction that would
    // only be discovered when somebody wrote something they should not have.
    if (input.kind === "INTERNAL" && users.some((u) => !STAFF_REALMS.has(u.realm))) {
      throw new AppError(
        "An internal discussion cannot include a customer.",
        400,
        "CUSTOMER_IN_INTERNAL"
      );
    }

    const conversation = await prisma.conversation.create({
      data: {
        kind: input.kind,
        subject: input.subject?.slice(0, 200) ?? null,
        workItemId: input.workItemId ?? null,
        customerId: input.customerId ?? null,
        createdById: actor.id,
        participants: {
          create: ids.map((id) => ({
            userId: id,
            role: id === actor.id ? "OWNER" : "MEMBER",
            addedById: actor.id,
          })),
        },
      },
    });

    auditService.record({
      actorId: actor.id,
      action: "conversation.started",
      metadata: { conversationId: conversation.id, kind: input.kind, participants: ids.length },
    });

    return { id: conversation.id };
  },

  async post(actor: Actor, conversationId: string, input: PostMessageInput) {
    const body = input.body?.trim();
    if (!body) throw new AppError("A message needs something in it.", 400, "BODY_REQUIRED");
    if (body.length > MAX_BODY) {
      throw new AppError("That message is too long.", 400, "BODY_TOO_LONG");
    }

    const { conversation, participant } = await membership(actor, conversationId);

    if (participant.role === "OBSERVER") {
      throw new AppError("You can read this conversation but not post to it.", 403, "READ_ONLY");
    }
    if (conversation.status === "ARCHIVED") {
      throw new AppError("This conversation has been archived.", 409, "CONVERSATION_ARCHIVED");
    }

    const kind = input.kind && MESSAGE_KINDS.has(input.kind) ? input.kind : "REPLY";
    const actorRealm = actor.realm ?? (await realmOf(actor.id));

    // A customer cannot write an internal note. If they could, the note would
    // be hidden from them by the read filter — they would be writing into a
    // conversation they cannot see.
    const internal = Boolean(input.internal) && STAFF_REALMS.has(actorRealm);

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: actor.id,
        senderKind: "USER",
        body,
        kind,
        internal,
        attachmentIds: input.attachmentIds?.length
          ? JSON.stringify([...input.attachmentIds].slice(0, 20))
          : null,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });

    // A SUGGESTION is a draft the assistant proposed. It sits in the thread for
    // a person to send, and nobody is notified about it — being paged about a
    // machine's draft is how an assistant becomes an interruption.
    if (kind !== "SUGGESTION") {
      await notifyOthers(conversation, message, actor, internal);
    }

    await recordMentions(message.id, input.mentionIds ?? [], conversationId, actor);

    emit({
      name: "message.posted",
      actorId: actor.id,
      actorKind: "USER",
      subjectKind: "conversation",
      subjectId: conversationId,
      payload: { messageId: message.id, internal, kind },
    });

    return message;
  },

  async thread(actor: Actor, conversationId: string, options = {}) {
    const { conversation } = await membership(actor, conversationId);
    const actorRealm = actor.realm ?? (await realmOf(actor.id));
    const take = Math.min(Math.max(Number(options.take ?? 100), 1), 200);

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        // The filter that keeps internal notes internal. Applied in the query
        // rather than after it, so a paging bug cannot leak one.
        ...(STAFF_REALMS.has(actorRealm) ? {} : { internal: false }),
        // A customer never sees an unsent draft either.
        ...(STAFF_REALMS.has(actorRealm) ? {} : { kind: { not: "SUGGESTION" } }),
      },
      orderBy: { createdAt: "asc" },
      take,
      select: {
        id: true,
        senderId: true,
        senderKind: true,
        senderAgent: true,
        body: true,
        kind: true,
        internal: true,
        attachmentIds: true,
        editedAt: true,
        createdAt: true,
      },
    });

    const senderIds = [...new Set(messages.map((m) => m.senderId).filter((v): v is string => !!v))];
    const senders = await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(senders.map((s) => [s.id, s.name]));

    return {
      conversation: {
        id: conversation.id,
        kind: conversation.kind,
        subject: conversation.subject,
        status: conversation.status,
        workItemId: conversation.workItemId,
        customerId: conversation.customerId,
        lastMessageAt: conversation.lastMessageAt,
      },
      participants: conversation.participants
        .filter((p) => p.leftAt === null)
        .map((p) => ({ userId: p.userId, role: p.role, lastReadAt: p.lastReadAt })),
      messages: messages.map((m) => ({
        ...m,
        senderName: m.senderId ? (nameById.get(m.senderId) ?? "Someone") : (m.senderAgent ?? "Aegis"),
        attachmentIds: m.attachmentIds ? (JSON.parse(m.attachmentIds) as string[]) : [],
      })),
    };
  },

  async addParticipant(actor: Actor, conversationId: string, userId: string, role = "MEMBER") {
    const { conversation, participant } = await membership(actor, conversationId);
    if (participant.role !== "OWNER") {
      throw new AppError("Only the owner can add people to this conversation.", 403, "OWNER_ONLY");
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, realm: true },
    });
    if (!target) throw new AppError("That person does not exist.", 400, "UNKNOWN_PARTICIPANT");

    if (conversation.kind === "INTERNAL" && !STAFF_REALMS.has(target.realm)) {
      throw new AppError(
        "A customer cannot be added to an internal discussion.",
        400,
        "CUSTOMER_IN_INTERNAL"
      );
    }

    const added = await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, role, addedById: actor.id },
      update: { leftAt: null, role },
    });

    auditService.record({
      actorId: actor.id,
      action: "conversation.participant.added",
      metadata: { conversationId, userId, role },
    });

    return added;
  },

  async markRead(actor: Actor, conversationId: string) {
    await membership(actor, conversationId);
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: actor.id },
      data: { lastReadAt: new Date() },
    });
    return { read: true };
  },

};

/**
 * Tells everyone else on the thread.
 *
 * A module function rather than a method, because it is not part of
 * `CommunicationService` and putting it on the object would mean widening the
 * interface to describe an internal detail.
 */
async function notifyOthers(
  conversation: {
    id: string;
    kind: string;
    subject: string | null;
    participants: Array<{ userId: string; leftAt: Date | null; mutedAt: Date | null }>;
  },
  message: { id: string; body: string },
  actor: Actor,
  internal: boolean
): Promise<void> {
  const recipients = conversation.participants.filter(
    (p) => p.userId !== actor.id && p.leftAt === null && p.mutedAt === null
  );
  if (recipients.length === 0) return;

  // An internal note must not notify a customer who is on the thread. The
  // read filter would hide the message; a notification about a message they
  // cannot open is worse than no notification.
  const eligible = internal
    ? await prisma.user.findMany({
        where: { id: { in: recipients.map((r) => r.userId) }, realm: { in: [...STAFF_REALMS] } },
        select: { id: true },
      })
    : recipients.map((r) => ({ id: r.userId }));

  const preview = message.body.length > 120 ? `${message.body.slice(0, 117)}…` : message.body;

  await Promise.all(
    eligible.map((r) =>
      notificationService.send({
        userId: r.id,
        category: "MESSAGE",
        title: conversation.subject ?? "New message",
        body: preview,
        priority: "NORMAL",
        deepLink: `/inbox/${conversation.id}`,
        subjectKind: "conversation",
        subjectId: conversation.id,
        // One notification per conversation per window, not one per message.
        dedupeKey: `conversation:${conversation.id}`,
      })
    )
  );

  realtime().toUsers(
    eligible.map((r) => r.id),
    "message",
    { conversationId: conversation.id, messageId: message.id, preview }
  );
}

async function recordMentions(
  messageId: string,
  mentionIds: readonly string[],
  conversationId: string,
  actor: Actor
): Promise<void> {
  if (mentionIds.length === 0) return;

  // Only people already on the thread can be mentioned. Otherwise a mention
  // becomes a way to notify anyone on the platform about a conversation they
  // have no access to, quoting its subject line.
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { in: [...mentionIds].slice(0, 20) }, leftAt: null },
    select: { userId: true },
  });

  for (const p of participants) {
    if (p.userId === actor.id) continue;
    await prisma.mention.upsert({
      where: { messageId_userId: { messageId, userId: p.userId } },
      create: { messageId, userId: p.userId },
      update: {},
    });
    await notificationService.send({
      userId: p.userId,
      category: "MESSAGE",
      title: "You were mentioned",
      priority: "HIGH",
      deepLink: `/inbox/${conversationId}`,
      subjectKind: "conversation",
      subjectId: conversationId,
    });
  }

  emit({
    name: "message.mentioned",
    actorId: actor.id,
    actorKind: "USER",
    subjectKind: "conversation",
    subjectId: conversationId,
    payload: { messageId, mentioned: participants.map((p) => p.userId) },
  });
}

// ── The unified inbox ────────────────────────────────────────────────────────

export const inboxService: InboxService = {
  /**
   * Conversations, notifications and announcements in one list.
   *
   * Merged in memory rather than in SQL, deliberately. A UNION across three
   * differently-shaped tables would need a materialised view to stay fast, and
   * an inbox page is bounded — nobody reads past the first hundred items. Each
   * source is queried with its own index and capped before merging.
   */
  async unified(actor: Actor, options: InboxQuery = {}) {
    const take = Math.min(Math.max(Number(options.take ?? 50), 1), 100);
    const search = options.search?.trim();
    const actorRealm = actor.realm ?? (await realmOf(actor.id));

    const [memberships, notifications, announcements] = await Promise.all([
      prisma.conversationParticipant.findMany({
        where: { userId: actor.id, leftAt: null },
        take,
        orderBy: { conversation: { lastMessageAt: "desc" } },
        include: {
          conversation: {
            select: {
              id: true,
              kind: true,
              subject: true,
              status: true,
              lastMessageAt: true,
              customerId: true,
              workItemId: true,
            },
          },
        },
      }),
      prisma.notification.findMany({
        where: {
          userId: actor.id,
          status: options.unreadOnly ? "UNREAD" : { not: "ARCHIVED" },
          ...(options.category ? { category: options.category } : {}),
          ...(search ? { title: { contains: search } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          category: true,
          title: true,
          body: true,
          priority: true,
          status: true,
          deepLink: true,
          createdAt: true,
        },
      }),
      prisma.announcement.findMany({
        where: {
          publishedAt: { not: null, lte: new Date() },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          audienceRealm: { in: ["ALL", actorRealm] },
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          body: true,
          priority: true,
          category: true,
          publishedAt: true,
          reads: { where: { userId: actor.id }, select: { id: true } },
        },
      }),
    ]);

    // Unread counts per conversation, in one query rather than N.
    const conversationIds = memberships.map((m) => m.conversationId);
    const unreadRows =
      conversationIds.length > 0
        ? await prisma.message.groupBy({
            by: ["conversationId"],
            where: {
              conversationId: { in: conversationIds },
              deletedAt: null,
              senderId: { not: actor.id },
              ...(STAFF_REALMS.has(actorRealm) ? {} : { internal: false }),
            },
            _count: { _all: true },
          })
        : [];
    const totalByConversation = new Map(unreadRows.map((r) => [r.conversationId, r._count._all]));

    const items = [
      ...memberships
        .filter((m) => !search || (m.conversation.subject ?? "").toLowerCase().includes(search.toLowerCase()))
        .map((m) => ({
          itemKind: "conversation" as const,
          id: m.conversation.id,
          title: m.conversation.subject ?? "Conversation",
          body: null as string | null,
          category: m.conversation.kind,
          priority: "NORMAL",
          at: m.conversation.lastMessageAt,
          unread: m.lastReadAt === null || m.lastReadAt < m.conversation.lastMessageAt,
          messageCount: totalByConversation.get(m.conversation.id) ?? 0,
          deepLink: `/inbox/${m.conversation.id}`,
        })),
      ...notifications.map((n) => ({
        itemKind: "notification" as const,
        id: n.id,
        title: n.title,
        body: n.body,
        category: n.category,
        priority: n.priority,
        at: n.createdAt,
        unread: n.status === "UNREAD",
        messageCount: 0,
        deepLink: n.deepLink,
      })),
      ...announcements.map((a) => ({
        itemKind: "announcement" as const,
        id: a.id,
        title: a.title,
        body: a.body.length > 200 ? `${a.body.slice(0, 197)}…` : a.body,
        category: a.category,
        priority: a.priority,
        at: a.publishedAt ?? new Date(0),
        unread: a.reads.length === 0,
        messageCount: 0,
        deepLink: `/announcements/${a.id}`,
      })),
    ]
      .filter((item) => (options.unreadOnly ? item.unread : true))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, take);

    return {
      items,
      unread: items.filter((i) => i.unread).length,
    };
  },
};
