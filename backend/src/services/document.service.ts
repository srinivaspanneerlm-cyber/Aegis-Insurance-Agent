/**
 * Document intelligence.
 *
 * Two rules run through everything here:
 *
 *  1. **Scope is decided by who is asking, never by what they ask for.** A
 *     customer sees their own documents; an employee sees documents on work
 *     assigned to them; an administrator sees counts rather than contents. The
 *     narrowest path is the default.
 *  2. **A machine may move a document to review; only a person decides.** The
 *     pipeline can mark something PENDING_REVIEW and can explain why. VERIFIED
 *     and REJECTED are set by an employee, with their id recorded, because a
 *     customer refused by a score with no appeal is a complaint the platform
 *     deserves.
 */
import prisma from "../config/db";
import { logger } from "../config/logger";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { emit } from "../communication/eventBus";
import { roleHasPermission } from "../auth/permissions";
import { documentPipeline, uploadsPermitted, type DocumentRef } from "../documents/services";
import {
  DOCUMENT_CATALOGUE,
  completeness,
  isDomain,
  resolveRequirements,
  type RequirementContext,
} from "../documents/requirements";

const MAX_PAGE = 100;
const clampTake = (v: unknown, fallback = 25): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE);
};

/**
 * Every cross-customer path below — the review queue, the verification
 * decision, re-running the pipeline, deleting on somebody else's behalf —
 * used to be scoped by role alone: `work.write` or `work.read.all` opened
 * every organisation's documents, not just the caller's own. This is the one
 * check that closes it, used the same way at every one of those paths.
 *
 * `actor.organizationId` must be truthy for a match — an employee attached to
 * no organisation matches nothing, never everything, the same fail-closed
 * reading the enterprise console already applies. A document with no
 * organisation (every one uploaded before this existed) matches nothing
 * either, for the same reason.
 */
const sameOrg = (
  actor: { organizationId: string | null },
  document: { organizationId: string | null }
): boolean => Boolean(actor.organizationId) && document.organizationId === actor.organizationId;

/** Fields a client may see. `filepath` is never among them. */
const DOCUMENT_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  category: true,
  documentKey: true,
  domain: true,
  status: true,
  uploadedAt: true,
  verifiedAt: true,
  rejectionReason: true,
  riskScore: true,
  riskReason: true,
  ownerId: true,
};

function record(input: {
  documentId: string;
  stage: string;
  actorKind: "SYSTEM" | "ASSISTANT" | "EMPLOYEE";
  actorId?: string | null;
  summary: string;
  detail?: unknown;
}): void {
  // Best-effort. A timeline that fails to write must not fail the operation it
  // was describing — but it is the record a colleague reads to pick a case up,
  // so it is written for every stage rather than only the interesting ones.
  void prisma.documentEvent
    .create({
      data: {
        documentId: input.documentId,
        stage: input.stage,
        actorKind: input.actorKind,
        actorId: input.actorId ?? null,
        summary: input.summary,
        detail: input.detail === undefined ? null : JSON.stringify(input.detail),
      },
    })
    .catch(() => undefined);
}

