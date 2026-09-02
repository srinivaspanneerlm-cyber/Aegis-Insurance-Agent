/**
 * A customer's own policy documents.
 *
 * Built on the platform's upload pipeline rather than beside it: the magic-byte
 * scanner (`utils/fileScan`), the format catalogue (`utils/fileTypes`), the
 * `UploadedDocument` table and the audit trail are all the existing ones. What
 * this file adds is the part that is specific to a customer attaching their own
 * certificate to their own policy — a narrower format list, a smaller size cap,
 * the link to a `HeldPolicy`, and the trust gate.
 *
 * It is not routed through `uploadService.create` for two reasons that matter.
 * That service accepts every format the platform accepts, including video and
 * DOCX, and it answers a duplicate with a flat 409 — which here would mean a
 * customer who legitimately holds one certificate covering two vehicles is
 * simply refused, with nothing to do about it. Both differences are product
 * decisions about this flow, so they live in this flow.
 *
 * Scope works exactly as it does in `consumerPolicy.service`: no method takes a
 * user id, every query is built from the verified session, and somebody else's
 * document reads as absent rather than as forbidden.
 */
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import type { UploadedDocument } from "@prisma/client";
import prisma from "../config/db";
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import { scanFile } from "../utils/fileScan";
import { formatBytes } from "../utils/formatBytes";
import { CONSUMER } from "../config/constants";
import { isInsideUploadDir } from "../config/uploadDir";
import {
  CONSUMER_DOCUMENT_CATEGORY,
  CONSUMER_DOCUMENT_DOMAIN,
  CONSUMER_DOCUMENT_KEY,
  CONSUMER_FORMATS,
  CONSUMER_FORMATS_LABEL,
  isConsumerFormat,
} from "../consumer/documents";
import { consumerPolicyService, type ConsumerActor } from "./consumerPolicy.service";

/** What multer hands over, and the only shape this service needs from it. */
export interface IncomingFile {
  readonly originalname: string;
  readonly path: string;
  readonly mimetype?: string;
  readonly size?: number;
}

/**
 * The canonical MIME type for a format we actually detected.
 *
 * Never the type the browser declared. That value is client-controlled, it is
 * stored, and it is later written into a `Content-Type` header — so echoing it
 * back would let somebody serve `text/html` from this origin by lying about a
 * PNG. Deriving it from the detected format closes that: the header can only
 * ever be one of three inert types.
 */
export function canonicalMimeFor(formatId: string): string {
  const format = CONSUMER_FORMATS.find((f) => f.id === formatId);
  return format?.mimes[0] ?? "application/octet-stream";
}

// ── What a caller sees ───────────────────────────────────────────────────────

export interface DocumentView {
  id: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  /** Which policy it is attached to, when it is attached to one. */
  policyId: string | null;
  /**
   * First eight characters of the SHA-256. Enough for a customer or an operator
   * to see that two rows are the same file; not the whole digest, which is a
   * lookup key into every upload on the platform.
   */
  fingerprint: string | null;
}

const toView = (document: UploadedDocument, policyId: string | null): DocumentView => ({
  id: document.id,
  filename: document.filename,
  mimeType: document.mimeType,
  sizeBytes: document.sizeBytes,
  uploadedAt: document.uploadedAt.toISOString(),
  policyId,
  fingerprint: document.contentHash ? document.contentHash.slice(0, 8) : null,
});

/** Drop a rejected upload from disk. Failure to unlink must not mask the reason. */
const discard = (filepath: string) => fs.unlink(filepath).catch(() => {});

