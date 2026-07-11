const { policyRepository, companyRepository } = require("../repositories");
const cache = require("../services/cache.service");
const { CACHE_TTL } = require("../config/constants");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

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
  cache.delByPrefix(POLICIES_CACHE_PREFIX);

  res.status(201).json({
    status: "success",
    data: {
      policy: newPolicy,
    },
  });
});

const getPolicies = catchAsync(async (req, res, next) => {
  // Cache-aside: the public catalogue is read-heavy and changes only on create
  // (which invalidates the key), so serve it from cache to avoid repeated joins.
  const policies = await cache.wrap(`${POLICIES_CACHE_PREFIX}all`, CACHE_TTL.POLICIES, () =>
    policyRepository.findMany(
      {},
      {
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
    results: policies.length,
    data: {
      policies,
    },
  });
});

const getPolicyById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

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

module.exports = {
  createPolicy,
  getPolicies,
  getPolicyById,
};
