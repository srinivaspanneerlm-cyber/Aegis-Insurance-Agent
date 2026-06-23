const prisma = require("../config/db");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const createPolicy = catchAsync(async (req, res, next) => {
  const { policyName, premium, coverage, companyId } = req.body;

  // 1) Verify that the company exists
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    return next(new AppError("Associated Company identifier not found.", 404));
  }

  // 2) Save policy
  const newPolicy = await prisma.policy.create({
    data: {
      policyName,
      premium,
      coverage,
      companyId,
    },
  });

  res.status(201).json({
    status: "success",
    data: {
      policy: newPolicy,
    },
  });
});

const getPolicies = catchAsync(async (req, res, next) => {
  const policies = await prisma.policy.findMany({
    include: {
      company: {
        select: {
          companyName: true,
          logo: true,
        },
      },
    },
  });

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

  const policy = await prisma.policy.findUnique({
    where: { id },
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
