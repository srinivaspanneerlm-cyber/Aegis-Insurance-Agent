import { companyRepository } from "../repositories";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";
import { sendSuccess } from "../utils/apiResponse";

const createCompany = catchAsync(async (req, res) => {
  const { companyName, logo, description } = req.body;

  const newCompany = await companyRepository.create({
    companyName,
    logo,
    description,
  });

  sendSuccess(res, 201, { company: newCompany });
});

const getCompanies = catchAsync(async (req, res) => {
  const { page, limit } = parsePageParams(req.query);
  const { items, ...pagination } = await companyRepository.paginate(
    {},
    { page, limit, orderBy: { createdAt: "desc" } }
  );

  sendSuccess(res, 200, { companies: items }, { results: items.length, pagination });
});

export { createCompany, getCompanies };
