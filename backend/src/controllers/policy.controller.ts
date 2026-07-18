import { policyRepository, companyRepository } from "../repositories";
import cache from "../services/cache.service";
import { CACHE_TTL } from "../config/constants";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";

const POLICIES_CACHE_PREFIX = "policies:";

const createPolicy = catchAsync(async (req, res, next) => {
  const { policyName, premium, coverage, companyId } = req.body;

  // 1) Verify that the company exists
  const company = await companyRepository.findById(companyId);

  if (!company) {
    return next(new AppError("Associated Company identifier not found.", 404));
  }

  // 2) Save policy
  const newPolicy = await policyRepository.create({
    policyName,
    premium,
    coverage,
    companyId,
  });

  // Invalidate the cached catalogue so the new product is visible immediately.
  await cache.delByPrefix(POLICIES_CACHE_PREFIX);

  res.status(201).json({
    status: "success",
    data: {
      policy: newPolicy,
    },
  });
});

const getPolicies = catchAsync(async (req, res) => {
  const { page, limit } = parsePageParams(req.query);

  // Cache-aside per page: the public catalogue is read-heavy and changes only on
  // create (which invalidates the whole "policies:" prefix), so serve each page
  // from cache to avoid repeated joins. The page/limit are part of the key.
  const { items, ...pagination } = await cache.wrap(
    `${POLICIES_CACHE_PREFIX}p${page}:l${limit}`,
    CACHE_TTL.POLICIES,
    () =>
      policyRepository.paginate(
        {},
        {
          page,
          limit,
          include: {
            company: {
              select: {
                companyName: true,
                logo: true,
              },
            },
          },
        }
      )
  );

  res.status(200).json({
    status: "success",
    results: items.length,
    data: {
      policies: items,
    },
    pagination,
  });
});

const getPolicyById = catchAsync(async (req, res, next) => {
  const { id } = req.params as { id: string };

  const policy = await policyRepository.findById(id, {
    include: {
      company: {
        select: {
          companyName: true,
          logo: true,
        },
      },
    },
  });

  if (!policy) {
    return next(new AppError("No insurance policy found with that ID.", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      policy,
    },
  });
});

export { createPolicy, getPolicies, getPolicyById };
