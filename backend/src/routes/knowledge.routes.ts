import express from "express";
import type { Request } from "express";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { protect, requirePermission } from "../middleware/auth.middleware";
import { knowledgeService, ensureCategories } from "../services/knowledge.service";
import {
  conversationMemoryService,
  memoryService,
  organizationMemoryService,
} from "../services/memory.service";
import { searchService } from "../knowledge/search";
import { knowledgeRouter, knowledgePermissionService } from "../knowledge/router";
import { documentParser } from "../knowledge/parsers";
import { categoryRepository, knowledgeRepository, tagRepository } from "../knowledge/repository";
import type { MemoryKind, MemoryScope } from "../knowledge/contracts";

const router = express.Router();

/**
 * The Knowledge & Memory Platform, over HTTP.
 *
 * Scope-walled rather than realm-walled. Everybody consults knowledge; what
 * differs is which classification they may read, and that is decided inside the
 * service by `visibilityFilter` — the one expression of it, so a route cannot
 * widen it by forgetting a parameter.
 *
 * Reads are open to any authenticated caller. Writing needs `knowledge.write`;
 * approving needs review authority on top, because an author approving their
 * own guidance makes the review step decorative.
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
const asDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** Body fields that are dates arrive as strings; parse before the service sees them. */
function articleBody(raw: unknown) {
  const body = (raw ?? {}) as Record<string, unknown>;
  return {
    ...body,
    ...(asDate(body.effectiveFrom) ? { effectiveFrom: asDate(body.effectiveFrom) } : {}),
    ...(asDate(body.effectiveTo) ? { effectiveTo: asDate(body.effectiveTo) } : {}),
    ...(asDate(body.reviewDueAt) ? { reviewDueAt: asDate(body.reviewDueAt) } : {}),
  } as never;
}

// ── Taxonomy ─────────────────────────────────────────────────────────────────

router.get(
  "/categories",
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, { categories: await categoryRepository.list() });
  })
);

router.post(
  "/categories/seed",
  requirePermission("knowledge.write"),
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, { seeded: await ensureCategories() });
  })
);

router.get(
  "/tags",
  catchAsync(async (_req, res) => {
    sendSuccess(res, 200, { tags: await tagRepository.popular() });
  })
);

// ── Search ───────────────────────────────────────────────────────────────────

/**
 * Enterprise search.
 *
 * Reports its own method (`LEXICAL`) and says plainly when nothing matched and
 * why, rather than returning an empty array a caller has to interpret.
 */
router.get(
  "/search",
  catchAsync(async (req, res) => {
    const result = await searchService().search(actor(req), {
      text: q(req, "q") ?? "",
      ...(q(req, "category") ? { category: q(req, "category") as never } : {}),
      take: Number(q(req, "take") ?? 10),
      includeUnapproved: q(req, "includeUnapproved") === "true",
    });
    sendSuccess(res, 200, result, { results: result.hits.length });
  })
);

/**
 * Where a question should be answered from.
 *
 * Exposed so an assistant can ask before it fetches — the router is the only
 * sanctioned way in, and an assistant that guesses is an assistant that reaches
 * past it.
 */
router.post(
  "/route",
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as { question?: string; hasCustomer?: boolean };
    const decision = knowledgeRouter().route(body.question ?? "", {
      hasCustomer: Boolean(body.hasCustomer),
    });
    sendSuccess(res, 200, decision);
  })
);

// ── Articles ─────────────────────────────────────────────────────────────────

router.get(
  "/articles",
  catchAsync(async (req, res) => {
    const articles = await knowledgeRepository.list(actor(req), {
      ...(q(req, "category") ? { category: q(req, "category") as string } : {}),
      ...(q(req, "categoryId") ? { categoryId: q(req, "categoryId") as string } : {}),
      ...(q(req, "status") ? { status: q(req, "status") as string } : {}),
      take: Number(q(req, "take") ?? 30),
    });
    sendSuccess(res, 200, { articles }, { results: articles.length });
  })
);

router.post(
  "/articles",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 201, await knowledgeService.create(actor(req), articleBody(req.body)));
  })
);

