/**
 * Delivery channels.
 *
 * Four exist as interfaces; two of them actually deliver. The other two report
 * `SUPPRESSED` with a reason naming exactly what is missing, and they are never
 * silently treated as sent.
 *
 * That distinction is the whole point. A user who enables SMS alerts for their
 * claim and hears nothing has been failed twice — once by the missing SMS, and
 * once by an interface that told them it was on. The preference is still
 * stored, the intent is still honoured the day a provider is wired in, and
 * until then the delivery ledger says plainly that nothing was sent and why.
 */
import prisma from "../config/db";
import { logger } from "../config/logger";
import type { Channel, DeliveryChannel, DeliveryStatus, NotificationInput } from "./contracts";
import { realtime } from "./eventBus";

type Input = NotificationInput & { notificationId: string };

/**
 * In-app. The notification row is already written by the time a channel runs,
 * so this only confirms it.
 */
export const inAppChannel: DeliveryChannel = {
  channel: "IN_APP",
  available: true,
  async deliver() {
    return { status: "DELIVERED" as DeliveryStatus };
  },
};

/** Realtime nudge, so an open portal updates without a refresh. */
export const realtimeChannel: DeliveryChannel = {
  channel: "REALTIME",
  get available() {
    return realtime().connected;
  },
  get unavailableReason() {
    return realtime().connected ? undefined : "No socket server is attached to this process.";
  },
  async deliver(input: Input) {
    const rt = realtime();
    if (!rt.connected) {
      // Not a failure. The notification is in the database; the user will see
      // it on their next page load. Recording it as FAILED would put a red mark
      // against a system that worked.
      return {
        status: "SUPPRESSED" as DeliveryStatus,
        reason: "No realtime connection in this process; the notification is stored and will appear on next load.",
      };
    }
    rt.toUser(input.userId, "notification", {
      id: input.notificationId,
      category: input.category,
      title: input.title,
      body: input.body ?? null,
      priority: input.priority ?? "NORMAL",
      deepLink: input.deepLink ?? null,
      createdAt: new Date().toISOString(),
    });
    return { status: "SENT" as DeliveryStatus };
  },
};

/**
 * Email, through the existing auth mailer's webhook.
 *
 * Reuses the platform's one outbound path rather than opening a second. When
 * no webhook is configured the mailer logs instead of sending, which is right
 * for development and must not be reported as delivery.
 */
export const emailChannel: DeliveryChannel = {
  channel: "EMAIL",
  get available() {
    return Boolean(process.env.AUTH_MAIL_WEBHOOK_URL);
  },
  get unavailableReason() {
    return process.env.AUTH_MAIL_WEBHOOK_URL
      ? undefined
      : "AUTH_MAIL_WEBHOOK_URL is not configured, so nothing is actually sent.";
  },
  async deliver(input: Input) {
    if (!process.env.AUTH_MAIL_WEBHOOK_URL) {
      return {
        status: "SUPPRESSED" as DeliveryStatus,
        reason: "No outbound mail webhook is configured (AUTH_MAIL_WEBHOOK_URL).",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    });
    if (!user) {
      return { status: "FAILED" as DeliveryStatus, reason: "The recipient no longer exists." };
    }

    try {
      const response = await fetch(process.env.AUTH_MAIL_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: `NOTIFICATION_${input.category}`,
          to: user.email,
          subject: input.title,
          body: input.body ?? input.title,
          // Deep links are relative by the time they reach here; the mail
          // service is what knows which portal host to put in front.
          path: input.deepLink ?? null,
        }),
      });
      if (!response.ok) {
        return { status: "FAILED" as DeliveryStatus, reason: `Mail webhook returned ${response.status}.` };
      }
      return { status: "SENT" as DeliveryStatus };
    } catch (err) {
      logger.warn({ err }, "Notification email failed");
      return { status: "FAILED" as DeliveryStatus, reason: "The mail webhook could not be reached." };
    }
  },
};

/**
 * A channel that is declared but has no provider.
 *
 * Used for SMS and push. It always suppresses, and says what would make it
 * work. Writing a stub that returned SENT would make the delivery statistics
 * on the super-admin dashboard confidently wrong.
 */
function unimplemented(channel: Channel, needs: string): DeliveryChannel {
  return {
    channel,
    available: false,
    unavailableReason: needs,
    async deliver() {
      return { status: "SUPPRESSED" as DeliveryStatus, reason: needs };
    },
  };
}

export const smsChannel = unimplemented(
  "SMS",
  "No SMS provider is configured. Implement DeliveryChannel for SMS and register it with registerChannels()."
);

export const pushChannel = unimplemented(
  "PUSH",
  "No push provider is configured. Implement DeliveryChannel for PUSH and register it with registerChannels()."
);

const defaults: DeliveryChannel[] = [
  inAppChannel,
  realtimeChannel,
  emailChannel,
  smsChannel,
  pushChannel,
];

let active: DeliveryChannel[] = [...defaults];

export const channels = (): readonly DeliveryChannel[] => active;

/** Replaces channels by name, leaving the rest in place. */
export function registerChannels(replacements: readonly DeliveryChannel[]): void {
  const byName = new Map(active.map((c) => [c.channel, c]));
  for (const replacement of replacements) byName.set(replacement.channel, replacement);
  active = [...byName.values()];
}

export function resetChannels(): void {
  active = [...defaults];
}
