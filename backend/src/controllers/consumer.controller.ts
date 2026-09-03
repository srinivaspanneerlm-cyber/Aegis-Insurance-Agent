import type { Request } from "express";
import { createReadStream } from "fs";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { formatBytes } from "../utils/formatBytes";
import { CONSUMER } from "../config/constants";
import { CONSUMER_FORMATS_LABEL } from "../consumer/documents";
import { consumerPolicyService } from "../services/consumerPolicy.service";
import { consumerDocumentService } from "../services/consumerDocument.service";
import { renewalLeadService } from "../services/renewalLead.service";
import { kuralService } from "../services/kural.service";

/**
 * The Aegis Consumer policy flow, over HTTP.
 *
 * Thin, as the charter asks. The one thing worth reading here is `actor`: it is
 * built from `req.user` and nothing else, so no handler below can be given a
 * different customer's id even by accident. There is no `userId` parameter to
 * pass, and the service takes none.
 */

const actor = (req: Request) => ({
  id: req.user!.id,
  preferredLanguage: req.user!.preferredLanguage ?? null,
});

const locale = (req: Request): string | undefined =>
  typeof req.query.locale === "string" ? req.query.locale : undefined;

const param = (req: Request, key: string): string =>
  typeof req.params[key] === "string" ? (req.params[key] as string) : "";

// ── Vehicles ─────────────────────────────────────────────────────────────────

export const listVehicles = catchAsync(async (req, res) => {
  const vehicles = await consumerPolicyService.listVehicles(actor(req));
  sendSuccess(res, 200, { vehicles }, { results: vehicles.length });
});

export const createVehicle = catchAsync(async (req, res) => {
  const vehicle = await consumerPolicyService.upsertVehicle(actor(req), req.body);
  sendSuccess(res, 201, { vehicle });
});

export const updateVehicle = catchAsync(async (req, res) => {
  const vehicle = await consumerPolicyService.updateVehicle(
    actor(req),
    param(req, "id"),
    req.body
  );
  sendSuccess(res, 200, { vehicle });
});

// ── Policies ─────────────────────────────────────────────────────────────────

export const listPolicies = catchAsync(async (req, res) => {
  const result = await consumerPolicyService.list(actor(req), { locale: locale(req) });
  sendSuccess(res, 200, result, { results: result.policies.length });
});

export const getPolicy = catchAsync(async (req, res) => {
  const result = await consumerPolicyService.getById(actor(req), param(req, "id"), {
    locale: locale(req),
  });
  sendSuccess(res, 200, result);
});

export const createPolicy = catchAsync(async (req, res) => {
  const result = await consumerPolicyService.create(actor(req), req.body, {
    locale: locale(req),
  });
  sendSuccess(res, 201, result);
});

export const updatePolicy = catchAsync(async (req, res) => {
  const result = await consumerPolicyService.update(actor(req), param(req, "id"), req.body, {
    locale: locale(req),
  });
  sendSuccess(res, 200, result);
});

export const deletePolicy = catchAsync(async (req, res) => {
  const result = await consumerPolicyService.remove(actor(req), param(req, "id"));
  sendSuccess(res, 200, result);
});

// ── Documents ────────────────────────────────────────────────────────────────

export const attachDocument = catchAsync(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError(
      `Please choose your certificate to upload — ${CONSUMER_FORMATS_LABEL}, up to ${formatBytes(CONSUMER.DOCUMENT_MAX_BYTES)}.`,
      400,
      "VALIDATION_ERROR"
    );
  }

  const result = await consumerDocumentService.attach(actor(req), param(req, "id"), file, {
    locale: locale(req),
  });
  sendSuccess(res, 201, result);
});

export const listDocuments = catchAsync(async (req, res) => {
  const policyId = typeof req.query.policyId === "string" ? req.query.policyId : undefined;
  const result = await consumerDocumentService.list(actor(req), {
    ...(policyId ? { policyId } : {}),
  });
  sendSuccess(res, 200, result, { results: result.documents.length });
});

