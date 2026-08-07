/**
 * Notifications.
 *
 * Three things happen here that are easy to leave out and expensive to add
 * later.
 *
 * **Deduplication.** A renewal that is due generates an event every time
 * something touches the policy. Without a dedupe window the customer gets four
 * identical notices and learns to ignore the bell, which costs more than the
 * notification was worth.
 *
 * **Preferences that cannot hide a break-in.** Security alerts ignore every
 * mute, every quiet-hours window and every channel preference. A setting whose
 * only effect is to help an attacker stay unnoticed is not a feature.
 *
 * **Delivery is recorded, including when it did not happen.** Every channel
 * attempt writes a row saying what was tried and what came of it, so the
 * super-admin delivery statistics describe reality rather than intent.
 */
import prisma from "../config/db";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { channels } from "../communication/channels";
import {
  UNSUPPRESSIBLE,
  isNotificationCategory,
  type Channel,
  type NotificationCategory,
  type NotificationInput,
  type NotificationService,
  type Priority,
} from "../communication/contracts";

/** How long an identical notification is collapsed onto the first. */
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Deep links must be relative.
 *
 * An absolute URL in a notification is a phishing vector: it takes one badly
 * validated call site for the platform to start mailing customers links to
 * somebody else's host, over its own signature.
 */
function safeDeepLink(link: string | undefined): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

