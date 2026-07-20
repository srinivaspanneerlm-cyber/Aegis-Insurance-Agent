import { policyRepository, companyRepository } from "../repositories";
import cache from "./cache.service";
import { auditService } from "./audit.service";
import { CACHE_TTL } from "../config/constants";
import AppError from "../utils/appError";
import type { PageParams } from "../utils/pagination";

const POLICIES_CACHE_PREFIX = "policies:";

const COMPANY_SELECT = { company: { select: { companyName: true, logo: true } } };

interface PolicyInput {
  policyName: string;
  premium: number;
  coverage: string;
  companyId: string;
}

export const policyService = {
  async create(input: PolicyInput, actorId?: string) {
    const company = await companyRepository.findById(input.companyId);
    if (!company) throw new AppError("Associated Company identifier not found.", 404);

    const policy = await policyRepository.create({ ...input });

    // Invalidate the cached catalogue so the new product is visible immediately.
    await cache.delByPrefix(POLICIES_CACHE_PREFIX);
    auditService.record({ actorId, action: "policy.created", entity: "Policy", entityId: policy.id });
    return policy;
  },

  /**
   * Cache-aside per page: the public catalogue is read-heavy and changes only on
   * create (which invalidates the whole prefix), so each page is served from
   * cache to avoid repeated joins.
   */
  list({ page, limit }: PageParams) {
    return cache.wrap(
      `${POLICIES_CACHE_PREFIX}p${page}:l${limit}`,
      CACHE_TTL.POLICIES,
      () => policyRepository.paginate({}, { page, limit, include: COMPANY_SELECT })
    );
  },

  async getById(id: string) {
    const policy = await policyRepository.findById(id, { include: COMPANY_SELECT });
    if (!policy) throw new AppError("No insurance policy found with that ID.", 404);
    return policy;
  },
};
