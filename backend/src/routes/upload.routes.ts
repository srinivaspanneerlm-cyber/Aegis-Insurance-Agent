import express from "express";
import multer, { MulterError, type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import type { NextFunction, Request, Response } from "express";
import * as uploadController from "../controllers/upload.controller";
import { protect } from "../middleware/auth.middleware";
import { validateQuery } from "../middleware/validate.middleware";
import { paginationQuerySchema } from "../validations/schemas";
import { UPLOADS } from "../config/constants";
import { ALLOWED_EXTENSIONS, ALLOWED_MIMES, extensionOf } from "../utils/fileTypes";
import { auditService } from "../services/audit.service";
import { formatBytes } from "../utils/formatBytes";
import AppError from "../utils/appError";

const router = express.Router();

// Auto-manage upload directory
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// First gate: allow only known extensions + declared MIME types. Both are
// client-supplied and spoofable, so this is not the real content check —
// uploadService then calls scanFile(), which verifies the file's actual magic
// bytes and that they agree with its extension. The catalogue of formats lives
// in utils/fileTypes so this filter and the scanner cannot drift apart.
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  const ext = extensionOf(file.originalname);
  const mime = (file.mimetype || "").toLowerCase();

  if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIMES.has(mime)) {
    cb(null, true);
    return;
  }

  auditService.record({
    actorId: req.user?.id ?? null,
    action: "document.rejected",
    metadata: { reason: "declared type not permitted", filename: file.originalname, mimeType: mime },
  });
  cb(new AppError(`"${file.originalname}" is not a file type Aegis accepts.`, 400, "VALIDATION_ERROR"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: UPLOADS.MAX_BYTES, // per-file size cap
    files: UPLOADS.MAX_FILES,
  },
});

/**
 * `file` is the long-standing single-file field; `files` accepts a batch. Both
 * are read so an existing client keeps working unchanged while a newer one can
 * send a whole set of documents in one request.
 */
const acceptUploads = upload.fields([
  { name: "file", maxCount: UPLOADS.MAX_FILES },
  { name: "files", maxCount: UPLOADS.MAX_FILES },
]);

/**
 * Multer signals a breached limit by throwing, not by calling next(AppError),
 * so without this the customer gets a generic 500 for something as ordinary as
 * a photo that is slightly too large. Each case is turned into an operational
 * error that says what to do, and recorded — a spike of oversize rejections is
 * worth seeing.
 */
const handleUploadErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  acceptUploads(req, res, (err: unknown) => {
    if (!(err instanceof MulterError)) return next(err);

    const [message, reason] =
      err.code === "LIMIT_FILE_SIZE"
        ? [`That file is too large. The limit is ${formatBytes(UPLOADS.MAX_BYTES)}.`, "file too large"]
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? [`Please send at most ${UPLOADS.MAX_FILES} files at a time.`, "too many files"]
          : ["That upload could not be accepted.", err.code];

    auditService.record({
      actorId: req.user?.id ?? null,
      action: "document.rejected",
      metadata: { reason, limitBytes: UPLOADS.MAX_BYTES, maxFiles: UPLOADS.MAX_FILES },
    });
    next(new AppError(message, 400, "VALIDATION_ERROR"));
  });
};

router.post("/", protect, handleUploadErrors, uploadController.uploadDocument);
router.get("/", protect, validateQuery(paginationQuerySchema), uploadController.getUploadedDocuments);

export = router;
