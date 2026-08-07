/**
 * Workflow communication — where the platform's subsystems become a
 * conversation.
 *
 * This module is the whole point of the event bus. A document being verified is
 * interesting to four different people for four different reasons, and before
 * this the upload service would have had to know about all of them. Now it
 * raises one event and stops caring.
 *
 * The chain Sprint 10 describes, wired end to end:
 *
 *     customer uploads   → the assigned employee is told there is work
 *     employee verifies  → the customer is told, in words they can act on
 *     document rejected  → the customer is told *why*, and what to do
 *     analysis ready     → the customer is told their advice has changed
 *     task assigned      → the assignee is told, with the reason if AI raised it
 *
 * Every subscriber is registered in one place so the consequences of an event
 * can be read in one screen. A notification that nobody can find the source of
 * is a notification nobody can fix.
 */
import prisma from "../config/db";
import { logger } from "../config/logger";
import { notificationService } from "../services/notification.service";
import { eventBus } from "./eventBus";
import type { PlatformEvent } from "./contracts";

/** Everyone who should hear about a customer's case, other than the customer. */
async function staffFor(customerId: string | null): Promise<string[]> {
  if (!customerId) return [];
  const work = await prisma.workItem.findMany({
    where: { customerId, status: { notIn: ["CLOSED", "CANCELLED"] } },
    select: { assignee: { select: { userId: true } } },
    take: 10,
  });
  return [
    ...new Set(
      work.map((w) => w.assignee?.userId).filter((v): v is string => typeof v === "string")
    ),
  ];
}

