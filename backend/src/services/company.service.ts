import { companyRepository } from "../repositories";
import type { PageParams } from "../utils/pagination";

interface CompanyInput {
  companyName: string;
  logo?: string | null;
  description?: string | null;
}

export const companyService = {
  create(input: CompanyInput) {
    return companyRepository.create({ ...input });
  },

  list({ page, limit }: PageParams) {
    return companyRepository.paginate({}, { page, limit, orderBy: { createdAt: "desc" } });
  },
};
