import { companyRepository } from "../repositories";
import { auditService } from "./audit.service";
import type { PageParams } from "../utils/pagination";

interface CompanyInput {
  companyName: string;
  logo?: string | null;
  description?: string | null;
}

export const companyService = {
  async create(input: CompanyInput, actorId?: string) {
    const company = await companyRepository.create({ ...input });
    auditService.record({ actorId, action: "company.created", entity: "Company", entityId: company.id });
    return company;
  },

  list({ page, limit }: PageParams) {
    return companyRepository.paginate({}, { page, limit, orderBy: { createdAt: "desc" } });
  },
};
