import express from "express";
import type { Request } from "express";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { protect, requirePermission } from "../middleware/auth.middleware";
import { notificationService, preferenceService } from "../services/notification.service";
import { conversationService, inboxService } from "../services/conversation.service";
import { timelineService } from "../services/timeline.service";
import {
  collaborationService,
  communicationAnalytics,
  markAnnouncementRead,
} from "../services/collaboration.service";
import { assistant } from "../communication/assistant";

const router = express.Router();

/**
 * The communication platform, over HTTP.
 *
 * Scope-walled, not realm-walled — everybody communicates, and what differs is
 * who they may reach. Conversation access is decided by membership rows in the
 * service; nothing here reads a role to decide whether a thread is visible.
 *
 * The `userId` on the timeline routes is checked by the service, never trusted
 * from the query.
 */
router.use(protect);

const actor = (req: Request) => ({
  id: req.user!.id,
  role: req.user!.role,
  realm: req.user!.realm,
});
const q = (req: Request, key: string): string | undefined =>
  typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;
const param = (req: Request, key: string): string =>
  typeof req.params[key] === "string" ? (req.params[key] as string) : "";
const ids = (body: unknown): string[] =>
  Array.isArray((body as { ids?: unknown })?.ids)
    ? ((body as { ids: unknown[] }).ids.filter((v): v is string => typeof v === "string"))
    : [];

// ── Notifications ────────────────────────────────────────────────────────────

router.get(
  "/notifications",
  catchAsync(async (req, res) => {
    const result = await notificationService.list(req.user!.id, {
      ...(q(req, "status") ? { status: q(req, "status") as string } : {}),
      ...(q(req, "category") ? { category: q(req, "category") as never } : {}),
      take: Number(q(req, "take") ?? 30),
    });
    sendSuccess(res, 200, result);
  })
);

router.get(
  "/notifications/unread-count",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await notificationService.unreadCount(req.user!.id));
  })
);

router.post(
  "/notifications/read",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await notificationService.markRead(req.user!.id, ids(req.body)));
  })
);

router.post(
  "/notifications/archive",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await notificationService.archive(req.user!.id, ids(req.body)));
  })
);

// ── Preferences ──────────────────────────────────────────────────────────────

router.get(
  "/preferences",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await preferenceService.get(req.user!.id));
  })
);

router.put(
  "/preferences",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await preferenceService.save(req.user!.id, req.body ?? {}));
  })
);

// ── Inbox and conversations ──────────────────────────────────────────────────

router.get(
  "/inbox",
  catchAsync(async (req, res) => {
    const result = await inboxService.unified(actor(req), {
      ...(q(req, "search") ? { search: q(req, "search") as string } : {}),
      ...(q(req, "category") ? { category: q(req, "category") as string } : {}),
      unreadOnly: q(req, "unreadOnly") === "true",
      take: Number(q(req, "take") ?? 50),
    });
    sendSuccess(res, 200, result);
  })
);

router.post(
  "/conversations",
  catchAsync(async (req, res) => {
    sendSuccess(res, 201, await conversationService.startConversation(actor(req), req.body ?? {}));
  })
);

router.get(
  "/conversations/:id",
  catchAsync(async (req, res) => {
    const result = await conversationService.thread(actor(req), param(req, "id"), {
      take: Number(q(req, "take") ?? 100),
    });
    sendSuccess(res, 200, result);
  })
);

router.post(
  "/conversations/:id/messages",
  catchAsync(async (req, res) => {
    sendSuccess(
      res,
      201,
      await conversationService.post(actor(req), param(req, "id"), req.body ?? {})
    );
  })
);

router.post(
  "/conversations/:id/participants",
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as { userId?: string; role?: string };
    sendSuccess(
      res,
      201,
      await conversationService.addParticipant(
        actor(req),
        param(req, "id"),
        body.userId ?? "",
        body.role
      )
    );
  })
);

router.post(
  "/conversations/:id/read",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await conversationService.markRead(actor(req), param(req, "id")));
  })
);

// ── The Communication Assistant ──────────────────────────────────────────────
//
// Behind the same membership check as reading the thread: these routes call the
// service first, which throws if the caller is not a participant. An assistant
// that could summarise a conversation the caller cannot open would be a way to
// read it.

router.get(
  "/conversations/:id/summary",
  catchAsync(async (req, res) => {
    await conversationService.thread(actor(req), param(req, "id"), { take: 1 });
    sendSuccess(res, 200, await assistant().summarise(param(req, "id")));
  })
);

router.get(
  "/conversations/:id/triage",
  catchAsync(async (req, res) => {
    await conversationService.thread(actor(req), param(req, "id"), { take: 1 });
    sendSuccess(res, 200, await assistant().triage(param(req, "id")));
  })
);

router.post(
  "/conversations/:id/draft",
  catchAsync(async (req, res) => {
    await conversationService.thread(actor(req), param(req, "id"), { take: 1 });
    const body = (req.body ?? {}) as { intent?: string };
    sendSuccess(res, 200, await assistant().draftReply(param(req, "id"), body.intent));
  })
);

// ── Timeline ─────────────────────────────────────────────────────────────────

router.get(
  "/timeline",
  catchAsync(async (req, res) => {
    const target = q(req, "userId") ?? req.user!.id;
    const result = await timelineService.forUser(actor(req), target, {
      take: Number(q(req, "take") ?? 50),
    });
    sendSuccess(res, 200, result);
  })
);

router.get(
  "/timeline/:subjectKind/:subjectId",
  catchAsync(async (req, res) => {
    const result = await timelineService.forSubject(
      actor(req),
      param(req, "subjectKind"),
      param(req, "subjectId")
    );
    sendSuccess(res, 200, result);
  })
);

// ── Announcements and collaboration ──────────────────────────────────────────

router.get(
  "/announcements",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await collaborationService.announcements(actor(req)));
  })
);

router.post(
  "/announcements/:id/read",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await markAnnouncementRead(actor(req), param(req, "id")));
  })
);

router.post(
  "/announcements",
  catchAsync(async (req, res) => {
    sendSuccess(res, 201, await collaborationService.announce(actor(req), req.body ?? {}));
  })
);

router.get(
  "/activity",
  requirePermission("work.read"),
  catchAsync(async (req, res) => {
    const result = await collaborationService.activityFeed(actor(req), {
      take: Number(q(req, "take") ?? 30),
    });
    sendSuccess(res, 200, result);
  })
);

// ── Analytics ────────────────────────────────────────────────────────────────

router.get(
  "/analytics/overview",
  requirePermission("analytics.read"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await communicationAnalytics.overview());
  })
);

/**
 * Platform health.
 *
 * Behind `platform.configure` rather than `analytics.read`: this describes the
 * pipe rather than the business, and an enterprise administrator monitoring
 * their own department has no need for the platform's queue depth.
 */
router.get(
  "/analytics/health",
  requirePermission("platform.configure"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, await communicationAnalytics.health());
  })
);

export default router;
