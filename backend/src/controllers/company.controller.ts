import { companyRepository } from "../repositories";
import catchAsync from "../utils/catchAsync";

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
  const companies = await companyRepository.findMany({}, { orderBy: { createdAt: "desc" } });

  res.status(200).json({
    status: "success",
    results: companies.length,
    data: {
      companies,
    },
  });
});

export { createCompany, getCompanies };
