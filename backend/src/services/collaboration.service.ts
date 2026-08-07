/**
 * Collaboration: announcements, the activity feed, and communication analytics.
 *
 * Announcements are stored once and read by many, rather than fanned out into a
 * notification per recipient. A company-wide message to fifty thousand
 * customers would otherwise be fifty thousand writes, and a read receipt table
 * that only grows when somebody actually reads is far smaller than one row per
 * person who might.
 */
import prisma from "../config/db";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { roleHasPermission } from "../auth/permissions";
import { emit, realtime } from "../communication/eventBus";
import { channels } from "../communication/channels";
import type {
  Actor,
  AnnouncementInput,
  CollaborationService,
} from "../communication/contracts";

const REALMS = new Set(["ALL", "CUSTOMER", "EMPLOYEE", "ENTERPRISE", "PLATFORM"]);
const CATEGORIES = new Set(["ANNOUNCEMENT", "MAINTENANCE", "SECURITY", "POLICY_BROADCAST"]);

export const collaborationService: CollaborationService = {
  /**
   * Publish a broadcast.
   *
   * A platform-wide announcement and a departmental one are the same operation
   * with different reach, but they are not the same authority: reaching every
   * realm requires `platform.configure`, which only an Aegis operator holds. An
   * enterprise administrator can address their own staff, and that is the
   * boundary that keeps a customer of Aegis from messaging everyone on it.
   */
  async announce(actor: Actor, input: AnnouncementInput) {
    const title = input.title?.trim();
    const body = input.body?.trim();
    if (!title || !body) {
      throw new AppError("An announcement needs a title and a message.", 400, "CONTENT_REQUIRED");
    }

    const audienceRealm = input.audienceRealm ?? "EMPLOYEE";
    if (!REALMS.has(audienceRealm)) {
      throw new AppError("That is not an audience we recognise.", 400, "UNKNOWN_AUDIENCE");
    }

    const category = input.category && CATEGORIES.has(input.category) ? input.category : "ANNOUNCEMENT";

    const platformWide = audienceRealm === "ALL" || audienceRealm === "CUSTOMER";
    if (platformWide && !roleHasPermission(actor.role, "platform.configure")) {
      throw new AppError(
        "Only a platform operator can broadcast beyond your own organisation.",
        403,
        "AUDIENCE_TOO_BROAD"
      );
    }
    if (!roleHasPermission(actor.role, "staff.manage") && !roleHasPermission(actor.role, "platform.configure")) {
      throw new AppError("You do not have permission to make announcements.", 403, "FORBIDDEN");
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: title.slice(0, 200),
        body: body.slice(0, 10_000),
        audienceRealm,
        audienceDepartment: input.audienceDepartment ?? null,
        priority: input.priority ?? "NORMAL",
        category,
        publishedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
        createdById: actor.id,
      },
    });

    auditService.record({
      actorId: actor.id,
      action: "announcement.published",
      metadata: { id: announcement.id, audienceRealm, category, priority: announcement.priority },
    });

    emit({
      name: "announcement.published",
      actorId: actor.id,
      actorKind: "USER",
      subjectKind: "announcement",
      subjectId: announcement.id,
      payload: { audienceRealm, priority: announcement.priority, title: announcement.title },
    });

    // A realtime nudge to whoever is connected, so an urgent maintenance notice
    // reaches open screens. Bounded — this is a nudge to refresh, not the
    // delivery mechanism, which is the announcement row itself.
    const audience = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(audienceRealm === "ALL" ? {} : { realm: audienceRealm }),
      },
      select: { id: true },
      take: 2_000,
    });
    realtime().toUsers(
      audience.map((u) => u.id),
      "announcement",
      { id: announcement.id, title: announcement.title, priority: announcement.priority }
    );

    return announcement;
  },

  /** What is currently published for this person. */
  async announcements(actor: Actor) {
    const realm = actor.realm ?? "CUSTOMER";
    const now = new Date();

    const items = await prisma.announcement.findMany({
      where: {
        publishedAt: { not: null, lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        audienceRealm: { in: ["ALL", realm] },
      },
      orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        priority: true,
        publishedAt: true,
        expiresAt: true,
        reads: { where: { userId: actor.id }, select: { readAt: true } },
      },
    });

    return {
      announcements: items.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category,
        priority: a.priority,
        publishedAt: a.publishedAt,
        expiresAt: a.expiresAt,
        read: a.reads.length > 0,
      })),
    };
  },

  /**
   * The activity feed: what colleagues have been doing.
   *
   * Staff-only, and built from work items rather than from an event table. It
   * deliberately shows *that* work moved, not what was said about it — a feed
   * that surfaced note bodies would spread one customer's case across every
   * colleague's home page.
   */
  async activityFeed(actor: Actor, options = {}) {
    if (!roleHasPermission(actor.role, "work.read")) {
      throw new AppError("The activity feed is for staff.", 403, "FORBIDDEN");
    }
    const take = Math.min(Math.max(Number(options.take ?? 30), 1), 100);

    const events = await prisma.workItemEvent.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        kind: true,
        summary: true,
        actorId: true,
        createdAt: true,
        workItem: { select: { id: true, reference: true, kind: true, department: true } },
      },
    });

    const actorIds = [...new Set(events.map((e) => e.actorId).filter((v): v is string => !!v))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(actors.map((a) => [a.id, a.name]));

    return {
      events: events.map((e) => ({
        id: e.id,
        kind: e.kind,
        summary: e.summary,
        at: e.createdAt,
        actorName: e.actorId ? (nameById.get(e.actorId) ?? "Someone") : "Aegis",
        workItemId: e.workItem.id,
        reference: e.workItem.reference,
        department: e.workItem.department,
        deepLink: `/work/${e.workItem.id}`,
      })),
    };
  },
};

