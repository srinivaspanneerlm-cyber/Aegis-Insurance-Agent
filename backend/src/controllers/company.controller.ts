import { companyRepository } from "../repositories";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";

const createCompany = catchAsync(async (req, res) => {
  const { companyName, logo, description } = req.body;

  const newCompany = await companyRepository.create({
    companyName,
    logo,
    description,
  });

  res.status(201).json({
    status: "success",
    data: {
      company: newCompany,
    },
  });
});

const getCompanies = catchAsync(async (req, res) => {
  const { page, limit } = parsePageParams(req.query);
  const { items, ...pagination } = await companyRepository.paginate(
    {},
    { page, limit, orderBy: { createdAt: "desc" } }
  );

  res.status(200).json({
    status: "success",
    results: items.length,
    data: {
      companies: items,
    },
    pagination,
  });
});

export { createCompany, getCompanies };
