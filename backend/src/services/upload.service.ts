import crypto from "crypto";
import fs from "fs/promises";
import { documentRepository } from "../repositories";
import { auditService } from "./audit.service";
import { scanFile } from "../utils/fileScan";
import AppError from "../utils/appError";
import type { PageParams } from "../utils/pagination";

interface DocumentInput {
  filename: string;
  filepath: string;
  ownerId: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

interface ListParams extends PageParams {
  role?: string;
  userId: string;
}

export const uploadService = {
  /**
   * Persist an uploaded document after (1) a pluggable malware scan and (2)
   * content-hash duplicate detection. The multer file is already on disk, so a
   * rejected upload is removed to avoid orphaned files.
   */
  async create(input: DocumentInput) {
    const { filepath, filename, ownerId } = input;

    // The customer's own filename is what the scan judges the content against —
    // multer's generated name would only ever agree with itself.
    const scan = await scanFile(filepath, filename);
    if (!scan.clean) {
      await fs.unlink(filepath).catch(() => {});
      auditService.record({
        actorId: ownerId,
        action: "document.rejected",
        metadata: {
          reason: scan.reason ?? "scan",
          filename,
          declaredMimeType: input.mimeType,
          detectedFormat: scan.format ?? null,
          sizeBytes: input.sizeBytes,
        },
      });
      throw new AppError("The uploaded file failed a security scan.", 400, "VALIDATION_ERROR");
    }

    const contentHash = crypto.createHash("sha256").update(await fs.readFile(filepath)).digest("hex");
    const duplicate = await documentRepository.findDuplicate(ownerId, contentHash);
    if (duplicate) {
      await fs.unlink(filepath).catch(() => {}); // don't keep the duplicate on disk
      throw new AppError("This document has already been uploaded.", 409, "CONFLICT");
    }

    const doc = await documentRepository.create({ ...input, contentHash });
    auditService.record({
      actorId: ownerId,
      action: "document.uploaded",
      entity: "UploadedDocument",
      entityId: doc.id,
      metadata: {
        filename,
        sizeBytes: input.sizeBytes,
        detectedFormat: scan.format ?? null,
      },
    });
    return doc;
  },

  /**
   * Tenant scope lives here: customers see only their own documents; admins /
   * superadmins see all. The scope is always derived from the verified session,
   * never from caller input.
   */
  list({ role, userId, page, limit }: ListParams) {
    const isAdmin = role === "admin" || role === "superadmin";
    const where = isAdmin ? {} : { ownerId: userId };
    return documentRepository.paginate(where, { page, limit, orderBy: { uploadedAt: "desc" } });
  },
};