router.get(
  "/articles/:idOrSlug",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await knowledgeService.get(actor(req), param(req, "idOrSlug")));
  })
);

router.patch(
  "/articles/:id",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    sendSuccess(
      res,
      200,
      await knowledgeService.update(actor(req), param(req, "id"), articleBody(req.body))
    );
  })
);

router.post(
  "/articles/:id/submit",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await knowledgeService.submitForReview(actor(req), param(req, "id")));
  })
);

router.post(
  "/articles/:id/review",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as { decision?: string; notes?: string };
    const decision = body.decision;
    if (decision !== "APPROVED" && decision !== "REJECTED" && decision !== "CHANGES_REQUESTED") {
      sendSuccess(res, 400, { error: "Unknown decision." });
      return;
    }
    sendSuccess(
      res,
      200,
      await knowledgeService.review(actor(req), param(req, "id"), decision, body.notes)
    );
  })
);

router.post(
  "/articles/:id/archive",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as { reason?: string };
    sendSuccess(
      res,
      200,
      await knowledgeService.archive(actor(req), param(req, "id"), body.reason ?? "")
    );
  })
);

// ── Versions ─────────────────────────────────────────────────────────────────

router.get(
  "/articles/:id/history",
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await knowledgeService.history(actor(req), param(req, "id")));
  })
);

// ── Permissions ──────────────────────────────────────────────────────────────

router.get(
  "/articles/:id/permissions",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, { grants: await knowledgePermissionService.list(param(req, "id")) });
  })
);

router.post(
  "/articles/:id/permissions",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as { userId?: string; role?: string; access?: string; expiresAt?: string };
    sendSuccess(
      res,
      201,
      await knowledgePermissionService.grant(actor(req), param(req, "id"), {
        ...(body.userId ? { userId: body.userId } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.access ? { access: body.access } : {}),
        ...(asDate(body.expiresAt) ? { expiresAt: asDate(body.expiresAt) as Date } : {}),
      })
    );
  })
);

router.delete(
  "/permissions/:id",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await knowledgePermissionService.revoke(actor(req), param(req, "id")));
  })
);

// ── Ingestion ────────────────────────────────────────────────────────────────

/**
 * Parses an internal file into draft sections.
 *
 * Text and markdown only. Anything else comes back `ok: false` with the reason,
 * rather than a partial extraction somebody would approve without reading.
 */
router.post(
  "/parse",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as { filename?: string; mimeType?: string; text?: string };
    const result = await documentParser().parse({
      filename: body.filename ?? "untitled.txt",
      mimeType: body.mimeType ?? null,
      ...(body.text !== undefined ? { text: body.text } : {}),
    });
    sendSuccess(res, 200, result);
  })
);

// ── Analytics ────────────────────────────────────────────────────────────────

router.get(
  "/analytics",
  requirePermission("knowledge.write"),
  catchAsync(async (req, res) => {
    sendSuccess(res, 200, await knowledgeService.analytics(actor(req)));
  })
);

// ── Memory ───────────────────────────────────────────────────────────────────

const scopeOf = (value: string | undefined): MemoryScope =>
  (["CUSTOMER", "EMPLOYEE", "ORGANIZATION", "PLATFORM"] as const).includes(value as MemoryScope)
    ? (value as MemoryScope)
    : "CUSTOMER";

router.post(
  "/memory",
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    sendSuccess(
      res,
      201,
      await memoryService.remember(actor(req), {
        scope: scopeOf(body.scope as string),
        subjectId: String(body.subjectId ?? ""),
        kind: body.kind as MemoryKind,
        key: String(body.key ?? ""),
        value: body.value,
        ...(typeof body.confidence === "number" ? { confidence: body.confidence } : {}),
        ...(body.source ? { source: body.source as never } : {}),
        ...(body.sourceRef ? { sourceRef: String(body.sourceRef) } : {}),
        ...(asDate(body.expiresAt) ? { expiresAt: asDate(body.expiresAt) as Date } : {}),
      })
    );
  })
);