const handlers: Array<{ event: PlatformEvent["name"]; handle: (e: PlatformEvent) => Promise<void> }> = [
  // ── Documents ──────────────────────────────────────────────────────────────
  {
    event: "document.uploaded",
    async handle(event) {
      const ownerId = String(event.payload.ownerId ?? "");
      const filename = String(event.payload.filename ?? "a document");
      const recipients = await staffFor(ownerId);

      await Promise.all(
        recipients.map((userId) =>
          notificationService.send({
            userId,
            category: "DOCUMENT",
            title: "A document is waiting for review",
            body: `${filename} was uploaded and is ready to check.`,
            priority: "NORMAL",
            deepLink: "/documents",
            subjectKind: "document",
            subjectId: event.subjectId,
            // One nudge per person per window. A customer uploading six
            // photographs of a damaged car is one piece of work, not six.
            dedupeKey: `document-queue:${ownerId}`,
          })
        )
      );
    },
  },
  {
    event: "document.verified",
    async handle(event) {
      const ownerId = String(event.payload.ownerId ?? "");
      if (!ownerId) return;
      await notificationService.send({
        userId: ownerId,
        category: "DOCUMENT",
        title: "Your document has been accepted",
        body: `${String(event.payload.filename ?? "Your document")} has been checked and accepted. Nothing further is needed.`,
        priority: "NORMAL",
        deepLink: "/documents",
        subjectKind: "document",
        subjectId: event.subjectId,
      });
    },
  },
  {
    event: "document.rejected",
    async handle(event) {
      const ownerId = String(event.payload.ownerId ?? "");
      if (!ownerId) return;
      const reason = String(event.payload.reason ?? "");

      // HIGH, and the reason is the body rather than a link to find it. A
      // rejection the customer has to go hunting for is a rejection that stalls
      // their application for a week.
      await notificationService.send({
        userId: ownerId,
        category: "DOCUMENT",
        title: "We could not use one of your documents",
        body: reason
          ? `${reason} You can upload a replacement from your documents page.`
          : "Please upload a replacement from your documents page.",
        priority: "HIGH",
        deepLink: "/documents",
        subjectKind: "document",
        subjectId: event.subjectId,
      });
    },
  },
  {
    event: "document.requested",
    async handle(event) {
      const subjectId = String(event.payload.subjectId ?? "");
      const count = Number(event.payload.count ?? 0);
      if (!subjectId || count === 0) return;

      await notificationService.send({
        userId: subjectId,
        category: "DOCUMENT",
        title: `We need ${count} document${count === 1 ? "" : "s"} from you`,
        body: "Each one says why we are asking, so you can see what it is for.",
        priority: "HIGH",
        deepLink: "/documents",
        subjectKind: "documentRequest",
        subjectId: event.subjectId,
        dedupeKey: `document-request:${subjectId}`,
      });
    },
  },

  // ── Work items ─────────────────────────────────────────────────────────────
  {
    event: "workitem.assigned",
    async handle(event) {
      const assigneeUserId = String(event.payload.assigneeUserId ?? "");
      if (!assigneeUserId) return;

      const origin = String(event.payload.origin ?? "HUMAN");
      const rationale = String(event.payload.rationale ?? "");

      await notificationService.send({
        userId: assigneeUserId,
        category: "TASK",
        title: String(event.payload.title ?? "A task was assigned to you"),
        // An AI-raised task says so and says why. An employee is entitled to
        // know whether a person or a model decided this needed doing, because
        // it changes how much they should trust it.
        body:
          origin === "AI"
            ? `Suggested by Aegis: ${rationale || "no reason was recorded."}`
            : (String(event.payload.summary ?? "") || undefined),
        priority: String(event.payload.priority ?? "NORMAL") === "URGENT" ? "URGENT" : "HIGH",
        deepLink: `/work/${event.subjectId}`,
        subjectKind: "workItem",
        subjectId: event.subjectId,
      });
    },
  },
  {
    event: "workitem.escalated",
    async handle(event) {
      const recipients = (event.payload.recipientIds ?? []) as string[];
      await Promise.all(
        recipients.map((userId) =>
          notificationService.send({
            userId,
            category: "TASK",
            title: "A case has been escalated",
            body: String(event.payload.reason ?? "") || undefined,
            priority: "URGENT",
            deepLink: `/work/${event.subjectId}`,
            subjectKind: "workItem",
            subjectId: event.subjectId,
          })
        )
      );
    },
  },
  {
    event: "workitem.status_changed",
    async handle(event) {
      const customerId = String(event.payload.customerId ?? "");
      const status = String(event.payload.status ?? "");
      if (!customerId) return;

      // Only the transitions a customer cares about. Telling somebody their
      // claim moved from OPEN to IN_PROGRESS four times teaches them to ignore
      // the one that says RESOLVED.
      const worthTelling: Record<string, { title: string; body: string }> = {
        AWAITING_CUSTOMER: {
          title: "We need something from you",
          body: "Your case is waiting on you before it can move forward.",
        },
        RESOLVED: {
          title: "Your case has been resolved",
          body: "You can see what was decided and why on the case page.",
        },
        CLOSED: { title: "Your case is closed", body: "Nothing further is needed." },
      };
      const message = worthTelling[status];
      if (!message) return;

      await notificationService.send({
        userId: customerId,
        category: "CLAIM",
        title: message.title,
        body: message.body,
        priority: status === "AWAITING_CUSTOMER" ? "HIGH" : "NORMAL",
        deepLink: `/work/${event.subjectId}`,
        subjectKind: "workItem",
        subjectId: event.subjectId,
      });
    },
  },

  // ── Intelligence ───────────────────────────────────────────────────────────
  {
    event: "intelligence.gap_found",
    async handle(event) {
      const userId = String(event.payload.userId ?? "");
      const summary = String(event.payload.summary ?? "");
      if (!userId || !summary) return;

      await notificationService.send({
        userId,
        category: "AI_SUGGESTION",
        title: "Something in your cover is worth a look",
        body: summary,
        priority: String(event.payload.severity ?? "") === "CRITICAL" ? "HIGH" : "NORMAL",
        deepLink: "/advice",
        subjectKind: "intelligenceRun",
        subjectId: event.subjectId,
        // At most one advice nudge per person per window, however many gaps a
        // single analysis found.
        dedupeKey: `intelligence-gap:${userId}`,
      });
    },
  },
  {
    event: "policy.renewal_due",
    async handle(event) {
      const userId = String(event.payload.userId ?? "");
      const days = Number(event.payload.daysAway ?? 0);
      if (!userId) return;

      await notificationService.send({
        userId,
        category: "RENEWAL",
        title: days < 0 ? "A policy renewal date has passed" : `A policy renews in ${days} days`,
        body: String(event.payload.improvement ?? "") || undefined,
        priority: days <= 7 ? "HIGH" : "NORMAL",
        deepLink: "/policies",
        subjectKind: "heldPolicy",
        subjectId: event.subjectId,
        dedupeKey: `renewal:${event.subjectId}`,
      });
    },
  },

  // ── Security ───────────────────────────────────────────────────────────────
  {
    event: "security.alert",
    async handle(event) {
      const userId = String(event.payload.userId ?? "");
      if (!userId) return;
      // Priority is always URGENT and the category is unsuppressible, so this
      // reaches somebody who has muted everything else.
      await notificationService.send({
        userId,
        category: "SECURITY",
        title: String(event.payload.title ?? "Unusual activity on your account"),
        body: String(event.payload.body ?? "") || undefined,
        priority: "URGENT",
        deepLink: "/security",
        subjectKind: "user",
        subjectId: userId,
      });
    },
  },
];

let unsubscribers: Array<() => void> = [];

/**
 * Wires every subscriber. Called once at startup.
 *
 * Idempotent: calling it twice does not double-deliver, which matters because
 * the test suite boots the app repeatedly in one process.
 */
export function registerWorkflowCommunication(): void {
  unregisterWorkflowCommunication();
  unsubscribers = handlers.map(({ event, handle }) =>
    eventBus().subscribe(event, async (e) => {
      try {
        await handle(e);
      } catch (err) {
        // A failed notification must never fail the thing that caused it. The
        // upload succeeded; the customer will still see the document.
        logger.error({ event: e.name, err }, "A workflow communication handler failed");
      }
    })
  );
}

export function unregisterWorkflowCommunication(): void {
  for (const off of unsubscribers) off();
  unsubscribers = [];
}
