const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const uploadController = require("../controllers/upload.controller");
const { protect } = require("../middleware/auth.middleware");
const { UPLOADS } = require("../config/constants");
const AppError = require("../utils/appError");

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

// Allowed uploads must match on BOTH the extension and the declared MIME type,
// so a renamed executable (evil.exe -> evil.pdf) is rejected on its content
// type. `application/octet-stream` is tolerated because some browsers send it
// for .docx, but only when the extension is already on the allowlist.
const ALLOWED_EXTS = [".pdf", ".docx"];
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  if (ALLOWED_EXTS.includes(ext) && ALLOWED_MIMES.has(mime)) {
    cb(null, true);
  } else {
    cb(new AppError("Only genuine PDF and DOCX files are permitted for upload.", 400), false);
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
router.get("/", protect, uploadController.getUploadedDocuments);

module.exports = router;
