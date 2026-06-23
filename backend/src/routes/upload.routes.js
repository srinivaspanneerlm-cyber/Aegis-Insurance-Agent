const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const uploadController = require("../controllers/upload.controller");
const { protect } = require("../middleware/auth.middleware");
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

const fileFilter = (req, file, cb) => {
  const allowedExts = [".pdf", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError("Only PDF and DOCX files are permitted for upload.", 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.post("/", protect, upload.single("file"), uploadController.uploadDocument);
router.get("/", protect, uploadController.getUploadedDocuments);

module.exports = router;
