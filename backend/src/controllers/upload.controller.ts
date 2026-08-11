import { uploadService } from "../services/upload.service";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";
import { sendSuccess } from "../utils/apiResponse";

/** Files arrive under `file` (one, the long-standing field) or `files` (a batch). */
const collectFiles = (req: { files?: unknown; file?: Express.Multer.File }): Express.Multer.File[] => {
  if (req.file) return [req.file];
  const fields = req.files as Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined;
  if (!fields) return [];
  if (Array.isArray(fields)) return fields;
  return [...(fields.file ?? []), ...(fields.files ?? [])];
};

interface RejectedFile {
  filename: string;
  reason: string;
}

/**
 * Persist one or more uploaded documents.
 *
 * A single-file request keeps its original contract exactly — 201 with
 * `document`, or the error that stopped it. A multi-file request cannot do the
 * same, because one bad file in five should not discard the other four: it
 * reports each outcome, and only fails outright when nothing survived.
 */
const uploadDocument = catchAsync(async (req, res, next) => {
  const files = collectFiles(req);
  if (files.length === 0) {
    return next(new AppError("Please attach a valid file payload.", 400));
  }

  const persist = (file: Express.Multer.File) =>
    uploadService.create({
      filename: file.originalname,
      filepath: file.path,
      ownerId: req.user?.id || null,
      mimeType: file.mimetype || null,
      sizeBytes: typeof file.size === "number" ? file.size : null,
      organizationId: req.user?.organizationId ?? null,
    });

  if (files.length === 1) {
    const document = await persist(files[0]);
    return sendSuccess(res, 201, { document, documents: [document] });
  }

  const documents = [];
  const rejected: RejectedFile[] = [];

  for (const file of files) {
    try {
      documents.push(await persist(file));
    } catch (err) {
      rejected.push({
        filename: file.originalname,
        reason: err instanceof AppError ? err.message : "That file could not be accepted.",
      });
    }
  }

  if (documents.length === 0) {
    return next(new AppError(rejected[0]?.reason ?? "None of those files could be accepted.", 400, "VALIDATION_ERROR"));
  }

  sendSuccess(res, 201, { document: documents[0], documents, rejected });
});

const getUploadedDocuments = catchAsync(async (req, res) => {
  const { page, limit } = parsePageParams(req.query);
  const { items, ...pagination } = await uploadService.list({
    role: req.user?.role,
    userId: req.user!.id,
    page,
    limit,
  });
  sendSuccess(res, 200, { documents: items }, { pagination });
});

export { uploadDocument, getUploadedDocuments };
