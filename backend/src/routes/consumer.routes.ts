import express from "express";
import path from "path";
import multer, { MulterError, type FileFilterCallback } from "multer";
import type { NextFunction, Request, Response } from "express";
import * as consumerController from "../controllers/consumer.controller";
import { protect } from "../middleware/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import { idParamSchema } from "../validations/schemas";
import {
  consentCreateSchema,
  consumerDocumentQuerySchema,
  consumerLocaleQuerySchema,
  kuralAskSchema,
  renewalRequestSchema,
  consumerPolicyCreateSchema,
  consumerPolicyUpdateSchema,
  vehicleCreateSchema,
  vehicleUpdateSchema,
} from "../validations/consumer.schemas";
import { CONSUMER } from "../config/constants";
import { ensureUploadDir } from "../config/uploadDir";
import { CONSUMER_FORMATS_LABEL, looksAcceptable } from "../consumer/documents";
import { auditService } from "../services/audit.service";
import { formatBytes } from "../utils/formatBytes";
import AppError from "../utils/appError";

const router = express.Router();

/**
 * Aegis Consumer — a customer's own vehicles and motor policies.
 *
 * Scope-walled rather than realm- or permission-walled, and more narrowly than
 * either. The document and intelligence platforms let staff reach a customer's
 * records because advising somebody requires seeing their file; nothing in this
 * flow does. Every route here serves the caller and only the caller, which is
 * why none of them carries a permission check: there is no wider access to
 * grant, and adding a capability would imply there was.
 *
 * No `userId` is accepted anywhere below — not in a body, a param or a query.
 * The service takes none either, so a route added here later cannot acquire one
 * without that being a visible change to both files.
 */
router.use(protect);

// ── Vehicles ─────────────────────────────────────────────────────────────────

router.get("/vehicles", consumerController.listVehicles);
router.post("/vehicles", validateBody(vehicleCreateSchema), consumerController.createVehicle);
router.patch(
  "/vehicles/:id",
  validateParams(idParamSchema),
  validateBody(vehicleUpdateSchema),
  consumerController.updateVehicle
);

// ── Policies ─────────────────────────────────────────────────────────────────

router.get(
  "/policies",
  validateQuery(consumerLocaleQuerySchema),
  consumerController.listPolicies
);
router.post(
  "/policies",
  validateBody(consumerPolicyCreateSchema),
  consumerController.createPolicy
);
router.get(
  "/policies/:id",
  validateParams(idParamSchema),
  validateQuery(consumerLocaleQuerySchema),
  consumerController.getPolicy
);
router.patch(
  "/policies/:id",
  validateParams(idParamSchema),
  validateBody(consumerPolicyUpdateSchema),
  consumerController.updatePolicy
);

/**
 * Remove a policy. Soft — see the service.
 *
 * Deliberately without `requireFreshAuth`, unlike deleting a lead. Nothing is
 * destroyed here: the row survives, the audit trail survives, and the customer
 * can add the policy again in a minute. Asking somebody to re-enter their
 * password to tidy up their own list would be friction with nothing behind it,
 * on a screen built for people who find passwords hard.
 */
router.delete("/policies/:id", validateParams(idParamSchema), consumerController.deletePolicy);

// ── Documents ────────────────────────────────────────────────────────────────

/**
 * One certificate, into the platform's own upload directory.
 *
 * Multer is configured here rather than shared with `upload.routes.ts` because
 * the two gates are deliberately different: that one accepts eight formats and
 * fifty megabytes for claim evidence and walkaround video, and this one accepts
 * three formats and ten. The *storage* is shared — same directory, via
 * `config/uploadDir` — so there is one place files live and one place to change
 * when that becomes an object store.
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
    // Never the customer's own filename on disk. It is stored in the row and
    // shown back to them, but a name that arrived from a browser is not
    // something to hand to the filesystem — the extension is taken from it and
    // nothing else. The original is preserved on the record.
    filename: (_req, file, cb) =>
      cb(
        null,
        `consumer-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`
      ),
  }),
  limits: {
    fileSize: CONSUMER.DOCUMENT_MAX_BYTES,
    // One certificate per request. This flow has no batch case, and a limit of
    // one is a smaller surface than a limit the service would have to enforce.
    files: 1,
  },
  /**
   * The first gate, on the declared name and type — both client-supplied and
   * both spoofable, which is why the real check is the magic-byte scan in
   * `consumerDocument.service`. This one exists so an obviously wrong file is
   * refused before it is written to disk at all.
   */
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (looksAcceptable(file.originalname, file.mimetype)) {
      cb(null, true);
      return;
    }
    auditService.record({
      actorId: req.user?.id ?? null,
      action: "document.rejected",
      metadata: { reason: "declared type not permitted", mimeType: file.mimetype ?? null },
    });
    cb(new AppError(`Please send your certificate as ${CONSUMER_FORMATS_LABEL}.`, 400, "VALIDATION_ERROR"));
  },
}).single("file");