export const getDocument = catchAsync(async (req, res) => {
  const document = await consumerDocumentService.getById(actor(req), param(req, "id"));
  sendSuccess(res, 200, { document });
});

/**
 * Stream the file itself, for a preview.
 *
 * The only response in this controller that is not `sendSuccess`, because it is
 * not JSON. Four headers do the security work:
 *
 *   • `Content-Type` is the canonical type for the format we detected when the
 *     file was stored — never the one the browser declared, which is what makes
 *     it safe to render inline at all.
 *   • `nosniff` stops a browser deciding for itself that a PDF is something more
 *     interesting.
 *   • `inline` with an encoded filename, so a preview opens in place and a
 *     filename containing a quote or a newline cannot break the header.
 *   • `private, no-store`, because this is one person's insurance certificate
 *     and it has no business in a shared cache.
 */
export const previewDocument = catchAsync(async (req, res) => {
  const { filepath, filename, mimeType, sizeBytes } = await consumerDocumentService.fileFor(
    actor(req),
    param(req, "id")
  );

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", String(sizeBytes));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
  );

  createReadStream(filepath).pipe(res);
});

// ── Renewal help and consent ─────────────────────────────────────────────────

/**
 * The circumstances a consent was given in.
 *
 * Recorded because a consent is a claim about somebody's action, and the
 * circumstances of that action are part of the proof. Read from the request
 * rather than from the body, so a client cannot state where it was.
 */
const consentContext = (req: Request) => ({
  ipAddress: req.ip ?? null,
  userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
});

export const requestRenewalHelp = catchAsync(async (req, res) => {
  const result = await renewalLeadService.requestHelp(
    actor(req),
    param(req, "id"),
    {
      preferredChannel: req.body.preferredChannel,
      contactPhone: req.body.contactPhone ?? null,
      alsoRemind: req.body.alsoRemind === true,
    },
    { ...(locale(req) ? { locale: locale(req) as string } : {}), context: consentContext(req) }
  );
  // An existing open request is answered 200 rather than 201: nothing was
  // created, and a client that counts creations should not be told otherwise.
  sendSuccess(res, result.alreadyOpen ? 200 : 201, result);
});

export const listRenewalRequests = catchAsync(async (req, res) => {
  const result = await renewalLeadService.myRequests(actor(req));
  sendSuccess(res, 200, result, { results: result.requests.length });
});

export const listConsents = catchAsync(async (req, res) => {
  const result = await renewalLeadService.listConsents(actor(req));
  sendSuccess(res, 200, result, { results: result.consents.length });
});

export const grantConsent = catchAsync(async (req, res) => {
  const consent = await renewalLeadService.grantConsent(
    actor(req),
    {
      channel: req.body.channel,
      purpose: req.body.purpose,
      policyId: req.body.policyId ?? null,
    },
    consentContext(req)
  );
  sendSuccess(res, 201, { consent });
});

export const withdrawConsent = catchAsync(async (req, res) => {
  const result = await renewalLeadService.withdrawConsent(
    actor(req),
    param(req, "id"),
    locale(req)
  );
  sendSuccess(res, 200, result);
});

// ── Aegis Kural Lite ─────────────────────────────────────────────────────────

export const kuralTopics = catchAsync(async (req, res) => {
  sendSuccess(res, 200, kuralService.topics(actor(req), { locale: locale(req) }));
});

export const kuralAsk = catchAsync(async (req, res) => {
  const answer = await kuralService.ask(
    actor(req),
    { question: req.body.question, policyId: req.body.policyId ?? null },
    { locale: locale(req) }
  );
  // Always 200. "I do not know that one" is an answer, not a client error, and
  // a 4xx would make a browser's error handling swallow the sentence that says
  // what to do next.
  sendSuccess(res, 200, answer);
});
