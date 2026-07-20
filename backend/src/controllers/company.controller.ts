import { companyService } from "../services/company.service";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";
import { sendSuccess } from "../utils/apiResponse";

const createCompany = catchAsync(async (req, res) => {
  const company = await companyService.create(req.body, req.user?.id);
  sendSuccess(res, 201, { company });
});

const getCompanies = catchAsync(async (req, res) => {
  const { items, ...pagination } = await companyService.list(parsePageParams(req.query));
  sendSuccess(res, 200, { companies: items }, { results: items.length, pagination });
});

export { createCompany, getCompanies };
