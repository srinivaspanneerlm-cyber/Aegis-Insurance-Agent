const prisma = require("../config/db");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const uploadDocument = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Please attach a valid file payload.", 400));
  }

  // Save document details to database
  const doc = await prisma.uploadedDocument.create({
    data: {
      filename: req.file.originalname,
      filepath: req.file.path,
    },
  });

  res.status(201).json({
    status: "success",
    data: {
      document: doc,
    },
  });
});

const getUploadedDocuments = catchAsync(async (req, res, next) => {
  const docs = await prisma.uploadedDocument.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    status: "success",
    data: {
      documents: docs,
    },
  });
});

module.exports = {
  uploadDocument,
  getUploadedDocuments,
};
