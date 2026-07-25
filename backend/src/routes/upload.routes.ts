import express from "express";
import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";
import * as uploadController from "../controllers/upload.controller";
import { protect } from "../middleware/auth.middleware";
import { validateQuery } from "../middleware/validate.middleware";
import { paginationQuerySchema } from "../validations/schemas";
import { UPLOADS } from "../config/constants";
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

// First gate: allow only known extensions + declared MIME types. The declared
// MIME is client-supplied and spoofable, so this is not the real content check —
// uploadService then calls scanFile(), which verifies the file's actual magic
// bytes and rejects a disguised file (e.g. evil.exe renamed to evil.pdf).
// `application/octet-stream` is tolerated because some browsers send it for
// .docx, but only when the extension is already on the allowlist.
const ALLOWED_EXTS = [".pdf", ".docx"];
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  if (ALLOWED_EXTS.includes(ext) && ALLOWED_MIMES.has(mime)) {
    cb(null, true);
  } else {
    cb(new AppError("Only genuine PDF and DOCX files are permitted for upload.", 400));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: UPLOADS.MAX_BYTES, // per-file size cap
    files: UPLOADS.MAX_FILES, // never accept more than one file per request
  },
});

router.post("/", protect, upload.single("file"), uploadController.uploadDocument);
router.get("/", protect, validateQuery(paginationQuerySchema), uploadController.getUploadedDocuments);

export = router;