/**
 * Multer signals a breached limit by throwing rather than by calling
 * `next(AppError)`, so without this a file a little over the limit becomes a
 * 500. Each case is turned into a sentence that says what to do instead.
 */
const acceptDocument = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: unknown) => {
    if (!(err instanceof MulterError)) return next(err);

    const [message, reason] =
      err.code === "LIMIT_FILE_SIZE"
        ? [
            `That file is too large. Please send one up to ${formatBytes(CONSUMER.DOCUMENT_MAX_BYTES)}.`,
            "file too large",
          ]
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? ["Please send one certificate at a time.", "too many files"]
          : ["That upload could not be accepted.", err.code];

    auditService.record({
      actorId: req.user?.id ?? null,
      action: "document.rejected",
      metadata: { reason, limitBytes: CONSUMER.DOCUMENT_MAX_BYTES },
    });
    next(new AppError(message, 400, "VALIDATION_ERROR"));
  });
};

router.post(
  "/policies/:id/document",
  validateParams(idParamSchema),
  validateQuery(consumerLocaleQuerySchema),
  acceptDocument,
  consumerController.attachDocument
);

router.get(
  "/documents",
  validateQuery(consumerDocumentQuerySchema),
  consumerController.listDocuments
);
router.get("/documents/:id", validateParams(idParamSchema), consumerController.getDocument);

/**
 * The file itself, for a preview.
 *
 * Deliberately not a static mount over the upload directory. Serving that
 * folder would make every customer's certificate reachable by anyone who could
 * guess a filename; this route answers only for a document row that belongs to
 * the caller.
 */
router.get("/documents/:id/file", validateParams(idParamSchema), consumerController.previewDocument);

// ── Help me renew ────────────────────────────────────────────────────────────

/**
 * Ask a person for help renewing one policy.
 *
 * Creates the consent and the request together — the service refuses to make
 * one without the other, because a queue row with no consent behind it is a
 * phone number somebody will ring without being able to say why they were
 * allowed to.
 *
 * Nothing is sent by this route. No email, no SMS, and no WhatsApp message: the
 * request lands in a queue that a person reads. That is the whole delivery
 * mechanism in this milestone and the copy on the consent screen says so.
 */
router.post(
  "/policies/:id/renewal-request",
  validateParams(idParamSchema),
  validateQuery(consumerLocaleQuerySchema),
  validateBody(renewalRequestSchema),
  consumerController.requestRenewalHelp
);

router.get("/renewal-requests", consumerController.listRenewalRequests);

// ── Consent ──────────────────────────────────────────────────────────────────

router.get("/consents", consumerController.listConsents);
router.post("/consents", validateBody(consentCreateSchema), consumerController.grantConsent);

/**
 * Withdraw one.
 *
 * `DELETE` in the HTTP sense only — nothing is destroyed. The row survives with
 * `withdrawnAt` set, because the question asked afterwards is not "do they
 * consent now" but "what did they agree to, when, and when did they stop".
 */
router.delete("/consents/:id", validateParams(idParamSchema), consumerController.withdrawConsent);

// ── Aegis Kural Lite ─────────────────────────────────────────────────────────

/**
 * The motor FAQ assistant, in text.
 *
 * Deliberately **not** behind `aiLimiter`, unlike `/chat`. That throttle exists
 * because a chat turn is a paid LLM call; this path matches a question against
 * six fixed answers in memory and calls nothing. Rate-limiting it as though it
 * cost money would be a claim about what it does, and the platform-wide
 * `apiLimiter` already bounds it. The question itself is bounded at 500
 * characters by the schema.
 *
 * It is also not the advisor. `/chat` is the full multi-agent conversation and
 * is untouched by this; this is a small, checked, text-only surface for six
 * questions, and the two are separate on purpose.
 */
router.get("/kural/topics", validateQuery(consumerLocaleQuerySchema), consumerController.kuralTopics);
router.post(
  "/kural/ask",
  validateQuery(consumerLocaleQuerySchema),
  validateBody(kuralAskSchema),
  consumerController.kuralAsk
);

export = router;