router.get(
  "/memory/:scope/:subjectId",
  catchAsync(async (req, res) => {
    const facts = await memoryService.recall(
      actor(req),
      scopeOf(param(req, "scope")),
      param(req, "subjectId"),
      {
        ...(q(req, "kind") ? { kind: q(req, "kind") as MemoryKind } : {}),
        ...(q(req, "prefix") ? { prefix: q(req, "prefix") as string } : {}),
      }
    );
    sendSuccess(res, 200, { facts }, { results: facts.length });
  })
);

router.get(
  "/memory/:scope/:subjectId/history/:key",
  catchAsync(async (req, res) => {
    sendSuccess(
      res,
      200,
      await memoryService.keyHistory(
        actor(req),
        scopeOf(param(req, "scope")),
        param(req, "subjectId"),
        param(req, "key")
      )
    );
  })
);

/** A subject-access export: everything held, including superseded records. */
router.get(
  "/memory/:scope/:subjectId/export",
  catchAsync(async (req, res) => {
    sendSuccess(
      res,
      200,
      await memoryService.export(actor(req), scopeOf(param(req, "scope")), param(req, "subjectId"))
    );
  })
);

router.delete(
  "/memory/:scope/:subjectId/:key",
  catchAsync(async (req, res) => {
    sendSuccess(
      res,
      200,
      await memoryService.forget(
        actor(req),
        scopeOf(param(req, "scope")),
        param(req, "subjectId"),
        param(req, "key")
      )
    );
  })
);

// ── Conversation memory ──────────────────────────────────────────────────────

router.post(
  "/conversation-memory",
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    sendSuccess(
      res,
      201,
      await conversationMemoryService.note(actor(req), {
        sessionRef: String(body.sessionRef ?? ""),
        kind: String(body.kind ?? ""),
        label: String(body.label ?? ""),
        value: body.value,
        ...(body.userId ? { userId: String(body.userId) } : {}),
        ...(typeof body.pinned === "boolean" ? { pinned: body.pinned } : {}),
        ...(body.retention ? { retention: body.retention as never } : {}),
        ...(typeof body.ttlMinutes === "number" ? { ttlMinutes: body.ttlMinutes } : {}),
      })
    );
  })
);

router.get(
  "/conversation-memory/:sessionRef",
  catchAsync(async (req, res) => {
    sendSuccess(
      res,
      200,
      await conversationMemoryService.forSession(actor(req), param(req, "sessionRef"), {
        pinnedOnly: q(req, "pinnedOnly") === "true",
      })
    );
  })
);

router.post(
  "/conversation-memory/:id/pin",
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as { pinned?: boolean };
    sendSuccess(
      res,
      200,
      await conversationMemoryService.pin(actor(req), param(req, "id"), body.pinned !== false)
    );
  })
);

/** Writes a conversational note into institutional memory, with provenance. */
router.post(
  "/conversation-memory/:id/promote",
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    sendSuccess(
      res,
      201,
      await conversationMemoryService.promote(actor(req), param(req, "id"), {
        scope: scopeOf(body.scope as string),
        subjectId: String(body.subjectId ?? ""),
        kind: (body.kind ?? "FACT") as MemoryKind,
        key: String(body.key ?? ""),
        ...(typeof body.confidence === "number" ? { confidence: body.confidence } : {}),
      })
    );
  })
);

// ── Organisation memory ──────────────────────────────────────────────────────

router.get(
  "/organization-memory/:organizationId",
  catchAsync(async (req, res) => {
    const facts = await organizationMemoryService.recall(
      actor(req),
      param(req, "organizationId"),
      { ...(q(req, "prefix") ? { prefix: q(req, "prefix") as string } : {}) }
    );
    sendSuccess(res, 200, { facts }, { results: facts.length });
  })
);

router.post(
  "/organization-memory/:organizationId",
  catchAsync(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    sendSuccess(
      res,
      201,
      await organizationMemoryService.remember(actor(req), param(req, "organizationId"), {
        kind: (body.kind ?? "CONTEXT") as MemoryKind,
        key: String(body.key ?? ""),
        value: body.value,
        ...(body.sourceRef ? { sourceRef: String(body.sourceRef) } : {}),
      })
    );
  })
);

export default router;
