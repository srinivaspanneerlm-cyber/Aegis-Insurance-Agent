const { companyRepository } = require("../repositories");
const catchAsync = require("../utils/catchAsync");

const createCompany = catchAsync(async (req, res, next) => {
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

const getCompanies = catchAsync(async (req, res, next) => {
  const companies = await companyRepository.findMany({}, { orderBy: { createdAt: "desc" } });

  res.status(200).json({
    status: "success",
    results: companies.length,
    data: {
      companies,
    },
  });
});

module.exports = {
  createCompany,
  getCompanies,
};