export const documentService = {
  /**
   * Run a freshly uploaded document through the pipeline.
   *
   * Stages run in order and the order matters: nothing reads a document's
   * contents until the scanner has had its say. Every stage records what it did
   * — including "did not run" — so the timeline explains the outcome rather
   * than merely stating it.
   *
   * Returns the status the document ended on. Never throws for a stage failure;
   * a document that cannot be processed is a document needing a person, not an
   * error for the uploader.
   */
  async process(documentId: string, actor: { id: string; role: string; organizationId: string | null }) {
    // Checked here rather than at the route, because this is the only place
    // that reads the bytes. Anything that reaches the pipeline by another path
    // gets the same answer.
    const permitted = uploadsPermitted();
    if (!permitted.ok) {
      logger.error(permitted.reason);
      throw new AppError("Document uploads are temporarily unavailable.", 503, "UPLOADS_DISABLED");
    }

    const document = await prisma.uploadedDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new AppError("That document does not exist.", 404);
    if (!sameOrg(actor, document)) {
      auditService.record({
        actorId: actor.id,
        action: "authz.document.denied",
        metadata: { documentId, attempted: "process" },
      });
      throw new AppError("That document does not exist.", 404);
    }

    const ref: DocumentRef = {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      contentHash: document.contentHash,
      filepath: document.filepath,
    };

    const pipeline = documentPipeline();
    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });
    record({ documentId, stage: "UPLOADED", actorKind: "SYSTEM", summary: "Received." });

    // Raised here rather than at the route, because this is the point at which
    // the document actually enters the queue somebody has to work through.
    emit({
      name: "document.uploaded",
      actorId: null,
      actorKind: "SYSTEM",
      subjectKind: "document",
      subjectId: documentId,
      payload: { ownerId: document.ownerId, filename: document.filename },
    });

    // 1 — Scanning. Nothing else touches the bytes until this has answered.
    const scan = await pipeline.virusScan.scan(ref);
    record({
      documentId,
      stage: "SCANNED",
      actorKind: "SYSTEM",
      summary: scan.summary,
      detail: scan.data,
    });

    if (scan.ok && scan.data && !scan.data.clean) {
      await prisma.uploadedDocument.update({
        where: { id: documentId },
        data: {
          status: "REJECTED",
          rejectionReason: "The file did not pass a security scan and has not been stored.",
        },
      });
      record({
        documentId,
        stage: "REJECTED",
        actorKind: "SYSTEM",
        summary: "Rejected by the security scan.",
      });
      auditService.record({
        action: "document.rejected.malware",
        entity: "UploadedDocument",
        entityId: documentId,
        metadata: { signature: scan.data.signature },
      });
      return { status: "REJECTED" as const };
    }

    // 2 — Reading.
    const ocr = await pipeline.ocr.extractText(ref);
    record({ documentId, stage: "EXTRACTED", actorKind: "ASSISTANT", summary: ocr.summary });

    const metadata = await pipeline.metadata.extract(ref, document.documentKey);
    record({
      documentId,
      stage: "VALIDATED",
      actorKind: "ASSISTANT",
      summary: metadata.summary,
      detail: metadata.data,
    });

    // 3 — Risk. Scores, never decides.
    const fraud = await pipeline.fraud.assess(ref, {
      ocr: ocr.data,
      metadata: metadata.data,
    });
    record({
      documentId,
      stage: "ANALYSED",
      actorKind: "ASSISTANT",
      summary: fraud.summary,
      detail: fraud.data,
    });

    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: {
        status: "PENDING_REVIEW",
        ...(metadata.data ? { extractedData: JSON.stringify(metadata.data.fields) } : {}),
        ...(fraud.data ? { riskScore: fraud.data.score, riskReason: fraud.data.reasoning } : {}),
      },
    });
    record({
      documentId,
      stage: "PENDING_REVIEW",
      actorKind: "SYSTEM",
      summary: "Ready for a person to review.",
    });

    return { status: "PENDING_REVIEW" as const };
  },

  /**
   * A person's decision on a document.
   *
   * The only path to VERIFIED or REJECTED. A rejection must carry a reason,
   * because the customer is shown it and "rejected" alone gives them nothing to
   * act on — they will simply upload the same thing again.
   */
  async decide(
    documentId: string,
    input: { decision: "VERIFY" | "REJECT"; reason?: string },
    actor: { id: string; role: string; organizationId: string | null }
  ) {
    if (!roleHasPermission(actor.role, "work.write")) {
      auditService.record({
        actorId: actor.id,
        action: "authz.document.decision_denied",
        metadata: { documentId },
      });
      throw new AppError("You do not have permission to verify documents.", 403);
    }

    const document = await prisma.uploadedDocument.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new AppError("That document does not exist.", 404);
    if (!sameOrg(actor, document)) {
      auditService.record({
        actorId: actor.id,
        action: "authz.document.denied",
        metadata: { documentId, attempted: "decide" },
      });
      throw new AppError("That document does not exist.", 404);
    }

    if (input.decision === "REJECT" && !input.reason?.trim()) {
      throw new AppError(
        "A rejection needs a reason — the customer is shown it, and without one they will send the same document again.",
        400,
        "REASON_REQUIRED"
      );
    }

    const verified = input.decision === "VERIFY";
    const updated = await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: {
        status: verified ? "VERIFIED" : "REJECTED",
        verifiedAt: new Date(),
        verifiedById: actor.id,
        rejectionReason: verified ? null : (input.reason ?? "").trim(),
      },
      select: DOCUMENT_SELECT,
    });

    record({
      documentId,
      stage: verified ? "VERIFIED" : "REJECTED",
      actorKind: "EMPLOYEE",
      actorId: actor.id,
      summary: verified ? "Verified." : `Rejected — ${input.reason}`,
    });
    auditService.record({
      actorId: actor.id,
      action: verified ? "document.verified" : "document.rejected",
      entity: "UploadedDocument",
      entityId: documentId,
      metadata: { reason: input.reason ?? null },
    });

    // A verified document answers whatever it was asked for.
    if (verified && document.documentKey && document.ownerId) {
      await prisma.documentRequest
        .updateMany({
          where: { subjectId: document.ownerId, documentKey: document.documentKey, status: "PENDING" },
          data: { status: "SUPPLIED", fulfilledById: documentId, fulfilledAt: new Date() },
        })
        .catch(() => undefined);
    }

    // The customer is told either way. A rejection carries the reason in the
    // notification itself rather than behind a link, because a rejection the
    // customer has to go looking for stalls their application for a week.
    emit({
      name: verified ? "document.verified" : "document.rejected",
      actorId: actor.id,
      actorKind: "USER",
      subjectKind: "document",
      subjectId: documentId,
      payload: {
        ownerId: document.ownerId,
        filename: document.filename,
        reason: verified ? null : (input.reason ?? "").trim(),
      },
    });

    return updated;
  },

  /**
   * A customer's own documents, or an employee's queue.
   *
   * The caller never names whose documents they want. Somebody holding
   * `work.read.all` sees everything; everybody else sees their own, and the
   * query is built from their id rather than from a parameter.
   */
  async list(
    actor: { id: string; role: string; organizationId: string | null },
    query: { status?: string; domain?: string; search?: string; take?: unknown }
  ) {
    // work.read.all is a role, not a tenant — it says this person may see
    // everyone's documents *within their own organisation*, never across every
    // organisation on the platform. An employee holding it with no resolved
    // organisation cannot safely be handed "everyone" at all, so they fall
    // back to their own uploads, the same as anybody without the capability.
    const seesEveryone = roleHasPermission(actor.role, "work.read.all") && Boolean(actor.organizationId);
    const crossCustomerScope = seesEveryone ? { organizationId: actor.organizationId } : { ownerId: actor.id };

    const where = {
      deletedAt: null,
      ...crossCustomerScope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.domain ? { domain: query.domain } : {}),
      ...(query.search ? { filename: { contains: query.search } } : {}),
    };

    const [total, documents, byStatus] = await Promise.all([
      prisma.uploadedDocument.count({ where }),
      prisma.uploadedDocument.findMany({
        where,
        select: DOCUMENT_SELECT,
        orderBy: { uploadedAt: "desc" },
        take: clampTake(query.take),
      }),
      prisma.uploadedDocument.groupBy({
        by: ["status"],
        where: { deletedAt: null, ...crossCustomerScope },
        _count: { _all: true },
      }),
    ]);

    return {
      scope: seesEveryone ? ("ALL" as const) : ("MINE" as const),
      total,
      documents,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    };
  },

  /** One document with its timeline. Scoped the same way the list is. */
  async detail(actor: { id: string; role: string; organizationId: string | null }, id: string) {
    // organizationId is fetched for the authorisation check below and never
    // returned to the client — DOCUMENT_SELECT is the public contract, and
    // this is one field wider than it on purpose, only inside this function.
    const found = await prisma.uploadedDocument.findFirst({
      where: { id, deletedAt: null },
      select: { ...DOCUMENT_SELECT, organizationId: true },
    });
    if (!found) throw new AppError("That document does not exist.", 404);
    const { organizationId: _orgId, ...document } = found;
    void _orgId;

    // Owner, or a reviewer *in the same organisation*. The role alone used to
    // be enough — work.read.all or work.write opened every organisation's
    // documents, not just the caller's own.
    const mine = found.ownerId === actor.id;
    const canReview =
      (roleHasPermission(actor.role, "work.read.all") || roleHasPermission(actor.role, "work.write")) &&
      sameOrg(actor, found);

    if (!mine && !canReview) {
      auditService.record({
        actorId: actor.id,
        action: "authz.document.denied",
        metadata: { documentId: id },
      });
      // Same answer as "does not exist" — confirming a document id is real
      // tells somebody probing that a customer with that document exists.
      throw new AppError("That document does not exist.", 404);
    }

    const events = await prisma.documentEvent.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return { document, events };
  },

  /**
   * The verification queue an employee works.
   *
   * Oldest first, because a document waiting three days matters more than one
   * that arrived a minute ago, and a queue sorted newest-first quietly starves
   * the bottom of itself.
   */
  async queue(actor: { role: string; organizationId: string | null }, query: { take?: unknown }) {
    if (!roleHasPermission(actor.role, "work.read.all") && !roleHasPermission(actor.role, "work.write")) {
      throw new AppError("You do not have permission to review documents.", 403);
    }

    // Exclusively a cross-customer view — there is no "my own" fallback here
    // the way list() has, so an employee with no resolved organisation gets an
    // empty queue rather than every organisation's. Passing organizationId:
    // null straight into the query would have done the opposite of that: it
    // would match every legacy document that predates this column, handing an
    // organisation-less employee *more* than a properly scoped one ever sees.
    if (!actor.organizationId) return { documents: [], waiting: 0 };
    const where = {
      deletedAt: null,
      status: "PENDING_REVIEW",
      organizationId: actor.organizationId,
    };

    const [documents, waiting] = await Promise.all([
      prisma.uploadedDocument.findMany({
        where,
        select: { ...DOCUMENT_SELECT, owner: { select: { id: true, name: true, email: true } } },
        orderBy: { uploadedAt: "asc" },
        take: clampTake(query.take, 50),
      }),
      prisma.uploadedDocument.count({ where }),
    ]);

    return { documents, waiting };
  },

  /** Soft delete. The owner, or somebody who can write work. */
  async remove(actor: { id: string; role: string; organizationId: string | null }, id: string) {
    const document = await prisma.uploadedDocument.findFirst({ where: { id, deletedAt: null } });
    if (!document) throw new AppError("That document does not exist.", 404);

    const mine = document.ownerId === actor.id;
    const staffCanRemove = roleHasPermission(actor.role, "work.write") && sameOrg(actor, document);
    if (!mine && !staffCanRemove) {
      throw new AppError("That document does not exist.", 404);
    }

    // Soft, not hard. A verified document is evidence in a claim, and a
    // customer clicking delete must not remove the record that a decision was
    // made on it.
    await prisma.uploadedDocument.update({ where: { id }, data: { deletedAt: new Date() } });
    record({
      documentId: id,
      stage: "DELETED",
      actorKind: mine ? "SYSTEM" : "EMPLOYEE",
      actorId: actor.id,
      summary: "Removed from the customer's document list.",
    });
    auditService.record({
      actorId: actor.id,
      action: "document.deleted",
      entity: "UploadedDocument",
      entityId: id,
    });

    return { deleted: true };
  },

  // ── Requirements ───────────────────────────────────────────────────────────

  /**
   * Ask a customer for the documents a situation needs.
   *
   * Upserted by (subject, work item, key), so re-running the resolver after a
   * fact changes updates the set rather than duplicating it — an agent
   * discovering mid-conversation that a vehicle is commercial should add the
   * address proof, not produce a second copy of everything.
   */
  async requestDocuments(
    subjectId: string,
    context: RequirementContext & { workItemId?: string | null },
    requestedBy: string
  ) {
    if (!isDomain(context.domain)) throw new AppError("Unknown insurance domain.", 400);

    const verified = await prisma.uploadedDocument.findMany({
      where: { ownerId: subjectId, status: "VERIFIED", deletedAt: null },
      select: { documentKey: true },
    });

    const requirements = resolveRequirements({
      ...context,
      alreadyHeld: [
        ...(context.alreadyHeld ?? []),
        ...verified.map((v) => v.documentKey).filter((k): k is string => Boolean(k)),
      ],
    });

    // "" is the no-work-item sentinel — see the schema comment on the
    // unique constraint for why this is not null.
    const workItemId = context.workItemId ?? "";
    for (const requirement of requirements) {
      await prisma.documentRequest.upsert({
        where: {
          subjectId_workItemId_documentKey: {
            subjectId,
            workItemId,
            documentKey: requirement.spec.key,
          },
        },
        create: {
          subjectId,
          workItemId,
          domain: context.domain,
          documentKey: requirement.spec.key,
          label: requirement.spec.label,
          description: requirement.spec.reason,
          required: requirement.required,
          reason: requirement.reason,
          requestedBy,
        },
        update: { required: requirement.required, reason: requirement.reason },
      });
    }

    auditService.record({
      actorId: requestedBy,
      action: "document.requested",
      entity: "User",
      entityId: subjectId,
      metadata: { domain: context.domain, count: requirements.length },
    });

    // Only when something was actually asked for. A resolve that produced no
    // new requirements must not tell the customer we need documents.
    if (requirements.length > 0) {
      emit({
        name: "document.requested",
        actorId: requestedBy ?? null,
        actorKind: requestedBy ? "USER" : "AI",
        subjectKind: "documentRequest",
        subjectId,
        payload: { subjectId, count: requirements.length, domain: context.domain },
      });
    }

    return this.requirementsFor(subjectId, workItemId || null);
  },

  /** What a customer still owes, with the catalogue detail the UI renders from. */
  async requirementsFor(subjectId: string, workItemId: string | null = null) {
    const requests = await prisma.documentRequest.findMany({
      where: { subjectId, ...(workItemId ? { workItemId } : {}) },
      orderBy: [{ required: "desc" }, { createdAt: "asc" }],
      take: MAX_PAGE,
    });

    return {
      requests: requests.map((request) => ({
        id: request.id,
        documentKey: request.documentKey,
        label: request.label,
        description: request.description,
        reason: request.reason,
        required: request.required,
        status: request.status,
        domain: request.domain,
        // The accepted formats travel with the request, so an upload card
        // offers the right picker without the client holding its own catalogue.
        accepts: DOCUMENT_CATALOGUE[request.documentKey]?.accepts ?? [],
        multiple: DOCUMENT_CATALOGUE[request.documentKey]?.multiple ?? false,
        category: DOCUMENT_CATALOGUE[request.documentKey]?.category ?? "other",
      })),
      completeness: completeness(requests),
    };
  },

  /** Platform-wide document figures, for the admin and operator consoles. */
  async statistics() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const [byStatus, byDomain, total, thisWeek, sized, pendingOldest] = await Promise.all([
      prisma.uploadedDocument.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.uploadedDocument.groupBy({ by: ["domain"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.uploadedDocument.count({ where: { deletedAt: null } }),
      prisma.uploadedDocument.count({ where: { deletedAt: null, uploadedAt: { gte: weekAgo } } }),
      prisma.uploadedDocument.aggregate({ where: { deletedAt: null }, _sum: { sizeBytes: true } }),
      prisma.uploadedDocument.findFirst({
        where: { deletedAt: null, status: "PENDING_REVIEW" },
        orderBy: { uploadedAt: "asc" },
        select: { uploadedAt: true },
      }),
    ]);

    return {
      total,
      thisWeek,
      storageBytes: sized._sum.sizeBytes ?? 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byDomain: Object.fromEntries(byDomain.map((d) => [d.domain ?? "unclassified", d._count._all])),
      oldestPendingAt: pendingOldest?.uploadedAt ?? null,
      // Named rather than computed, because average processing time needs the
      // pipeline to have actually run and it currently reports itself simulated.
      processingTime: {
        available: false as const,
        reason: "The pipeline stages are simulated, so no real processing time exists to average.",
        needs: "A configured OCR, extraction and fraud service.",
      },
    };
  },
};