function parseMuted(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

/** "22:00"–"07:00" spans midnight; the comparison has to handle that. */
function inQuietHours(start: string | null, end: string | null, now = new Date()): boolean {
  if (!start || !end) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const [sh = 0, sm = 0] = start.split(":").map(Number);
  const [eh = 0, em = 0] = end.split(":").map(Number);
  const from = sh * 60 + sm;
  const to = eh * 60 + em;
  return from <= to ? current >= from && current < to : current >= from || current < to;
}

export const notificationService: NotificationService = {
  async send(input: NotificationInput) {
    if (!isNotificationCategory(input.category)) {
      throw new AppError("That is not a notification category we recognise.", 400, "UNKNOWN_CATEGORY");
    }
    if (!input.title?.trim()) {
      throw new AppError("A notification needs a title.", 400, "TITLE_REQUIRED");
    }

    const priority: Priority = input.priority ?? "NORMAL";
    const isSecurity = UNSUPPRESSIBLE.includes(input.category);

    // Collapse repeats. Security is exempt: two sign-ins from two devices are
    // two things the account holder needs to know about, not one.
    if (input.dedupeKey && !isSecurity) {
      const recent = await prisma.notification.findFirst({
        where: {
          userId: input.userId,
          dedupeKey: input.dedupeKey,
          createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
        },
        select: { id: true },
      });
      if (recent) return { id: recent.id, delivered: [], suppressed: [] };
    }

    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: input.userId },
    });

    const muted = parseMuted(prefs?.mutedCategories ?? null);
    const quiet = inQuietHours(prefs?.quietHoursStart ?? null, prefs?.quietHoursEnd ?? null);

    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        // The legacy `type` column stays populated so anything written before
        // this sprint keeps reading what it expects.
        type: input.category.toLowerCase(),
        category: input.category,
        title: input.title.trim(),
        body: input.body ?? null,
        priority,
        status: "UNREAD",
        deepLink: safeDeepLink(input.deepLink),
        subjectKind: input.subjectKind ?? null,
        subjectId: input.subjectId ?? null,
        dedupeKey: input.dedupeKey ?? null,
      },
    });

    const delivered: Channel[] = [];
    const suppressed: Array<{ channel: Channel; reason: string }> = [];
    const started = Date.now();

    for (const channel of channels()) {
      // A channel with no provider is reported as such, ahead of any
      // preference. "The recipient has not enabled SMS" is true but useless to
      // an operator wondering why no SMS ever goes out; "no SMS provider is
      // configured" is the fact that needs acting on.
      if (!channel.available) {
        const reason = channel.unavailableReason ?? "This channel is not available.";
        suppressed.push({ channel: channel.channel, reason });
        await record(notification.id, input.userId, channel.channel, "SUPPRESSED", reason, null);
        continue;
      }

      const decision = decide(channel.channel, {
        isSecurity,
        priority,
        muted: muted.has(input.category),
        quiet,
        prefs,
      });

      if (!decision.allowed) {
        suppressed.push({ channel: channel.channel, reason: decision.reason });
        await record(notification.id, input.userId, channel.channel, "SUPPRESSED", decision.reason, null);
        continue;
      }

      const result = await channel.deliver({ ...input, notificationId: notification.id, priority });
      const latency = Date.now() - started;

      if (result.status === "SENT" || result.status === "DELIVERED") {
        delivered.push(channel.channel);
      } else {
        suppressed.push({ channel: channel.channel, reason: result.reason ?? "Not delivered." });
      }
      await record(
        notification.id,
        input.userId,
        channel.channel,
        result.status,
        result.reason ?? null,
        latency
      );
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { deliveredAt: delivered.length > 0 ? new Date() : null },
    });

    if (isSecurity) {
      auditService.record({
        actorId: null,
        action: "notification.security.sent",
        metadata: { userId: input.userId, title: input.title, delivered },
      });
    }

    return { id: notification.id, delivered, suppressed };
  },

  async list(userId: string, options = {}) {
    const take = Math.min(Math.max(Number(options.take ?? 30), 1), 100);
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(options.status ? { status: options.status } : {}),
        ...(options.category ? { category: options.category } : {}),
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
        subjectKind: true,
        subjectId: true,
        createdAt: true,
        readAt: true,
      },
    });
    return { notifications };
  },

  async markRead(userId: string, ids: string[]) {
    if (ids.length === 0) return { updated: 0 };
    // Scoped by userId in the same statement, so a caller cannot mark somebody
    // else's notification read by guessing an id.
    const result = await prisma.notification.updateMany({
      where: { id: { in: ids.slice(0, 200) }, userId, status: "UNREAD" },
      data: { status: "READ", isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  },

  async archive(userId: string, ids: string[]) {
    if (ids.length === 0) return { updated: 0 };
    const result = await prisma.notification.updateMany({
      where: { id: { in: ids.slice(0, 200) }, userId },
      data: { status: "ARCHIVED", isRead: true, archivedAt: new Date() },
    });
    return { updated: result.count };
  },

  async unreadCount(userId: string) {
    const rows = await prisma.notification.groupBy({
      by: ["category"],
      where: { userId, status: "UNREAD" },
      _count: { _all: true },
    });
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      byCategory[row.category] = row._count._all;
      total += row._count._all;
    }
    return { total, byCategory };
  },
};

/** Whether a channel may be used for this notification, and why not. */
function decide(
  channel: Channel,
  context: {
    isSecurity: boolean;
    priority: Priority;
    muted: boolean;
    quiet: boolean;
    prefs: { inApp: boolean; email: boolean; sms: boolean; push: boolean } | null;
  }
): { allowed: true } | { allowed: false; reason: string } {
  // Security overrides everything, including the user's own settings. Somebody
  // who has muted notifications still needs to hear that their password
  // changed.
  if (context.isSecurity) return { allowed: true };

  if (context.muted) {
    return { allowed: false, reason: "The recipient has muted this category." };
  }

  if (context.quiet && context.priority !== "URGENT") {
    return { allowed: false, reason: "Within the recipient's quiet hours and not urgent." };
  }

  const prefs = context.prefs;
  if (!prefs) {
    // No preferences saved. In-app and realtime are the defaults; email is not,
    // because mailing somebody who never asked to be mailed is how a platform
    // ends up in a spam folder permanently.
    return channel === "IN_APP" || channel === "REALTIME"
      ? { allowed: true }
      : { allowed: false, reason: "The recipient has not enabled this channel." };
  }

  const enabled: Record<Channel, boolean> = {
    IN_APP: prefs.inApp,
    REALTIME: prefs.inApp,
    EMAIL: prefs.email,
    SMS: prefs.sms,
    PUSH: prefs.push,
  };

  return enabled[channel]
    ? { allowed: true }
    : { allowed: false, reason: "The recipient has this channel switched off." };
}

async function record(
  notificationId: string,
  userId: string,
  channel: Channel,
  status: string,
  reason: string | null,
  latencyMs: number | null
): Promise<void> {
  try {
    await prisma.deliveryRecord.create({
      data: {
        notificationId,
        userId,
        channel,
        status,
        reason,
        latencyMs,
        settledAt: new Date(),
      },
    });
  } catch {
    // The ledger is for reporting. Failing to write it must never fail the
    // notification it describes.
  }
}

/** Preferences, with the unsuppressible categories enforced on write. */
export const preferenceService = {
  async get(userId: string) {
    const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
    const available = channels().map((c) => ({
      channel: c.channel,
      available: c.available,
      ...(c.unavailableReason ? { reason: c.unavailableReason } : {}),
    }));

    if (!prefs) {
      return {
        exists: false as const,
        inApp: true,
        email: true,
        sms: false,
        push: false,
        reminderFrequency: "IMMEDIATE",
        language: "en",
        mutedCategories: [] as string[],
        quietHoursStart: null,
        quietHoursEnd: null,
        channels: available,
      };
    }

    return {
      exists: true as const,
      inApp: prefs.inApp,
      email: prefs.email,
      sms: prefs.sms,
      push: prefs.push,
      reminderFrequency: prefs.reminderFrequency,
      language: prefs.language,
      mutedCategories: [...parseMuted(prefs.mutedCategories)],
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
      channels: available,
    };
  },

  async save(userId: string, input: Record<string, unknown>) {
    const requestedMutes = Array.isArray(input.mutedCategories)
      ? (input.mutedCategories as unknown[]).filter(isNotificationCategory)
      : undefined;

    // Silently dropping a security mute would be dishonest; refusing it tells
    // the user what the platform will and will not do.
    if (requestedMutes?.some((c) => UNSUPPRESSIBLE.includes(c))) {
      throw new AppError(
        "Security alerts cannot be switched off. They tell you when somebody signs in as you.",
        400,
        "CATEGORY_NOT_SUPPRESSIBLE"
      );
    }

    const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
    const existing = await prisma.notificationPreference.findUnique({ where: { userId } });

    const data = {
      inApp: bool(input.inApp, existing?.inApp ?? true),
      email: bool(input.email, existing?.email ?? true),
      sms: bool(input.sms, existing?.sms ?? false),
      push: bool(input.push, existing?.push ?? false),
      reminderFrequency:
        typeof input.reminderFrequency === "string" &&
        ["IMMEDIATE", "DAILY", "WEEKLY"].includes(input.reminderFrequency)
          ? input.reminderFrequency
          : (existing?.reminderFrequency ?? "IMMEDIATE"),
      language: typeof input.language === "string" ? input.language.slice(0, 12) : (existing?.language ?? "en"),
      mutedCategories: requestedMutes
        ? JSON.stringify(requestedMutes)
        : (existing?.mutedCategories ?? null),
      quietHoursStart:
        typeof input.quietHoursStart === "string" ? input.quietHoursStart : (existing?.quietHoursStart ?? null),
      quietHoursEnd:
        typeof input.quietHoursEnd === "string" ? input.quietHoursEnd : (existing?.quietHoursEnd ?? null),
    };

    await prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    auditService.record({ actorId: userId, action: "notification.preferences.saved", metadata: {} });
    return this.get(userId);
  },
};

export type { NotificationCategory };
