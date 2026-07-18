import { documentRepository } from "../repositories";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";

const uploadDocument = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Please attach a valid file payload.", 400));
  }

  // Attribute the document to its uploader (ownerId) plus content metadata.
  // Ownership is what lets reads be access-scoped below, closing the previous
  // "any authenticated user could list everyone's documents" IDOR.
  const doc = await documentRepository.create({
    filename: req.file.originalname,
    filepath: req.file.path,
    ownerId: req.user?.id || null,
    mimeType: req.file.mimetype || null,
    sizeBytes: typeof req.file.size === "number" ? req.file.size : null,
  });

  res.status(201).json({
    status: "success",
    data: {
      document: doc,
    },
  });
});

const getUploadedDocuments = catchAsync(async (req, res) => {
  const { page, limit } = parsePageParams(req.query);

  // Customers see only their own documents; admins/superadmins see all. The
  // tenant scope lives in the `where` clause, always derived from the verified
  // session — never from caller input (closes the upload-listing IDOR).
  const isAdmin =
    req.user?.role === "admin" || req.user?.role === "superadmin";
  const where = isAdmin ? {} : { ownerId: req.user!.id };

  const { items, ...pagination } = await documentRepository.paginate(where, {
    page,
    limit,
    orderBy: { uploadedAt: "desc" },
  });

  res.status(200).json({
    status: "success",
    data: {
      documents: items,
    },
    pagination,
  });
});

export { uploadDocument, getUploadedDocuments };