/** Marks an announcement read. Written on read, so the table stays small. */
export async function markAnnouncementRead(actor: Actor, announcementId: string) {
  const exists = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true },
  });
  if (!exists) throw new AppError("That announcement does not exist.", 404, "NOT_FOUND");

  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId, userId: actor.id } },
    create: { announcementId, userId: actor.id },
    update: {},
  });
  return { read: true };
}

// ── Communication analytics ──────────────────────────────────────────────────

/**
 * What administrators and operators monitor.
 *
 * Every figure here comes from `DeliveryRecord`, which is written on every
 * attempt including the ones that were suppressed. That is what makes "98%
 * delivered" meaningful — the denominator includes the messages nobody sent.
 */
export const communicationAnalytics = {
  /** For an administrator: is the department communicating? */
  async overview() {
    const since = new Date(Date.now() - 7 * 86_400_000);

    const [byStatus, byChannel, suppressionReasons, conversations, messages, announcements, unread] =
      await Promise.all([
      prisma.deliveryRecord.groupBy({
        by: ["status"],
        where: { attemptedAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.deliveryRecord.groupBy({
        by: ["channel", "status"],
        where: { attemptedAt: { gte: since } },
        _count: { _all: true },
      }),
      // Why things were suppressed, so an operator can tell "no SMS provider"
      // apart from "recipients switched it off" — two very different fixes.
      prisma.deliveryRecord.groupBy({
        by: ["reason"],
        where: { attemptedAt: { gte: since }, status: "SUPPRESSED" },
        _count: { _all: true },
      }),
      prisma.conversation.count({ where: { createdAt: { gte: since } } }),
      prisma.message.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      prisma.announcement.count({ where: { publishedAt: { gte: since } } }),
      prisma.notification.count({ where: { status: "UNREAD" } }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) statusCounts[row.status] = row._count._all;

    const attempted = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const succeeded = (statusCounts.SENT ?? 0) + (statusCounts.DELIVERED ?? 0);
    const suppressed = statusCounts.SUPPRESSED ?? 0;

    // The rate is computed over the channels that were actually tried, not over
    // every row. A deployment with no SMS provider writes a SUPPRESSED row for
    // every notification, which would drag a perfectly healthy platform to
    // "40% delivered" and send somebody hunting for a fault that does not
    // exist. Suppressions are real and are reported — separately, with their
    // reasons, because they describe missing configuration rather than failed
    // delivery.
    const deliverable = attempted - suppressed;

    const channelRows = new Map<string, Record<string, number>>();
    for (const row of byChannel) {
      const existing = channelRows.get(row.channel) ?? {};
      existing[row.status] = row._count._all;
      channelRows.set(row.channel, existing);
    }

    return {
      windowDays: 7,
      delivery: {
        attempted,
        succeeded,
        suppressed,
        // Reported as null rather than 0% when nothing was tried. A zero here
        // reads as total failure; null reads as no traffic.
        successRate: deliverable === 0 ? null : Math.round((succeeded / deliverable) * 100),
        successRateNote:
          "Over the channels that were actually tried. Suppressed attempts — a channel with no provider, or one the recipient switched off — are counted separately, since they are configuration rather than failure.",
        suppressionReasons: suppressionReasons.map((r) => ({
          reason: r.reason ?? "unstated",
          count: r._count._all,
        })),
        byStatus: statusCounts,
        byChannel: [...channelRows.entries()].map(([channel, counts]) => ({ channel, counts })),
      },
      collaboration: {
        conversationsStarted: conversations,
        messagesPosted: messages,
        announcementsPublished: announcements,
      },
      unreadNotifications: unread,
      /**
       * Whether people actually read what they are sent.
       *
       * Read receipts exist for announcements and notifications, but nothing
       * links a read back to the delivery that prompted it, so an engagement
       * rate would be a guess dressed as a measurement.
       */
      engagementRate: {
        available: false,
        reason: "Nothing links a read back to the delivery that prompted it.",
        needs:
          "A deliveryRecordId written onto the notification read, or a click-through parameter on deep links.",
      },
    };
  },

  /** For a platform operator: is the pipe healthy? */
  async health() {
    const since = new Date(Date.now() - 24 * 3_600_000);

    const [records, pending, failures, latency] = await Promise.all([
      prisma.deliveryRecord.count({ where: { attemptedAt: { gte: since } } }),
      prisma.deliveryRecord.count({ where: { status: "PENDING" } }),
      prisma.deliveryRecord.findMany({
        where: { status: "FAILED", attemptedAt: { gte: since } },
        orderBy: { attemptedAt: "desc" },
        take: 20,
        select: { channel: true, reason: true, attemptedAt: true },
      }),
      prisma.deliveryRecord.aggregate({
        where: { attemptedAt: { gte: since }, latencyMs: { not: null } },
        _avg: { latencyMs: true },
        _max: { latencyMs: true },
        _count: { _all: true },
      }),
    ]);

    return {
      windowHours: 24,
      attempted: records,
      queued: pending,
      recentFailures: failures,
      latency: {
        // Averages over the measured rows only, and says how many those were.
        averageMs: latency._avg.latencyMs === null ? null : Math.round(latency._avg.latencyMs),
        worstMs: latency._max.latencyMs ?? null,
        measured: latency._count._all,
      },
      channels: channels().map((c) => ({
        channel: c.channel,
        available: c.available,
        ...(c.unavailableReason ? { reason: c.unavailableReason } : {}),
      })),
      realtime: {
        connected: realtime().connected,
        note: realtime().connected
          ? "A socket server is attached to this process."
          : "No socket server in this process; notifications are stored and appear on next load.",
      },
    };
  },
};
