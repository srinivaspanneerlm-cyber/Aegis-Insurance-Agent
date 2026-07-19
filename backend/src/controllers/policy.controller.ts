import { policyService } from "../services/policy.service";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";
import { sendSuccess } from "../utils/apiResponse";

const createPolicy = catchAsync(async (req, res) => {
  const policy = await policyService.create(req.body);
  sendSuccess(res, 201, { policy });
});

const getPolicies = catchAsync(async (req, res) => {
  const { items, ...pagination } = await policyService.list(parsePageParams(req.query));
  sendSuccess(res, 200, { policies: items }, { results: items.length, pagination });
});

const getPolicyById = catchAsync(async (req, res) => {
  const policy = await policyService.getById((req.params as { id: string }).id);
  sendSuccess(res, 200, { policy });
});

export { createPolicy, getPolicies, getPolicyById };