export const consumerDocumentService = {
  /**
   * Attach a certificate to one of the customer's policies.
   *
   * The order of the checks is deliberate: the policy is resolved first, so a
   * file uploaded against somebody else's policy is deleted from disk and
   * nothing about it is recorded beyond the refusal. Only then are the bytes
   * read, hashed and stored.
   */
  async attach(
    actor: ConsumerActor,
    policyId: string,
    file: IncomingFile,
    options: { locale?: string } = {}
  ) {
    // 1. Is this policy theirs? Absent, not forbidden — see the service docblock.
    const policy = await prisma.heldPolicy.findFirst({
      where: { id: policyId, profile: { userId: actor.id }, domain: "motor", deletedAt: null },
      select: { id: true },
    });
    if (!policy) {
      await discard(file.path);
      throw new AppError("That policy does not exist.", 404, "NOT_FOUND");
    }

    // 2. What is actually in the file. The declared type never decides this.
    const scan = await scanFile(file.path, file.originalname);
    if (!scan.clean || !isConsumerFormat(scan.format)) {
      await discard(file.path);
      auditService.record({
        actorId: actor.id,
        action: "document.rejected",
        metadata: {
          reason: scan.clean ? "format not accepted in the consumer flow" : (scan.reason ?? "scan"),
          declaredMimeType: file.mimetype ?? null,
          detectedFormat: scan.format ?? null,
          sizeBytes: file.size ?? null,
        },
      });
      throw new AppError(
        // Says what to send, not what was wrong with what they sent. Somebody
        // whose phone saved a HEIC has done nothing incorrect and can act on
        // "send a PDF, JPG or PNG" in a way they cannot act on "scan failed".
        `Please send your certificate as ${CONSUMER_FORMATS_LABEL}. Up to ${formatBytes(CONSUMER.DOCUMENT_MAX_BYTES)}.`,
        400,
        "VALIDATION_ERROR"
      );
    }

    // 3. The content hash, which is what makes "the same file" a fact.
    const contentHash = crypto
      .createHash("sha256")
      .update(await fs.readFile(file.path))
      .digest("hex");

    const existing = await prisma.uploadedDocument.findFirst({
      where: { ownerId: actor.id, contentHash, deletedAt: null },
      orderBy: { uploadedAt: "asc" },
    });

    let document: UploadedDocument;

    if (existing) {
      // The same bytes are already stored for this customer. Two cases, and
      // neither is an error worth stopping on:
      //
      //   • the same policy — they uploaded it twice, which is what happens when
      //     a page is refreshed or a tap is repeated on a slow connection;
      //   • a different policy — one certificate can legitimately cover two
      //     vehicles, and even when it cannot, the answer is a question rather
      //     than a refusal.
      //
      // Either way the second copy is not kept on disk: the row is reused. What
      // changes is the trust state, which the gate works out below.
      await discard(file.path);
      document = existing;
    } else {
      document = await prisma.uploadedDocument.create({
        data: {
          filename: file.originalname,
          filepath: file.path,
          ownerId: actor.id,
          // Canonical, not declared — see `canonicalMimeFor`.
          mimeType: canonicalMimeFor(scan.format as string),
          sizeBytes: file.size ?? null,
          contentHash,
          category: CONSUMER_DOCUMENT_CATEGORY,
          documentKey: CONSUMER_DOCUMENT_KEY,
          domain: CONSUMER_DOCUMENT_DOMAIN,
          // The platform's pipeline stage. It stays UPLOADED: no OCR, metadata
          // or fraud stage runs here, and claiming otherwise would put a state
          // on the row that nothing produced.
          status: "UPLOADED",
        },
      });
    }

    await prisma.heldPolicy.update({
      where: { id: policyId },
      data: { documentId: document.id },
    });

    auditService.record({
      actorId: actor.id,
      action: "consumer.document.attached",
      entity: "UploadedDocument",
      entityId: document.id,
      // No filename and no hash. The trail records that a document was attached
      // to a policy, not what the customer's paperwork is called.
      metadata: {
        policyId,
        detectedFormat: scan.format ?? null,
        sizeBytes: file.size ?? null,
        reusedExisting: Boolean(existing),
      },
    });

    // The trust gate re-runs against the whole record, not just this upload.
    return consumerPolicyService.getById(actor, policyId, { locale: options.locale });
  },

  /**
   * Every document this customer has in the consumer flow.
   *
   * Scoped by owner in the `where`, never filtered afterwards. `policyId` is
   * resolved from the policies rather than stored on the document, because
   * `HeldPolicy.documentId` is the only link and one document may sit on more
   * than one policy.
   */
  async list(actor: ConsumerActor, options: { policyId?: string } = {}) {
    const policies = await prisma.heldPolicy.findMany({
      where: { profile: { userId: actor.id }, domain: "motor", deletedAt: null },
      select: { id: true, documentId: true },
    });

    const policyByDocument = new Map<string, string>();
    for (const policy of policies) {
      if (policy.documentId) policyByDocument.set(policy.documentId, policy.id);
    }

    const documents = await prisma.uploadedDocument.findMany({
      where: {
        ownerId: actor.id,
        documentKey: CONSUMER_DOCUMENT_KEY,
        deletedAt: null,
        ...(options.policyId
          ? {
              id: {
                in: policies
                  .filter((p) => p.id === options.policyId && p.documentId)
                  .map((p) => p.documentId as string),
              },
            }
          : {}),
      },
      orderBy: { uploadedAt: "desc" },
    });

    return {
      documents: documents.map((d) => toView(d, policyByDocument.get(d.id) ?? null)),
    };
  },

  /** One document's metadata, scoped to its owner. */
  async getById(actor: ConsumerActor, documentId: string): Promise<DocumentView> {
    const document = await this.findOwned(actor, documentId);
    const policy = await prisma.heldPolicy.findFirst({
      where: { documentId, profile: { userId: actor.id }, deletedAt: null },
      select: { id: true },
    });
    return toView(document, policy?.id ?? null);
  },

  /**
   * The bytes, for a preview.
   *
   * Returns what the route needs to stream and nothing else. Two guards sit
   * here rather than in the route, so a second caller cannot be written without
   * them: the row must belong to the caller, and the path must resolve inside
   * the upload directory — see `isInsideUploadDir` for why a column is not
   * trusted even though we wrote it.
   */
  async fileFor(
    actor: ConsumerActor,
    documentId: string
  ): Promise<{ filepath: string; filename: string; mimeType: string; sizeBytes: number }> {
    const document = await this.findOwned(actor, documentId);

    if (!document.filepath || !isInsideUploadDir(document.filepath)) {
      throw new AppError("That document is not available right now.", 404, "NOT_FOUND");
    }

    const stat = await fs.stat(document.filepath).catch(() => null);
    if (!stat?.isFile()) {
      // The row survived and the file did not — a restarted container with no
      // shared volume, most often. Said as unavailable rather than as an error,
      // because there is nothing the customer did wrong and nothing to retry.
      throw new AppError("That document is not available right now.", 404, "NOT_FOUND");
    }

    return {
      filepath: document.filepath,
      filename: path.basename(document.filename) || "document",
      // Stored canonical at write time; defaulted here so an older row without
      // one cannot put an empty Content-Type on the wire.
      mimeType: document.mimeType ?? "application/octet-stream",
      sizeBytes: stat.size,
    };
  },

  /** A document that is not the caller's reads as absent. */
  async findOwned(actor: ConsumerActor, documentId: string): Promise<UploadedDocument> {
    const document = await prisma.uploadedDocument.findFirst({
      where: { id: documentId, ownerId: actor.id, deletedAt: null },
    });
    if (!document) throw new AppError("That document does not exist.", 404, "NOT_FOUND");
    return document;
  },
};
