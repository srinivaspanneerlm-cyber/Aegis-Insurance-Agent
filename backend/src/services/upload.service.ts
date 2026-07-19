import { documentRepository } from "../repositories";
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
  create(input: DocumentInput) {
    return documentRepository.create({ ...input });
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
