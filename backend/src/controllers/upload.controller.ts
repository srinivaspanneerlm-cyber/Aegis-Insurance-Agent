import { uploadService } from "../services/upload.service";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";
import { sendSuccess } from "../utils/apiResponse";

const uploadDocument = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Please attach a valid file payload.", 400));
  }

  const doc = await uploadService.create({
    filename: req.file.originalname,
    filepath: req.file.path,
    ownerId: req.user?.id || null,
    mimeType: req.file.mimetype || null,
    sizeBytes: typeof req.file.size === "number" ? req.file.size : null,
  });

  sendSuccess(res, 201, { document: doc });
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
